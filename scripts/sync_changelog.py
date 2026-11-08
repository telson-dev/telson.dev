#!/usr/bin/env python3
"""站点更新日志自动同步：从开源仓库 CHANGELOG.md 生成 changelog.html 的版本区。

解决手工重复劳动：每发一个版本，过去要手改 changelog.html 的条目 + 页面里
「v0.1.0 到 vX.Y.Z」「N 个工具」等多处计数。现在一条命令全自动。

用法：
  python scripts/sync_changelog.py                 # 只报告差异（安全，默认）
  python scripts/sync_changelog.py --write         # 实际写入 changelog.html
  python scripts/sync_changelog.py --bootstrap     # 首次：给 HTML 插入自动区标记
  python scripts/sync_changelog.py --check         # CI 用：不一致时退出码 1

规则：
  - 版本条目来自 D:\\Projects\\pteropilot\\CHANGELOG.md（`## [x.y.z] - 日期` 块）
  - 跳过 `[Unreleased]`
  - 工具数来自开源仓库 src/pteropilot/server.py 的 `@mcp.tool()` 数量
  - 区间以 `<!-- CHANGELOG:START ... -->` 与 `<!-- CHANGELOG:END -->` 标记界定
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
REPO = Path(r"D:\Projects\pteropilot")
CHANGELOG_MD = REPO / "CHANGELOG.md"
SERVER_PY = REPO / "src" / "pteropilot" / "server.py"
HTML = SITE / "changelog.html"

START_MARK = "<!-- CHANGELOG:START"
END_MARK = "<!-- CHANGELOG:END -->"

VER_RE = re.compile(r"^## +\[([0-9]+(?:\.[0-9]+)*)\] *- *([0-9]{4}-[0-9]{2}-[0-9]{2})")
SECTION_RE = re.compile(r"^### +(\S.*)$")


def parse_changelog(path: Path) -> list[dict]:
    """解析 CHANGELOG.md → [{version, date, items: [(section, text)]}]（新→旧）。"""
    text = path.read_text(encoding="utf-8")
    releases: list[dict] = []
    cur: dict | None = None
    section = ""

    for raw in text.splitlines():
        line = raw.rstrip()
        m = VER_RE.match(line)
        if m:
            cur = {"version": m.group(1), "date": m.group(2), "items": []}
            releases.append(cur)
            section = ""
            continue
        if line.startswith("## "):
            cur = None  # [Unreleased] 或其它块
            section = ""
            continue
        if cur is None:
            continue
        ms = SECTION_RE.match(line)
        if ms:
            section = ms.group(1).strip()
            continue
        if line.startswith("- ") and section:
            body = line[2:].strip()
            if body:
                cur["items"].append((section, body))
    return releases


def count_tools(path: Path) -> int:
    return len(re.findall(r"@mcp\.tool\(\)", path.read_text(encoding="utf-8")))


def render_articles(releases: list[dict]) -> str:
    """生成 article 卡片 HTML 片段（与现有页面风格一致）。"""
    out: list[str] = []
    for rel in releases:
        if not rel["items"]:
            continue
        title = f'v{rel["version"]}'
        date = rel["date"]
        out.append('      <article class="card reveal" style="margin-bottom:18px">')
        out.append(
            f'        <h2 style="margin:0 0 6px;font-size:20px">{title} '
            f'<span class="muted" style="font-size:13px;font-weight:400">{date}</span></h2>'
        )
        out.append('        <ul class="ticks">')
        for section, body in rel["items"]:
            safe = html.escape(body, quote=True)
            label = "" if section in ("Added", "新增") else f"（{section}）"
            text = f"{safe}{label}"
            out.append(f'          <li data-zh="{text}" data-en="{text}">{text}</li>')
        out.append('        </ul>')
        out.append('      </article>')
        out.append("")
    return "\n".join(out).rstrip() + "\n"


def update_counts(text: str, latest: str, tools: int) -> tuple[str, list[str]]:
    """更新页面里版本 / 工具数计数（中英双语），返回 (新文本, 改动说明)。"""
    changes: list[str] = []

    def sub(pattern: str, repl: str, label: str) -> None:
        nonlocal text
        before = text
        new, n = re.subn(pattern, repl, text)
        if not n:
            return
        text = new
        # 只有文本真的变了才算改动（正则命中但内容相同 → 保持幂等）
        if new != before:
            delta = sum(1 for a, b in zip(before.split("\n"), new.split("\n")) if a != b)
            changes.append(f"{label}（{delta or 1} 处）")

    sub(r"从 v0\.1\.0 到 v[0-9.]+ 的版本历史——[0-9]+ 个 MCP 工具",
        f"从 v0.1.0 到 v{latest} 的版本历史——{tools} 个 MCP 工具", "meta description 版本/工具数")
    sub(r"v0\.1\.0 → v[0-9.]+ · [0-9]+ 个工具 · [0-9]+\+ 测试",
        f"v0.1.0 → v{latest} · {tools} 个工具 · 300+ 测试", "og:description 计数")
    sub(r"从 v0\.1\.0 到 v[0-9.]+：[0-9]+ 个工具、[0-9]+\+ 项测试，持续迭代。",
        f"从 v0.1.0 到 v{latest}：{tools} 个工具、300+ 项测试，持续迭代。", "中文 hero 计数")
    sub(r"From v0\.1\.0 to v[0-9.]+: [0-9]+ tools, [0-9]+\+ tests, iterating steadily\.",
        f"From v0.1.0 to v{latest}: {tools} tools, 300+ tests, iterating steadily.", "英文 hero 计数")
    sub(r"Pteropilot 更新日志：从 v0\.1\.0 到 v[0-9.]+",  # 兜底：description 另一形态
        f"Pteropilot 更新日志：从 v0.1.0 到 v{latest}", "meta 标题版本")
    return text, changes


def bootstrap(text: str) -> tuple[str, bool]:
    """首次插入自动区标记（幂等）。"""
    if START_MARK in text and END_MARK in text:
        return text, False
    first = text.index('<article class="card reveal"')
    text = (
        text[:first]
        + START_MARK
        + "（此区由 scripts/sync_changelog.py 自动生成，勿手工编辑） -->\n\n      "
        + text[first:]
    )
    last = text.rindex("</article>")
    after = last + len("</article>")
    text = text[:after] + "\n\n      " + END_MARK + text[after:]
    return text, True


def extract_block(text: str) -> str | None:
    i = text.find(START_MARK)
    j = text.find(END_MARK)
    if i < 0 or j < 0 or j < i:
        return None
    return text[i:j]


ARTICLE_RE = re.compile(
    r'      <article class="card reveal"[^>]*>\n'
    r'        <h2[^>]*>v([0-9][0-9.]*)\b[^\n]*\n'
    r'(?:[^\n]*\n)*?'
    r'      </article>'
)


def existing_articles(block: str) -> dict[str, str]:
    """从现有区块里取 {版本: 原文}，用于保留人工维护的双语内容。"""
    found: dict[str, str] = {}
    for m in ARTICLE_RE.finditer(block):
        found.setdefault(m.group(1), m.group(0))
    return found


def render_articles(releases: list[dict], reuse: dict[str, str] | None = None) -> tuple[str, int, int]:
    """生成 article 卡片；已存在于页面的版本优先复用原文（保留人工英文翻译）。

    返回 (HTML, 复用条数, 新生成条数)。
    """
    reuse = reuse or {}
    out: list[str] = []
    reused = generated = 0
    for rel in releases:
        if not rel["items"]:
            continue
        ver = rel["version"]
        if ver in reuse:
            out.append(reuse[ver])
            out.append("")
            reused += 1
            continue
        title = f'v{ver}'
        date = rel["date"]
        out.append('      <article class="card reveal" style="margin-bottom:18px">')
        out.append(
            f'        <h2 style="margin:0 0 6px;font-size:20px">{title} '
            f'<span class="muted" style="font-size:13px;font-weight:400">{date}</span></h2>'
        )
        out.append('        <ul class="ticks">')
        for section, body in rel["items"]:
            safe = html.escape(body, quote=True)
            label = "" if section in ("Added", "新增") else f"（{section}）"
            text = f"{safe}{label}"
            out.append(f'          <li data-zh="{text}" data-en="{text}">{text}</li>')
        out.append('        </ul>')
        out.append('      </article>')
        out.append("")
        generated += 1
    return "\n".join(out).rstrip() + "\n", reused, generated


def main() -> int:
    ap = argparse.ArgumentParser(description="站点更新日志自动同步")
    ap.add_argument("--write", action="store_true", help="写入 changelog.html")
    ap.add_argument("--check", action="store_true", help="仅校验，不一致退出码 1（CI 用）")
    ap.add_argument("--bootstrap", action="store_true", help="首次插入自动区标记")
    ap.add_argument("--force", action="store_true", help="忽略页面已有条目，全部按 CHANGELOG.md 重新生成（会丢人工英文翻译）")
    args = ap.parse_args()

    if not CHANGELOG_MD.exists():
        sys.exit(f"❌ 找不到 {CHANGELOG_MD}")
    if not SERVER_PY.exists():
        sys.exit(f"❌ 找不到 {SERVER_PY}")

    releases = parse_changelog(CHANGELOG_MD)
    if not releases:
        sys.exit("❌ CHANGELOG.md 没解析到任何版本块（格式应为 '## [x.y.z] - YYYY-MM-DD'）")
    tools = count_tools(SERVER_PY)
    latest = releases[0]["version"]

    text = HTML.read_text(encoding="utf-8")

    if args.bootstrap:
        text, inserted = bootstrap(text)
        if inserted:
            HTML.write_text(text, encoding="utf-8")
            print(f"✅ 已插入自动区标记（{HTML.name}）")
        else:
            print("标记已存在，无需 bootstrap")
        return 0

    if START_MARK not in text or END_MARK not in text:
        sys.exit("❌ 页面里没有自动区标记。先跑一次：python scripts/sync_changelog.py --bootstrap")

    old_block = extract_block(text)
    assert old_block is not None
    reuse = {} if args.force else existing_articles(old_block)
    body, reused, generated = render_articles(releases, reuse)
    new_block = (
        START_MARK
        + "（此区由 scripts/sync_changelog.py 自动生成，勿手工编辑） -->\n\n"
        + body
        + "\n      "
    )
    body_new, count_changes = update_counts(text, latest, tools)

    # 拼装新全文
    i = body_new.find(START_MARK)
    j = body_new.find(END_MARK)
    rebuilt = body_new[:i] + new_block + body_new[j:]

    block_changed = old_block != new_block
    changed = block_changed or bool(count_changes) or rebuilt != text

    print(f"版本块：{len(releases)} 个（最新 v{latest}，日期 {releases[0]['date']}）")
    print(f"工具数：{tools}")
    print(f"版本区：复用已有 {reused} 个 / 新生成 {generated} 个")
    if count_changes:
        print("计数改动：" + "；".join(count_changes))
    else:
        print("计数：已是最新")

    if not changed:
        print("\n✅ 全部一致，无需改动")
        return 0

    if args.check:
        print("\n❌ 页面与 CHANGELOG.md 不一致（--check 模式）")
        return 1

    if not args.write:
        print("\n（预览模式：未写文件。确认无误后加 --write）")
        return 0

    HTML.write_text(rebuilt, encoding="utf-8")
    print(f"\n✅ 已写入 {HTML.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
