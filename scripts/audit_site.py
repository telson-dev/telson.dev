"""全站审计：入口、孤立页、失效链接、可疑文案。

用法：python scripts/audit_site.py


输出四块：
  1. 页面清单 + 谁链到它（孤立页 = 只能靠地址栏访问）
  2. 站内链接是否指向存在的文件 / 锚点
  3. 可疑文案（过时平台名、过期版本号、"见下载页"这类指路）
  4. 导航与页脚的一致性
"""

from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 明显过时 / 容易说错的词。
# 每条都是**正则**。早先用纯字符串匹配，`v0.2.3` 会命中 `v0.2.33` 里面，
# `爱发电`（当前正确平台）和 `example.com`（文档示例）也被当成问题，
# 一屏 40 多条误报，等于没有。这里只留真正的风险类别。
SUSPECT: list[tuple[str, str]] = [
    (r"面包多|mianbaoduo", "旧收款平台（现为爱发电）"),
    (r"最多\s*2\s*台|2\s*台设备", "已废弃的设备限制说法"),
    (r"三语版本见|见下面的下载页", "假指路（下载页未必有该文件）"),
    (r"敬请期待|待补充|TODO|FIXME", "占位文案"),
    (r"localhost|127\.0\.0\.1", "本地地址，不该出现在说明里"),
    (r"43 个 MCP 工具", "工具数已过时（当前 45）"),
    (r"320\+ 项测试|300\+ 测试", "测试数已过时（当前 545）"),
    (r"v0\.2\.0（?已发布|当前版本 v0\.2\.0", "版本号已过时"),
]


def pages() -> list[Path]:
    return sorted(p for p in ROOT.glob("*.html"))


def nav_links(t: str) -> list[str]:
    m = re.search(r'<nav class="nav__links"[\s\S]{0,1600}?</nav>', t)
    if not m:
        return []
    return re.findall(r'href="([^"]+)"', m.group(0))


def all_hrefs(t: str) -> list[str]:
    return re.findall(r'href="([^"]+)"', t)


