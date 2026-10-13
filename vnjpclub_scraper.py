#!/usr/bin/env python3
"""
Lấy từ vựng Mimikara N1 từ https://www.vnjpclub.com/mimi-kara-n1-goi/

Cài đặt:
    pip install playwright
    playwright install chromium

Chạy:
    python vnjpclub_scraper.py                   # cả 14 unit
    python vnjpclub_scraper.py --units 1 2 3     # một số unit
    python vnjpclub_scraper.py --headed          # hiện trình duyệt
    python vnjpclub_scraper.py --from-html output/debug-unit-1.html --units 1   # thử trên HTML đã lưu

Kết quả (thư mục output/): unit-N.json, unit-N.csv, all_vocab.csv
Cột: unit, no, word, reading, hanviet, meaning, examples_jp, examples_furigana,
     examples_vi, related
"""
import argparse
import csv
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "https://www.vnjpclub.com/mimi-kara-n1-goi/unit-{}.html"
ALL_UNITS = range(1, 15)
OUT = Path("output")
FIELDS = ["unit", "no", "word", "reading", "hanviet", "meaning",
          "examples_jp", "examples_furigana", "examples_vi", "related"]

# Mỗi từ nằm trong <div class="boxtv">. Chạy trong trình duyệt.
EXTRACT_JS = r"""
() => {
  const plain = el => { const c = el.cloneNode(true);
      c.querySelectorAll('rt,rp').forEach(x => x.remove());
      return c.textContent.replace(/\s+/g, ' ').trim(); };
  const furi = el => { const c = el.cloneNode(true);
      c.querySelectorAll('ruby').forEach(r => {
        const rt = (r.querySelector('rt') || {}).textContent || '';
        const b = r.cloneNode(true); b.querySelectorAll('rt,rp').forEach(x => x.remove());
        r.replaceWith(b.textContent + '（' + rt + '）'); });
      return c.textContent.replace(/\s+/g, ' ').trim(); };
  const kana = el => { const c = el.cloneNode(true);
      c.querySelectorAll('ruby').forEach(r => {
        const rt = (r.querySelector('rt') || {}).textContent || '';
        r.replaceWith(rt); });
      return c.textContent.replace(/\s+/g, ' ').trim(); };
  const strip = s => s.replace(/^\s*\d+\.\s*/, '').trim();

  return [...document.querySelectorAll('div.boxtv')].map(box => {
    const head = box.querySelector(':scope > .tuvung');
    const wEl = head ? (head.querySelector('b') || head) : null;
    const noM = head ? head.textContent.match(/^\s*(\d+)\./) : null;
    const hv = box.querySelector(':scope > .hanviet1, :scope > .hanviet2');
    const ng = box.querySelector(':scope > .nghia1, :scope > .nghia2');
    const exJp = [], exFu = [], exVi = [], rel = [];
    box.querySelectorAll('.vidubox .tuvung').forEach(t => {
      const m = t.nextElementSibling;
      const vi = (m && m.classList.contains('nghiavidu')) ? m.textContent.trim() : '';
      const lab = t.querySelector('.lienquan');
      const c = t.cloneNode(true);
      c.querySelectorAll('.viduseq,.lienquan').forEach(x => x.remove());
      if (lab) {
        rel.push(lab.textContent.trim() + ' ' + furi(c) + (vi ? ' : ' + vi : ''));
      } else {
        exJp.push(plain(c)); exFu.push(furi(c)); exVi.push(vi);
      }
    });
    return {
      no: noM ? parseInt(noM[1]) : null,
      word: wEl ? strip(plain(wEl)) : '',
      reading: wEl ? kana(wEl) : '',
      hanviet: hv ? hv.textContent.trim() : '',
      meaning: ng ? ng.textContent.trim() : '',
      examples_jp: exJp.join('\n'),
      examples_furigana: exFu.join('\n'),
      examples_vi: exVi.join('\n'),
      related: rel.join('\n'),
    };
  });
}
"""


def scrape_page(page, n):
    try:
        page.wait_for_selector("div.boxtv", timeout=30000)
    except Exception:
        print(f"unit {n}: không thấy div.boxtv (có thể cần đăng nhập/VIP)", file=sys.stderr)
    for _ in range(10):          # cuộn để kích hoạt lazy-load
        page.mouse.wheel(0, 5000)
        time.sleep(0.3)
    rows = page.evaluate(EXTRACT_JS)
    for r in rows:
        r["unit"] = n
    return rows


def scrape_unit(page, n, debug):
    page.goto(BASE.format(n), wait_until="commit", timeout=90000)
    try:
        page.wait_for_load_state("domcontentloaded", timeout=60000)
    except Exception:
        pass
    rows = scrape_page(page, n)
    if debug:
        OUT.mkdir(exist_ok=True)
        (OUT / f"debug-unit-{n}.html").write_text(page.content(), encoding="utf-8")
    return rows


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--units", type=int, nargs="*", default=list(ALL_UNITS))
    ap.add_argument("--debug", action="store_true", help="lưu HTML đã render")
    ap.add_argument("--headed", action="store_true", help="hiện cửa sổ trình duyệt")
    ap.add_argument("--login-wait", action="store_true",
                    help="mở trình duyệt, chờ bạn đăng nhập rồi nhấn Enter")
    ap.add_argument("--from-html", help="đọc file HTML đã lưu thay vì tải trang (thử nghiệm)")
    args = ap.parse_args()

    OUT.mkdir(exist_ok=True)
    all_rows = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not (args.headed or args.login_wait))
        ctx = browser.new_context(locale="vi-VN")
        ctx.route("**/*", lambda r: r.abort() if any(
            h in r.request.url for h in ("googlesyndication", "doubleclick",
                                         "google-analytics", "googletagmanager",
                                         "adsbygoogle", "facebook.net")
        ) else r.continue_())
        page = ctx.new_page()

        if args.from_html:
            page.goto(Path(args.from_html).resolve().as_uri())
            n = args.units[0]
            rows = page.evaluate(EXTRACT_JS)
            for r in rows:
                r["unit"] = n
            print(f"unit {n}: {len(rows)} từ (từ file HTML)")
            all_rows = rows
            (OUT / f"unit-{n}.json").write_text(
                json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
            write_csv(OUT / f"unit-{n}.csv", rows)
        else:
            if args.login_wait:
                page.goto("https://www.vnjpclub.com/")
                input("Đăng nhập xong thì nhấn Enter ở đây... ")
            for n in args.units:
                try:
                    rows = scrape_unit(page, n, args.debug)
                except Exception as e:
                    print(f"unit {n}: lỗi {e}", file=sys.stderr)
                    continue
                print(f"unit {n}: {len(rows)} từ")
                (OUT / f"unit-{n}.json").write_text(
                    json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
                write_csv(OUT / f"unit-{n}.csv", rows)
                all_rows += rows
        browser.close()

    if all_rows:
        write_csv(OUT / "all_vocab.csv", all_rows)
        print(f"Xong: {len(all_rows)} từ -> {OUT / 'all_vocab.csv'}")


if __name__ == "__main__":
    main()
