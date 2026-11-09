#!/usr/bin/env python3
"""telson.dev 站点自检：本地链接 / 资源引用 / sitemap 一致性 / SEO 元数据 / 页内锚点。

用法（在站点仓库根目录）：
    python scripts/check_site.py            # 检查当前目录
    python scripts/check_site.py --root .   # 指定根目录

退出码：0 = 全部通过；1 = 发现问题（逐条打印）。
零依赖，只用标准库。
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

LOCAL_SCHEMES = ("", None)
SKIP_PREFIXES = ("http://", "https://", "//", "mailto:", "tel:", "javascript:", "data:")


class PageParser(HTMLParser):
    """收集页面里的链接、资源引用、id 与 SEO 元数据。"""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []  # (attr, value)
        self.ids: set[str] = set()
        self.title = ""
        self.meta: dict[str, str] = {}
        self.canonical = ""
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        d = {k: (v or "") for k, v in attrs}
        if "id" in d:
            self.ids.add(d["id"])
        if "name" in d and tag == "a":
            self.ids.add(d["name"])
        for attr in ("href", "src"):
            if attr in d and d[attr]:
                self.links.append((attr, d[attr]))
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            key = d.get("property") or d.get("name") or ""
            if key and "content" in d:
                self.meta[key] = d["content"]
        if tag == "link" and d.get("rel") == "canonical":
            self.canonical = d.get("href", "")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


REPO_OPEN = Path(r"D:\Projects\pteropilot")
REPO_PRO = Path(r"D:\Projects\pteropilot-pro")


def check_tool_counts(root: Path, pages: dict) -> list[str]:
    """页面里手写的工具数必须与源码一致（源码仓库不在场时跳过）。

    为什么需要：changelog.html 的计数由 sync_changelog.py 自动生成，但 pro.html /
    index.html 等页面的数字是手写的——工具一多就容易漂移（曾出现站点写「15 个 AI 工具」而实际已 17 个）。
    """
    problems: list[str] = []

    # 开源版：数 @mcp.tool() 装饰器
    server_py = REPO_OPEN / "src" / "pteropilot" / "server.py"
    open_count = None
    if server_py.exists():
        open_count = server_py.read_text(encoding="utf-8").count("@mcp.tool()")
    # Pro：数 TOOL_HANDLERS 字典条目（更准，直接数 "key": _tool_）
    pro_app = REPO_PRO / "app.py"
    pro_count = None
    if pro_app.exists():
        text = pro_app.read_text(encoding="utf-8")
        if "TOOL_HANDLERS" in text:
            segment = text.split("TOOL_HANDLERS", 1)[1]
            pro_count = segment.count(': _tool_')

    checked = 0
    for page, parsed in pages.items():
        if page.name == "404.html":
            continue
        raw = read_with_retry(page)
        if open_count is not None:
            for m in re.finditer(r"([0-9]+) 个 MCP 工具", raw):
                checked += 1
                if int(m.group(1)) != open_count:
                    problems.append(
                        f"[数字] {page.name}: 写「{m.group(1)} 个 MCP 工具」，源码实为 {open_count}"
                    )
        if pro_count is not None:
            for m in re.finditer(r"([0-9]+) 个 AI 工具", raw):
                checked += 1
                if int(m.group(1)) != pro_count:
                    problems.append(
                        f"[数字] {page.name}: 写「{m.group(1)} 个 AI 工具」，Pro 源码实为 {pro_count}"
                    )
        if open_count is not None:
            for m in re.finditer(r"([0-9]+) 个面板工具", raw):
                checked += 1
                if int(m.group(1)) != pro_count:
                    problems.append(
                        f"[数字] {page.name}: 写「{m.group(1)} 个面板工具」，Pro 源码实为 {pro_count}"
                    )

    if open_count is None and pro_count is None:
        print("   （跳过工具数一致性：未找到同级 pteropilot / pteropilot-pro 仓库）")
    elif checked == 0:
        print("   （未在页面中找到工具数表述，跳过）")
    return problems


def read_with_retry(path: Path, attempts: int = 3, delay: float = 0.15) -> str:
    """读取页面文本，容忍 Windows 上偶发的短时占用/杀软扫描导致的读取失败。

    读取失败时明确抛出 ReadError，而不是返回空文本——否则会被当成
    「缺少 <title>」这类 SEO 错误，产生难以复现的误报。
    """
    last: Exception | None = None
    for i in range(attempts):
        try:
            text = path.read_text(encoding="utf-8")
            if text.strip():
                return text
            last = ValueError(f"文件内容为空（{path.name}）")
        except (OSError, ValueError, UnicodeDecodeError) as exc:  # noqa: PERF203
            last = exc
        time.sleep(delay * (i + 1))
    raise SystemExit(f"[read] 无法读取 {path}（已重试 {attempts} 次）：{last}")


def parse_page(path: Path) -> PageParser:
    p = PageParser()
    p.feed(read_with_retry(path))
    p.close()
    return p


def is_local(url: str) -> bool:
    return not url.startswith(SKIP_PREFIXES)


def resolve_local(root: Path, page: Path, url: str) -> tuple[Path | None, str]:
    """把本地引用解析成目标文件；返回 (target_path, kind)。kind: file|anchor|empty|external。"""
    if url.startswith("#"):
        return None, "anchor"
    clean = url.split("?")[0].split("#")[0]
    if not clean:
        return None, "empty"
    target = (page.parent / clean).resolve()
    return target, "file"


def main() -> int:
    ap = argparse.ArgumentParser(description="telson.dev 站点自检")
    # 默认根目录 = 脚本所在仓库（scripts/ 的上一级），而不是当前工作目录：
    # 用 cwd 会随 shell 位置漂移，扫到别的仓库的 HTML 后产生「缺少 title」这类假报警。
    ap.add_argument(
        "--root",
        default=str(Path(__file__).resolve().parent.parent),
        help="站点根目录（默认脚本所在仓库根目录）",
    )
    ap.add_argument("--live", action="store_true", help="额外检查线上部署（HEAD 每个页面）")
    ap.add_argument("--base-url", default="https://telson.dev", help="线上基础 URL")
    args = ap.parse_args()
    root = Path(args.root).resolve()

    errors: list[str] = []
    warnings: list[str] = []

    html_files = sorted(root.glob("*.html"))
    if not html_files:
        print(f"❌ 在 {root} 下没有找到 *.html")
        return 1

    pages: dict[Path, PageParser] = {}
    for f in html_files:
        pages[f] = parse_page(f)

    # 1) 本地链接 / 资源引用
    checked = 0
    for page, p in pages.items():
        for attr, url in p.links:
            if not is_local(url):
                continue
            target, kind = resolve_local(root, page, url)
            if kind != "file":
                continue
            checked += 1
            if not target.exists():
                errors.append(f"[链接] {page.name}: {attr}=\"{url}\" 目标不存在")

    # 2) 页内锚点（href="#x" 且同页没有 id/name=x）
    for page, p in pages.items():
        for attr, url in p.links:
            if attr != "href" or not url.startswith("#") or len(url) <= 1:
                continue
            anchor = url[1:]
            if anchor not in p.ids:
                errors.append(f"[锚点] {page.name}: href=\"#{anchor}\" 页内没有对应 id/name")

    # 3) sitemap 一致性
    sitemap = root / "sitemap.xml"
    if sitemap.exists():
        sm = read_with_retry(sitemap)
        locs = re.findall(r"<loc>([^<]+)</loc>", sm)
        sm_paths = set()
        for loc in locs:
            u = urlparse(loc)
            rel = u.path.lstrip("/") or "index.html"
            sm_paths.add(rel)
            if not (root / rel).exists():
                errors.append(f"[sitemap] {loc} 对应文件不存在（{rel}）")
        for f in html_files:
            if f.name == "404.html":
                continue
            if f.name not in sm_paths:
                errors.append(f"[sitemap] {f.name} 未收录进 sitemap.xml")
    else:
        warnings.append("[sitemap] 未找到 sitemap.xml")

    # 4) SEO 元数据
    for page, p in pages.items():
        if page.name == "404.html":
            continue
        if not p.title.strip():
            errors.append(f"[SEO] {page.name}: 缺少 <title>")
        if "description" not in p.meta:
            errors.append(f"[SEO] {page.name}: 缺少 meta description")
        if not p.canonical:
            warnings.append(f"[SEO] {page.name}: 缺少 canonical")
        if "og:title" not in p.meta:
            warnings.append(f"[SEO] {page.name}: 缺少 og:title")
        if "og:description" not in p.meta:
            warnings.append(f"[SEO] {page.name}: 缺少 og:description")
        if "og:url" in p.meta and "canonical" in p.meta:
            pass

    # 5) 页内 JSON-LD 合法性（能解析即可）
    import json

    for page, p in pages.items():
        raw = page.read_text(encoding="utf-8")
        for m in re.finditer(
            r'<script type="application/ld\+json">(.*?)</script>', raw, re.S
        ):
            try:
                json.loads(m.group(1))
            except json.JSONDecodeError as e:
                errors.append(f"[JSON-LD] {page.name}: 解析失败 {e}")

    # 输出
    print(f"📄 检查 {len(html_files)} 个页面，本地引用 {checked} 个")

    # 6) 线上部署检查（可选）
    if args.live:
        import time
        import urllib.request

        base = args.base_url.rstrip("/")
        live_urls = [f"{base}/" + rel.lstrip("/") for rel in sorted(sm_paths)]
        live_urls.append(f"{base}/404.html")
        for url in live_urls:
            last_err = None
            for attempt in range(3):  # 重试 3 次，过滤瞬时网络抖动
                try:
                    req = urllib.request.Request(
                        url, method="HEAD", headers={"User-Agent": "check_site"}
                    )
                    with urllib.request.urlopen(req, timeout=20) as r:
                        if r.status != 200:
                            last_err = f"返回 HTTP {r.status}"
                        else:
                            last_err = None
                        break
                except Exception as e:  # noqa: BLE001
                    last_err = str(e)
                    time.sleep(1 + attempt)
            if last_err:
                errors.append(f"[live] {url} 请求失败（重试 3 次）: {last_err}")
        print(f"🌐 线上检查 {len(live_urls)} 个 URL（{base}）")

    for w in warnings:
        print(f"  ⚠️  {w}")


    errors.extend(check_tool_counts(root, pages))
    if errors:
        print(f"\n❌ 发现 {len(errors)} 个问题：")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"\n✅ 全部通过（{len(warnings)} 个警告）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