def main() -> None:
    ps = pages()
    bodies = {p.name: p.read_text(encoding="utf-8") for p in ps}

    # ---------- 1. 入链统计 ----------
    inbound: dict[str, set[str]] = defaultdict(set)
    for name, t in bodies.items():
        for h in all_hrefs(t):
            target = h.split("#")[0].split("?")[0]
            if target.endswith(".html") and target in bodies and target != name:
                inbound[target].add(name)

    navs = {name: nav_links(t) for name, t in bodies.items()}
    nav_union: set[str] = set()
    for v in navs.values():
        for h in v:
            nav_union.add(h.split("#")[0])

    print("=" * 78)
    print("1) 页面清单 / 入链")
    print("=" * 78)
    print(f"{'页面':<22}{'入链':>4}  在导航中  来自")
    orphans = []
    for name in sorted(bodies):
        src = inbound.get(name, set())
        in_nav = "是" if name in nav_union or name == "index.html" else "否"
        # 404.html 本来就没人链：它是 GitHub Pages 在地址写错时自动返回的，
        # 不该出现在导航或页脚里，所以不算「孤立页」。
        if not src and name not in ("index.html", "404.html"):
            orphans.append(name)
        who = ", ".join(sorted(src)[:4]) + ("…" if len(src) > 4 else "")
        print(f"{name:<22}{len(src):>4}  {in_nav:^8}  {who}")

    print()
    print("孤立页（没有任何其他页面链到）:", orphans or "无")

    # ---------- 2. 死链 ----------
    print()
    print("=" * 78)
    print("2) 站内链接检查")
    print("=" * 78)
    dead = []
    for name, t in bodies.items():
        for h in all_hrefs(t):
            if h.startswith(("http://", "https://", "mailto:", "#", "javascript:")):
                continue
            target = h.split("#")[0].split("?")[0]
            if not target:
                continue
            if target.endswith(".html"):
                if target not in bodies:
                    dead.append((name, h, "页面不存在"))
            else:
                p = ROOT / target
                if not p.exists():
                    dead.append((name, h, "文件不存在"))
    if dead:
        for name, h, why in dead:
            print(f"  ✗ {name}: {h}  ({why})")
    else:
        print("  无死链")

    # ---------- 3. 可疑文案 ----------
    print()
    print("=" * 78)
    print("3) 可疑文案")
    print("=" * 78)
    hits = 0
    for name in sorted(bodies):
        lines = bodies[name].splitlines()
        for pattern, why in SUSPECT:
            rx = re.compile(pattern)
            for i, line in enumerate(lines, 1):
                if rx.search(line):
                    hits += 1
                    snippet = line.strip()
                    if len(snippet) > 150:
                        mo = rx.search(snippet)
                        idx = mo.start() if mo else 0
                        snippet = "…" + snippet[max(0, idx - 50):idx + 100] + "…"
                    print(f"  {name}:{i}  [{pattern} · {why}]")
                    print(f"      {snippet}")
    if not hits:
        print("  未命中")

    # ---------- 4. 导航一致性 ----------
    print()
    print("=" * 78)
    print("4) 导航项一致性")
    print("=" * 78)
    base = navs.get("index.html", [])
    print(f"{'页面':<22} 导航项")
    for name in sorted(navs):
        items = [h.split("#")[0] for h in navs[name] if h.split("#")[0].endswith(".html")]
        diff = ""
        if name != "index.html" and items != [b.split("#")[0] for b in base if b.split("#")[0].endswith(".html")]:
            diff = "  ← 与首页不同"
        print(f"{name:<22} {' / '.join(items)}{diff}")

    # ---------- 5. 命令块里的 pteropilot flag ----------
    # 站点上写错一个 flag，用户照着敲就会报错，而页面看起来完全正常。
    # 允许清单直接从 pteropilot 源码里抓字符串字面量，避免二次维护一份清单。
    print()
    print("=" * 78)
    print("5) 命令示例里的 pteropilot flag")
    print("=" * 78)
    src_file = Path(r"D:\Projects\pteropilot\src\pteropilot\server.py")
    if not src_file.exists():
        print("  跳过（找不到 pteropilot 源码）")
    else:
        known = set(re.findall(r'"(--[a-z][a-z-]*)"', src_file.read_text(encoding="utf-8")))
        known |= {"--version", "--doctor", "--help"}
        bad = []
        for name in sorted(bodies):
            for flag in sorted(set(re.findall(r"pteropilot\s+(--[a-z][a-z-]*)", bodies[name]))):
                if flag not in known:
                    bad.append((name, flag))
        if bad:
            for name, flag in bad:
                print(f"  ✗ {name}: {flag}  在 pteropilot 源码里不存在")
        else:
            print(f"  全部存在（源码里有 {len(known)} 个 flag 字面量）")

    # ---------- 6. JSON-LD 可解析 ----------
    print()
    print("=" * 78)
    print("6) JSON-LD 结构数据")
    print("=" * 78)
    import json as _json

    ld_bad = 0
    for name in sorted(bodies):
        for i, block in enumerate(re.findall(
            r'<script type="application/ld\+json">([\s\S]*?)</script>', bodies[name]
        ), 1):
            try:
                _json.loads(block)
            except Exception as exc:  # noqa: BLE001
                ld_bad += 1
                print(f"  ✗ {name} 第 {i} 块: {type(exc).__name__}: {exc}")
    print("  全部可解析" if not ld_bad else f"  {ld_bad} 块有问题")

    # ---------- 7. 图片 / 媒体资源存在性 ----------
    print()
    print("=" * 78)
    print("7) 页面引用的图片与媒体")
    print("=" * 78)
    missing = []
    for name in sorted(bodies):
        for attr in ("src", "poster"):
            for ref in re.findall(rf'{attr}="([^"]+)"', bodies[name]):
                if ref.startswith(("http://", "https://", "data:", "//")):
                    continue
                if ref.startswith("#"):
                    continue
                p = ROOT / ref.split("?")[0]
                if not p.exists():
                    missing.append((name, ref))
    if missing:
        for name, ref in missing:
            print(f"  ✗ {name}: {ref}  文件不存在")
    else:
        print("  全部存在")


if __name__ == "__main__":
    main()
