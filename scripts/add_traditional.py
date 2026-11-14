#!/usr/bin/env python3
"""给 telson.dev 所有页面加繁体中文（zh-TW）。

做法：
  1. 每个含 ``data-zh`` 的元素补一个 ``data-zh-tw``（值为简体经 OpenCC ``s2twp`` 转换：
     台湾正体 + 台湾用词，如 服务器→伺服器、文件→檔案、设置→設定）
  2. 收集纯文本节点用的 ``DICT`` 键，生成 ``TW_DICT``（简体→繁体）供 main.js 运行时替换
  3. ``--check`` 只报告还需处理的数量，不写文件

用法：
    python scripts/add_traditional.py --dry-run    # 只看统计
    python scripts/add_traditional.py              # 写入 data-zh-tw
    python scripts/add_traditional.py --check      # CI 用：有遗漏则退出 1
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = [
    "index.html", "projects.html", "services.html", "pteropilot.html",
    "pro.html", "pro-guide.html", "tutorial.html", "changelog.html", "404.html",
]

# data-zh 可能用双引号或单引号包裹（含内嵌 HTML 的属性常用单引号），两种都要匹配
DATA_ZH_RE = re.compile(r"""data-zh=(["'])(.*?)\1""", re.S)


def make_converter():
    try:
        from opencc import OpenCC
    except ImportError:
        sys.exit("❌ 需要 opencc：uv pip install opencc-python-reimplemented --python <venv python>")
    return OpenCC("s2twp")


def convert_attr_value(cc, text: str) -> str:
    """HTML 属性值里的文本：保留实体与占位符原样，只转汉字。"""
    return cc.convert(text)


def html_unescape(s: str) -> str:
    """属性值里的实体还原成字符，便于翻译（&quot; &amp; &lt; &gt; &#39;）。"""
    import html as _html
    return _html.unescape(s)


def html_escape(s: str, quote: str) -> str:
    """把翻译结果放回属性。

    data-zh 的值本身是 HTML 片段（由 main.js 用 innerHTML 注入），所以
    **不能**转义 < > & —— 只处理与属性引号冲突的字符。
    """
    if quote == '"':
        return s.replace('"', "&quot;")
    return s.replace("'", "&#39;")


def process_page(path: Path, cc, write: bool) -> tuple[int, int]:
    """返回 (已有 data-zh-tw 的数量, 需要新增的数量)。"""
    html = path.read_text(encoding="utf-8")
    already = len(re.findall(r"data-zh-tw=", html))
    matches = list(DATA_ZH_RE.finditer(html))
    if not matches:
        return already, 0

    out = []
    last = 0
    added = 0
    for m in matches:
        start, end = m.span()
        segment = html[last:end]
        out.append(segment)
        # 看这个 data-zh 后面紧邻是否有 data-zh-tw
        quote = m.group(1)
        tail = html[end:end + 40]
        if tail.lstrip().startswith("data-zh-tw="):
            last = end
            continue
        zh = m.group(2)
        zh_txt = html_unescape(zh)
        tw = convert_attr_value(cc, zh_txt)
        if tw and tw != zh_txt:
            tw_attr = html_escape(tw, quote)
            out.append(f" data-zh-tw={quote}{tw_attr}{quote}")
            added += 1
        last = end
    out.append(html[last:])
    new_html = "".join(out)

    if write and added:
        path.write_text(new_html, encoding="utf-8")
    return already, added


def collect_dict_keys(main_js: Path) -> list[str]:
    """从 main.js 的 DICT 里取出所有键（简体原文）。"""
    text = main_js.read_text(encoding="utf-8")
    m = re.search(r"var DICT = \{(.*?)\n    \};", text, re.S)
    if not m:
        return []
    body = m.group(1)
    keys = re.findall(r"^\s*'((?:[^'\\]|\\.)*)':", body, re.M)
    return keys


def generate_tw_dict(main_js: Path, cc, write: bool) -> int:
    """在 main.js 里生成/更新 TW_DICT（简体→繁体）映射。"""
    keys = collect_dict_keys(main_js)
    if not keys:
        return 0
    lines = ["    /* 繁体文本映射：与 DICT 的键一一对应（运行时按需替换） */", "    var TW_DICT = {"]
    seen = set()
    for k in keys:
        if k in seen:
            continue
        seen.add(k)
        tw = cc.convert(k)
        if tw == k:
            continue
        kq = k.replace("\\", "\\\\").replace("'", "\\'")
        tq = tw.replace("\\", "\\\\").replace("'", "\\'")
        lines.append(f"      '{kq}': '{tq}',")
    lines.append("    };")
    block = "\n".join(lines) + "\n"

    text = main_js.read_text(encoding="utf-8")
    if "var TW_DICT = {" in text:
        text = re.sub(r"    /\* 繁体文本映射.*?\n    var TW_DICT = \{.*?\n    \};\n", block, text, flags=re.S)
    else:
        # 插在 DICT 定义结束之后
        idx = text.find("    var DICT = {")
        if idx < 0:
            return 0
        end = text.find("\n    };", idx)
        if end < 0:
            return 0
        insert_at = end + len("\n    };\n")
        text = text[:insert_at] + "\n" + block + text[insert_at:]
    if write:
        main_js.write_text(text, encoding="utf-8")
    return len(seen)


def main() -> int:
    ap = argparse.ArgumentParser(description="给页面加繁体中文（data-zh-tw + TW_DICT）")
    ap.add_argument("--dry-run", action="store_true", help="只统计，不写文件")
    ap.add_argument("--check", action="store_true", help="有页面缺 data-zh-tw 时退出 1")
    args = ap.parse_args()

    cc = make_converter()
    write = not (args.dry_run or args.check)

    total_added = 0
    missing = []
    for name in PAGES:
        p = ROOT / name
        if not p.exists():
            continue
        already, added = process_page(p, cc, write)
        total_added += added
        status = "✅" if added == 0 else ("(dry)" if not write else "✍️")
        print(f"{status} {name}: 已有 {already} 处，本次新增 {added} 处")
        if args.check and added:
            missing.append(name)

    main_js = ROOT / "assets" / "js" / "main.js"
    n = generate_tw_dict(main_js, cc, write)
    print(f"{'✅' if not write else '✍️'} main.js TW_DICT: {n} 条")

    if args.check:
        if missing:
            print(f"\n❌ 仍有页面缺繁体文案：{', '.join(missing)}")
            return 1
        print("\n✅ 所有页面都已有 data-zh-tw")
        return 0

    print(f"\n{'（dry-run，未写入）' if not write else '完成'}：新增 {total_added} 处 data-zh-tw")
    print("下一步：改 main.js 支持 zh-TW 并加「繁」按钮")
    return 0


if __name__ == "__main__":
    sys.exit(main())
