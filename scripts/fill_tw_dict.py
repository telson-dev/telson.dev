#!/usr/bin/env python3
"""补齐 main.js 的 TW_DICT：把页面里漏翻的纯文本节点补进繁体映射。

背景：页面上有两种文案——
  1. 带 ``data-zh`` 属性的元素：已有 ``data-zh-tw``，切换时直接换属性；
  2. **纯文本节点**（没有属性）：靠 main.js 的 ``DICT``（简→英）精确匹配翻译。
     繁体模式用 ``TW_DICT``（简→繁），但只有原来在 DICT 里出现过的键才被生成，
     于是「DICT 里没有的纯文本」在繁体模式下会露出简体。

本脚本扫描所有页面的文本节点，找出「含汉字、且 TW_DICT 没有对应键」的文本，
用 OpenCC 生成繁体后追加进 main.js 的 TW_DICT。

用法：
    python scripts/fill_tw_dict.py --dry-run   # 只报告会补多少条
    python scripts/fill_tw_dict.py             # 写入 main.js
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAIN_JS = ROOT / "assets" / "js" / "main.js"
PAGES = [
    "index.html", "projects.html", "services.html", "pteropilot.html",
    "pro.html", "pro-guide.html", "tutorial.html", "changelog.html", "404.html",
]

# 去掉 HTML 标签与脚本/样式，拿纯文本片段
SCRIPT_STYLE_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.S | re.I)
TAG_RE = re.compile(r"<[^>]+>")
HAN_RE = re.compile(r"[\u4e00-\u9fff]")
# 太长的不当作单个节点（可能是整段合并）
MIN_LEN, MAX_LEN = 4, 400


def norm(s: str) -> str:
    return re.sub(r"\s+", "", s)


def collect_text_segments() -> set[str]:
    segs: set[str] = set()
    for name in PAGES:
        p = ROOT / name
        if not p.exists():
            continue
        html = p.read_text(encoding="utf-8")
        html = SCRIPT_STYLE_RE.sub(" ", html)
        # 注意：不能整块删掉带 data-zh 的元素——有些元素自身或子元素里还有
        # 没有被属性覆盖的文本（例如 <dd>/<td> 的纯文本），一并扫描才能补齐。
        text = TAG_RE.sub("\n", html)
        for line in text.split("\n"):
            line = line.strip()
            if MIN_LEN <= len(line) <= MAX_LEN and HAN_RE.search(line):
                segs.add(line)
    return segs


def existing_tw_keys(js: str) -> set[str]:
    m = re.search(r"var TW_DICT = \{(.*?)\n    \};", js, re.S)
    if not m:
        return set()
    body = m.group(1)
    keys = re.findall(r"^\s*'((?:[^'\\]|\\.)*)':", body, re.M)
    return {k.replace("\\'", "'").replace("\\\\", "\\") for k in keys}


def main() -> int:
    ap = argparse.ArgumentParser(description="补齐 TW_DICT（繁体纯文本映射）")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    try:
        from opencc import OpenCC
    except ImportError:
        sys.exit("❌ 需要 opencc：uv pip install opencc-python-reimplemented")

    cc = OpenCC("s2twp")
    js = MAIN_JS.read_text(encoding="utf-8")
    have = {norm(k) for k in existing_tw_keys(js)}

    segs = collect_text_segments()
    missing = []
    for s in sorted(segs):
        if norm(s) in have:
            continue
        tw = cc.convert(s)
        if tw == s:
            continue
        missing.append((s, tw))

    print(f"页面上纯文本片段：{len(segs)} 条")
    print(f"TW_DICT 已有：{len(have)} 条")
    print(f"待补：{len(missing)} 条")
    for s, tw in missing[:12]:
        print(f"  简: {s[:52]}")
        print(f"  繁: {tw[:52]}")

    if not missing:
        return 0
    if args.dry_run:
        print("\n（dry-run，未写入）")
        return 0

    # 追加到 TW_DICT 末尾
    m = re.search(r"(var TW_DICT = \{)(.*?)(\n    \};)", js, re.S)
    if not m:
        sys.exit("❌ 找不到 TW_DICT 定义")
    body = m.group(2)
    lines = []
    for s, tw in missing:
        kq = s.replace("\\", "\\\\").replace("'", "\\'")
        tq = tw.replace("\\", "\\\\").replace("'", "\\'")
        lines.append(f"      '{kq}': '{tq}',")
    new_body = body + "\n" + "\n".join(lines)
    js = js[:m.start(2)] + new_body + js[m.end(2):]
    MAIN_JS.write_text(js, encoding="utf-8")
    print(f"\n✅ 已补 {len(missing)} 条进 TW_DICT")
    return 0


if __name__ == "__main__":
    sys.exit(main())
