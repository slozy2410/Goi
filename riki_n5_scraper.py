#!/usr/bin/env python3
"""
Lấy toàn bộ bài "Tổng hợp ngữ pháp N5" của Riki và các bài con được link trong đó
từ https://riki.edu.vn/goc-chia-se/tong-hop-ngu-phap-n5/

Cài đặt:
    pip install requests beautifulsoup4 markdownify

Chạy:
    python riki_n5_scraper.py                # trang tổng hợp + mọi bài con
    python riki_n5_scraper.py --no-children  # chỉ trang tổng hợp
    python riki_n5_scraper.py --delay 2      # giãn cách giữa các request (giây)

Kết quả (thư mục output/riki-n5/):
    index.json            danh sách bài: section, title, url, file
    pages/<slug>.md       nội dung từng bài dạng Markdown
    pages/<slug>.html     HTML gốc phần nội dung bài
    all.json              toàn bộ (url, title, section, markdown, text)
"""
import argparse
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from markdownify import markdownify

HUB = "https://riki.edu.vn/goc-chia-se/tong-hop-ngu-phap-n5/"
PREFIX = "https://riki.edu.vn/goc-chia-se/"
OUT = Path("output/riki-n5")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"}
SKIP = re.compile(r"/(wp-content|wp-admin|category|tag|author|page)/|\.(png|jpe?g|gif|webp|pdf)$", re.I)
CONTENT_SEL = "#ftwp-postcontent, .elementor-widget-theme-post-content, .entry-content"


def fetch(session, url):
    for attempt in range(3):
        try:
            r = session.get(url, headers=UA, timeout=30)
            if r.status_code == 404:
                print("  ! 404 - trang không tồn tại")
                return None
            r.raise_for_status()
            r.encoding = "utf-8"
            return r.text
        except requests.RequestException as e:
            print(f"  ! lỗi {e} (thử lại {attempt + 1}/3)")
            time.sleep(3 * (attempt + 1))
    return None


def parse(html):
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    title = h1.get_text(" ", strip=True) if h1 else (soup.title.string or "").strip()
    body = soup.select_one(CONTENT_SEL)
    if body is None:
        return title, None
    for bad in body.select("script, style, iframe, noscript"):
        bad.decompose()
    return title, body


def norm(url):
    u = urlparse(url)
    path = u.path if u.path.endswith("/") else u.path + "/"
    return f"{u.scheme}://{u.netloc}{path}"


def child_links(body, base):
    """(section, anchor text, url) theo thứ tự xuất hiện, gắn với tiêu đề h2/h3 gần nhất."""
    seen, out, section = set(), [], ""
    for el in body.find_all(["h2", "h3", "a"]):
        if el.name in ("h2", "h3"):
            section = el.get_text(" ", strip=True)
            continue
        href = el.get("href")
        if not href:
            continue
        url = norm(urljoin(base, href.split("#")[0]))
        if not url.startswith(PREFIX) or SKIP.search(url) or url == norm(HUB) or url in seen:
            continue
        seen.add(url)
        out.append((section, el.get_text(" ", strip=True), url))
    return out


def slug(url):
    return urlparse(url).path.rstrip("/").split("/")[-1] or "index"


def save(url, title, body, section, pages):
    s = slug(url)
    html = str(body)
    md = markdownify(html, heading_style="ATX").strip()
    md = re.sub(r"\n{3,}", "\n\n", md)
    (pages / f"{s}.html").write_text(html, encoding="utf-8")
    (pages / f"{s}.md").write_text(f"# {title}\n\nNguồn: {url}\n\n{md}\n", encoding="utf-8")
    return {"section": section, "title": title, "url": url, "file": f"pages/{s}.md",
            "markdown": md, "text": body.get_text("\n", strip=True)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-children", action="store_true")
    ap.add_argument("--delay", type=float, default=1.0)
    args = ap.parse_args()

    pages = OUT / "pages"
    pages.mkdir(parents=True, exist_ok=True)
    session = requests.Session()

    print(f"Trang tổng hợp: {HUB}")
    html = fetch(session, HUB)
    if html is None:
        raise SystemExit("Không tải được trang tổng hợp")
    title, body = parse(html)
    links = child_links(body, HUB)  # lấy link trước khi markdownify
    records = [save(norm(HUB), title, body, "Tổng hợp", pages)]
    print(f"  {len(links)} bài con")

    if not args.no_children:
        for i, (section, text, url) in enumerate(links, 1):
            time.sleep(args.delay)
            print(f"[{i}/{len(links)}] {url}")
            page = fetch(session, url)
            if page is None:
                continue
            t, b = parse(page)
            if b is None:
                print("  ! không thấy nội dung bài, bỏ qua")
                continue
            records.append(save(url, t or text, b, section, pages))

    index = [{k: r[k] for k in ("section", "title", "url", "file")} for r in records]
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "all.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Xong: {len(records)} bài -> {OUT.resolve()}")


if __name__ == "__main__":
    main()
