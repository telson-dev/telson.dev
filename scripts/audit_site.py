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

# 明显过时 / 容易说错的词
SUSPECT = {
    "面包多": "旧的收款平台",
    "afdian": "旧的收款平台",
    "爱发电": "旧的收款平台",
    "三语版本": "指向可能不存在的下载",
    "见下面的下载页": "指路可能不成立",
    "4K60 三语": "指路可能不成立",
    "v0.2.0": "过期版本号",
    "v0.2.3": "过期版本号",
    "0.2.0": "过期版本号",
    "v0.1.0": "过期版本号",
    "v0.1.2": "可能过期",
    "最多 2 台": "已废弃的设备限制说法",
    "敬请期待": "占位文案",
    "TODO": "占位",
    "FIXME": "占位",
    "localhost": "本地地址",
    "127.0.0.1": "本地地址",
    "example.com": "示例地址",
}


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
        for kw, why in SUSPECT.items():
            for i, line in enumerate(lines, 1):
                if kw in line:
                    hits += 1
                    snippet = line.strip()
                    if len(snippet) > 150:
                        idx = snippet.find(kw)
                        snippet = "…" + snippet[max(0, idx - 50):idx + 100] + "…"
                    print(f"  {name}:{i}  [{kw} · {why}]")
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


if __name__ == "__main__":
    main()
