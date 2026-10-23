#!/usr/bin/env python3
"""Build the English mirror (en/*.html) from the Russian source pages and keep hreflang in sync.

The Russian pages in the repository root are the source of truth: every page carries both
languages inside data-lang="ru" / data-lang="en" elements. This script
  1. adds language metadata to the Russian pages (data-page-lang, hreflang alternates), and
  2. writes en/<page>.html: English-only markup (Russian elements removed), English title,
     description and Open Graph tags, canonical /en/..., assets as absolute paths.
Run from the repository root after editing any Russian page:  python3 tools/build_en.py
"""
import pathlib
import re
import sys

from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://aldemarine.vnemo.co"
PAGES = ["index", "services", "marine-supply", "marine-surveys", "mws", "class-registry",
         "project-cargo", "custom-software", "about", "contact", "rfq"]


def urls(page):
    ru = BASE + "/" if page == "index" else f"{BASE}/{page}.html"
    en = BASE + "/en/" if page == "index" else f"{BASE}/en/{page}.html"
    return ru, en


def alternates(page):
    ru, en = urls(page)
    return (f'<link rel="alternate" hreflang="ru" href="{ru}">\n'
            f'<link rel="alternate" hreflang="en" href="{en}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{ru}">\n')


def prepare_russian(page):
    """Idempotently mark the Russian page and give it hreflang alternates."""
    p = ROOT / f"{page}.html"
    s = p.read_text(encoding="utf-8")
    if 'data-page-lang="ru"' not in s:
        s = s.replace('<html lang="ru"', '<html lang="ru" data-page-lang="ru"', 1)
    s = re.sub(r'<link rel="alternate" hreflang="[^"]+" href="[^"]+">\n', "", s)
    s = re.sub(r'(<link rel="canonical" href="[^"]+">\n)', lambda m: m.group(1) + alternates(page), s, count=1)
    assert 'hreflang="en"' in s, page
    p.write_text(s, encoding="utf-8")
    return s


def build_english(page, source):
    soup = BeautifulSoup(source, "html.parser")
    html = soup.html
    ru_url, en_url = urls(page)
    html["lang"] = "en"
    html["data-page-lang"] = "en"
    html["data-lang-active"] = "en"
    title = html.get("data-title-en") or soup.title.string
    desc = html.get("data-description-en")
    soup.title.string = title
    for attr in ("data-title-ru", "data-description-ru"):
        html.attrs.pop(attr, None)
    md = soup.find("meta", attrs={"name": "description"})
    if md and desc:
        md["content"] = desc
    for prop, val in (("og:title", title), ("og:description", desc), ("og:url", en_url)):
        tag = soup.find("meta", attrs={"property": prop})
        if tag and val:
            tag["content"] = val
    og_type = soup.find("meta", attrs={"property": "og:type"})
    if og_type and not soup.find("meta", attrs={"property": "og:locale"}):
        loc = soup.new_tag("meta", property="og:locale", content="en_US")
        og_type.insert_after(loc)
    canon = soup.find("link", rel="canonical")
    if canon:
        canon["href"] = en_url
    for el in soup.find_all(attrs={"data-lang": "ru"}):
        el.decompose()
    for o in soup.find_all("option", attrs={"data-en": True}):
        o.string = o["data-en"]
    for el in soup.find_all(attrs={"data-label-en": True}):
        el["aria-label"] = el["data-label-en"]
    for el in soup.find_all(attrs={"data-ph-en": True}):
        el["placeholder"] = el["data-ph-en"]
    for tag in soup.find_all(True):
        label = tag.get("aria-label")
        if label and re.search(r"[А-Яа-яЁё]", label) and " / " in label:
            tag["aria-label"] = label.split(" / ")[0]          # bilingual label: keep the English half
        for attr in ("data-label-ru", "data-ph-ru", "data-ru"):
            tag.attrs.pop(attr, None)
        for attr in ("src", "href"):
            v = tag.get(attr)
            if not v:
                continue
            if v.startswith("assets/"):
                tag[attr] = "/" + v
            elif v == "/":
                tag[attr] = "/en/"
    out = ROOT / "en" / f"{page}.html"
    out.write_text(str(soup), encoding="utf-8")
    return out


def write_sitemap():
    rows = []
    for page in PAGES:
        for ru_or_en in urls(page):
            ru, en = urls(page)
            rows.append(
                f"  <url><loc>{ru_or_en}</loc>\n"
                f'    <xhtml:link rel="alternate" hreflang="ru" href="{ru}"/>\n'
                f'    <xhtml:link rel="alternate" hreflang="en" href="{en}"/>\n'
                f'    <xhtml:link rel="alternate" hreflang="x-default" href="{ru}"/>\n  </url>')
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
           'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(rows) + "\n</urlset>\n")
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")


def main():
    (ROOT / "en").mkdir(exist_ok=True)
    for page in PAGES:
        source = prepare_russian(page)
        print("built", build_english(page, source).relative_to(ROOT))
    write_sitemap()
    print("sitemap.xml updated")


if __name__ == "__main__":
    sys.exit(main())
