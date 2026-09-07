"""Validate generated HTML, crawl paths, sitemap and editorial integrity."""
import json
import sys
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
from xml.etree import ElementTree as ET

from build_site import BASE, Builder, ROOT, first_letter, key

OUT = ROOT / (sys.argv.pop(1) if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else '_site')


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.links, self.canonical, self.h1, self.robots, self.descriptions = [], [], 0, [], []
        self.title, self.in_title = '', False
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'a' and a.get('href'):
            self.links.append(a['href'])
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical.append(a['href'])
        if tag == 'h1':
            self.h1 += 1
        if tag == 'title':
            self.in_title = True
        if tag == 'meta' and a.get('name') == 'robots':
            self.robots.append(a['content'])
        if tag == 'meta' and a.get('name') == 'description':
            self.descriptions.append(a['content'])

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


class BuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pages = {p: Page(p.read_text(encoding='utf-8')) for p in OUT.rglob('*.html') if not p.name.startswith('yandex_')}

    def test_metadata_and_links(self):
        titles = set()
        for file, page in self.pages.items():
            with self.subTest(file=str(file.relative_to(OUT))):
                self.assertEqual(page.h1, 1)
                self.assertEqual(len(page.canonical), 1)
                self.assertEqual(len(page.descriptions), 1)
                self.assertTrue(page.descriptions[0])
                self.assertNotIn(page.title, titles)
                titles.add(page.title)
                for href in page.links:
                    url = urlparse(href)
                    if url.scheme or href.startswith('#'):
                        continue
                    local = unquote(url.path)
                    path = OUT / local.lstrip('/') if local.startswith('/') else file.parent / local
                    if not local:
                        path = file
                    if path.is_dir():
                        path /= 'index.html'
                    self.assertTrue(path.exists(), f'Broken link {href} in {file}')

    def test_sitemap_and_preview(self):
        tree = ET.parse(OUT / 'sitemap.xml')
        urls = [el.text for el in tree.iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertEqual(len(urls), len(set(urls)))
        for url in urls:
            self.assertTrue(url.startswith(BASE))
            self.assertNotIn('?', url)
            path = OUT / url.removeprefix(BASE).lstrip('/')
            if path.is_dir():
                path /= 'index.html'
            self.assertTrue(path.exists())
            page = self.pages[path]
            self.assertNotIn('noindex', ','.join(page.robots))
            self.assertEqual(page.canonical, [url])
        for route in ['qidiruv', 'tanlangan']:
            self.assertIn('noindex', self.pages[OUT / route / 'index.html'].robots[0])
        if OUT.name == '_site':
            self.assertFalse(urls)
            self.assertTrue(all('noindex' in p.robots[0] for p in self.pages.values()))

    def test_names_are_static_and_not_all_published(self):
        editorial = json.loads((ROOT / 'seo/editorial.json').read_text(encoding='utf-8'))
        pages = list((OUT / 'ism').glob('*/index.html'))
        routes = json.loads((OUT / 'routes.json').read_text(encoding='utf-8'))
        self.assertEqual(len(pages), len(routes))
        for k, route in routes.items():
            text = (OUT / route.lstrip('/') / 'index.html').read_text(encoding='utf-8')
            if k not in editorial:
                self.assertIn('data-save-name="', text)
                self.assertIn('DefinedTerm', text)
        for k, entry in editorial.items():
            text = (OUT / 'ism' / entry['slug'] / 'index.html').read_text(encoding='utf-8')
            self.assertIn('data-save-name="' + k + '"', text)
            self.assertNotIn('Behind the Name', text)
            self.assertNotIn('src="/app.js"', text)
            self.assertIn('name_after_sources', text) if OUT.name == '_site' else None

    def test_keys_and_special_letters(self):
        self.assertEqual(key({'g': 'm', 'l': ' O‘tkir '}), "m:o'tkir")
        self.assertEqual(key({'g': 'm', 'l': 'Ali', 'id': 1}), key({'g': 'm', 'l': 'Ali', 'id': 999}))
        for name, letter in [("O‘tkir", "O'"), ("G'ayrat", "G'"), ('Shavkat', 'Sh'), ('Chinor', 'Ch')]:
            self.assertEqual(first_letter(name), letter)

    def test_ad_safety_and_artifact(self):
        self.assertFalse((OUT / 'uz_names.xlsx').exists())
        self.assertFalse((OUT / 'seo/ads.json').exists())
        for p in self.pages:
            text = p.read_text(encoding='utf-8')
            self.assertNotIn('googlesyndication.com/pagead/js', text)
            self.assertNotIn('onclick="ads', text)
        config = (OUT / 'ads-config.js').read_text()
        self.assertNotIn('"mode": "live"', config)
        with self.assertRaises(ValueError):
            Builder(production=True, ads='live')


if __name__ == '__main__':
    unittest.main()
