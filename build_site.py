"""Build static SEO pages and an ad-safe preview. Python standard library only."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import quote, urlencode

ROOT = Path(__file__).resolve().parent
BASE = 'https://bolagaism.uz'
ALPHABET = list('ABDEFGHIJKLMNOPQRSTUVXYZ') + ["O'", "G'", 'Sh', 'Ch']
GROUPS = {'m': ('ogil-bola-ismlari', "O'g'il bolalar ismlari"), 'f': ('qiz-bola-ismlari', 'Qiz bolalar ismlari')}
PAGE_SIZE = 48


def norm(value):
    return re.sub(r"[‘ʻ`’ʼ]", "'", value).strip().lower()


def key(item):
    return item['g'] + ':' + norm(item['l'])


def first_letter(value):
    value = norm(value)
    part = next((p for p in ["o'", "g'", 'sh', 'ch'] if value.startswith(p)), value[:1])
    return part.capitalize()


def letter_slug(letter):
    return letter.lower().replace("'", '-tutuq')


def esc(value):
    return html.escape(str(value), quote=True)


def js_json(value):
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c')


class Builder:
    def __init__(self, production=False, ads='preview', data=None):
        self.production = production
        self.out = ROOT / ('_site-production' if production else '_site')
        self.out.mkdir(exist_ok=True)
        self.previous = json.loads((self.out / '.build-manifest.json').read_text()) if (self.out / '.build-manifest.json').exists() else []
        self.files, self.urls = set(), []
        self.ads_mode = ads
        self.ads = json.loads((ROOT / 'seo/ads.json').read_text(encoding='utf-8'))
        self.source_policy = json.loads((ROOT / 'seo/source-policy.json').read_text(encoding='utf-8'))
        if ads == 'live' and (not production or not self.ads['consent_setup_verified']):
            raise ValueError('Live ads require --production and a verified certified CMP/account setup in seo/ads.json.')
        if ads == 'live':
            slots = [p['slot'] for p in self.ads['placements'].values()]
            if any(not s or not re.fullmatch(r'\d+', s) for s in slots) or len(slots) != len(set(slots)):
                raise ValueError('Configure a distinct real AdSense slot ID for every placement before enabling live ads.')
        self.editorial = json.loads((ROOT / 'seo/editorial.json').read_text(encoding='utf-8'))
        self.routes = {}
        used = set()
        for k, entry in self.editorial.items():
            slug = entry['slug']
            if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug) or slug in used:
                raise ValueError(f'Invalid or duplicate permanent slug: {slug}')
            if not entry.get('sources') or not entry.get('reviewed'):
                raise ValueError(f'Editorial entry lacks sources/review date: {k}')
            used.add(slug)
            self.routes[k] = '/ism/' + slug + '/'
        data_path = Path(data) if data else (ROOT / 'names.json' if (ROOT / 'names.json').exists() else ROOT / 'names_data.js')
        raw = data_path.read_text(encoding='utf-8-sig')
        if data_path.suffix == '.js':
            raw = re.sub(r'^window\.ALL_NAMES\s*=\s*', '', raw).rstrip().removesuffix(';')
        self.names = json.loads(raw)
        self.audit = {'input_count': len(self.names), 'duplicates': [], 'empty_meanings': [], 'invalid_records': [], 'editorial_changes': [], 'editorial_additions': []}
        existing_keys = {key(n) for n in self.names if isinstance(n.get('l'), str) and n.get('g') in GROUPS}
        next_id = max(n['id'] for n in self.names) + 1
        for k, entry in self.editorial.items():
            if k not in existing_keys:
                gender, spelling = k.split(':', 1)
                self.names.append({'id': next_id, 'g': gender, 'l': spelling.capitalize(), 'lang': entry['origin'], 'm': entry['meaning']})
                self.audit['editorial_additions'].append(k)
                next_id += 1
        by_key = {}
        for item in self.names:
            if not isinstance(item.get('l'), str) or not item['l'].strip() or item.get('g') not in GROUPS:
                self.audit['invalid_records'].append(item.get('id'))
                continue
            if not item.get('m') or item['m'] == 'Malumot kiritilmagan.':
                self.audit['empty_meanings'].append(item['id'])
            k = key(item)
            if k in by_key:
                self.audit['duplicates'].append({'key': k, 'ids': [by_key[k]['id'], item['id']]})
            else:
                by_key[k] = item
            if k in self.editorial:
                entry = self.editorial[k]
                self.audit['editorial_changes'].append({'key': k, 'before': item.get('m'), 'after': entry['meaning']})
                item['m'], item['lang'] = entry['meaning'], entry['origin']
                if entry.get('k'):
                    item['k'] = entry['k']
            item.pop('v', None)
            if k in self.routes:
                item['url'] = self.routes[k]
        missing = set(self.editorial) - set(by_key)
        if missing or self.audit['invalid_records']:
            raise ValueError(f'Data validation failed: missing editorial keys={missing}, invalid={self.audit["invalid_records"]}')
        self.unique = sorted(by_key.values(), key=lambda n: norm(n['l']))
        self.by_key = by_key
        for k, item in by_key.items():
            if k not in self.routes:
                slug = re.sub(r'[^a-z0-9]+', '-', norm(item['l'])).strip('-') or 'ism'
                self.routes[k] = '/ism/' + slug + '-' + hashlib.sha256(k.encode()).hexdigest()[:12] + '/'
        self.audit['unique_count'] = len(self.unique)
        self.audit['remaining_editorial_review'] = len(self.unique) - len(self.editorial)
        self.audit['repeated_meanings'] = [{'meaning': m, 'count': c} for m, c in Counter(n.get('m', '') for n in self.unique).items() if c > 1]

    def write(self, path, content):
        target = self.out / path
        if not target.resolve().is_relative_to(self.out.resolve()) or target.is_symlink():
            raise ValueError('Unsafe output path')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf-8')
        self.files.add(path)

    def href(self, item):
        return self.routes.get(key(item), '/?' + urlencode({'ism': key(item)}))

    def ad(self, placement):
        if self.ads_mode == 'off':
            return ''
        config = self.ads['placements'][placement]
        placeholder = '<div class="ad-placeholder">Reklama joyi<small>Namuna · haqiqiy reklama emas</small></div>' if self.ads_mode == 'preview' else ''
        slot = f' data-slot="{esc(config["slot"])}"' if self.ads_mode == 'live' else ''
        return f'<aside class="ad-placement" aria-label="Reklama" data-placement="{placement}"{slot}><span class="ad-label">Reklama</span><div class="ad-space {config["size"]}">{placeholder}</div></aside>'

    def head(self, title, description, path, noindex=False, crumbs=None, main_entity=None, modified=None):
        noindex = noindex or not self.production
        schema = [{'@context': 'https://schema.org', '@type': 'WebPage', 'name': title, 'description': description, 'url': BASE + path, 'inLanguage': 'uz', 'isPartOf': {'@type': 'WebSite', 'name': 'Bolagaism.uz', 'url': BASE + '/'}}]
        if main_entity:
            schema[0]['mainEntity'] = main_entity
        if modified:
            schema[0]['dateModified'] = modified
        if crumbs:
            schema.append({'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': label, 'item': BASE + url} for i, (label, url) in enumerate(crumbs)]})
        return f'''<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title><meta name="description" content="{esc(description)}">
<meta name="robots" content="{'noindex, follow' if noindex else 'index, follow'}">
<link rel="canonical" href="{BASE}{esc(path)}"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{BASE}{esc(path)}"><meta property="og:image" content="{BASE}/social-card.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Bolagaism.uz — O'zbek ismlari"><meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/seo.css"><link rel="stylesheet" href="/design.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@600;700&amp;family=Nunito:wght@400;600;700;800&amp;display=swap" rel="stylesheet">
<script type="application/ld+json">{js_json(schema)}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-WMMETC5LY8"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag('js',new Date());gtag('config','G-WMMETC5LY8');</script>
<script>(function(m,e,t,r,i,k,a){{m[i]=m[i]||function(){{(m[i].a=m[i].a||[]).push(arguments)}};m[i].l=1*new Date();k=e.createElement(t);a=e.getElementsByTagName(t)[0];k.async=1;k.src=r;a.parentNode.insertBefore(k,a)}})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');ym(112365590,'init',{{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true}});</script>'''

    def page(self, path, title, description, body, crumbs=None, gender='', noindex=False, modified=None, main_entity=None):
        head = self.head(title, description, path, noindex, crumbs, main_entity, modified)
        breadcrumb = '<nav class="breadcrumbs" aria-label="Sahifa yo‘li">' + ' <span aria-hidden="true">›</span> '.join(f'<a href="{esc(url)}">{esc(label)}</a>' if i < len(crumbs) - 1 else f'<span aria-current="page">{esc(label)}</span>' for i, (label, url) in enumerate(crumbs)) + '</nav>' if crumbs else ''
        banner = '<div class="preview-banner">Ko‘rib chiqish uchun namuna · reklama joylari ko‘rsatilgan</div>' if not self.production else ''
        doc = f'''<!doctype html><html lang="uz"><head>{head}</head><body class="gender-{gender}">
<a class="skip-link" href="#main">Asosiy matnga o'tish</a>{banner}
<header class="sticky-header"><div class="header-container"><div class="brand-row"><a class="brand-logo" href="/"><span class="logo-icon">🍼</span><span class="logo-text">BolagaIsm<span class="logo-tld">.uz</span></span></a><nav class="nav-actions" aria-label="Asosiy"><a class="nav-pill icon-nav" href="/qidiruv/" aria-label="Qidiruv" title="Qidiruv">🔍</a><a class="nav-pill favorite-nav" href="/tanlangan/" aria-label="Tanlangan ismlar"><span aria-hidden="true">❤️</span> <span data-fav-count>0</span></a></nav></div></div></header>
<main id="main" class="page-shell">{breadcrumb}{body}</main>
<footer class="site-footer"><div class="container"><strong>Bolagaism.uz</strong><p>Farzandingiz uchun ma'noli ism tanlang.</p><nav class="footer-links"><a href="/ogil-bola-ismlari/">O'g'il bolalar</a><a href="/qiz-bola-ismlari/">Qiz bolalar</a><a href="/manbalar/">Manbalar</a><a href="/about.html">Biz haqimizda</a><a href="/contact.html">Bog'lanish</a><a href="/privacy.html">Maxfiylik siyosati</a><a href="/terms.html">Foydalanish shartlari</a></nav><p class="footer-source">«O'zbek ismlari ma'nosi» — Begmatov E.A. O'zbekiston Milliy Ensiklopediyasi. Davlat ilmiy nashriyoti, 2007. Formulirovkalar Bolagaism.uz tahririyati tomonidan qayta bayon qilingan.</p><p>© 2026 Bolagaism.uz</p></div></footer>
<script src="/page.js" defer></script><script src="/ads-config.js"></script><script src="/ads.js" defer></script></body></html>'''
        filename = path.lstrip('/') + 'index.html' if path.endswith('/') else path.lstrip('/')
        self.write(filename, doc)
        if not noindex:
            self.urls.append((path, modified))

    def tile(self, item):
        return f'<a class="catalog-name concept-name {item["g"]}" href="{esc(self.href(item))}"><span class="name-initial" aria-hidden="true">{esc(item["l"][0])}</span><h2>{esc(item["l"])}</h2><p>{esc(item.get("m", ""))}</p><small>{esc(item.get("lang", ""))}</small><span class="read-more">Ism haqida batafsil →</span></a>'

    def search_form(self):
        return '<form class="concept-search" action="/qidiruv/"><span aria-hidden="true">🔍</span><input aria-label="Ism qidirish" name="q" placeholder="Masalan: Muhammad" type="search" required><button>Qidirish</button></form>'

    def alphabet(self, gender, selected=None):
        slug = GROUPS[gender][0]
        letters = {first_letter(n['l']) for n in self.unique if n['g'] == gender}
        return '<nav class="alphabet-links" aria-label="Alifbo">' + ''.join(f'<a href="/{slug}/{letter_slug(l)}/"' + (' aria-current="page"' if l == selected else '') + f'>{esc(l)}</a>' for l in ALPHABET if l in letters) + '</nav>'

    def catalogs(self):
        for gender, (slug, label) in GROUPS.items():
            group = [n for n in self.unique if n['g'] == gender]
            body = f'<section class="catalog-top"><span class="eyebrow">Ismlar katalogi</span><h1>{esc(label)}</h1><p>{len(group):,} ta ism: ma’nosi va kelib chiqishini solishtiring. Harfni tanlang yoki qidiruvdan foydalaning.</p>{self.alphabet(gender)}</section>' + self.search_form()
            featured = [n for n in group if key(n) in self.editorial]
            body += '<section><h2>Ko‘nglingizga yaqin ismni toping</h2><div class="concept-names">' + ''.join(self.tile(n) for n in featured) + '</div></section>' + (ROOT / 'seo/guide.html').read_text(encoding='utf-8')
            self.page('/' + slug + '/', label + ' va ma’nolari | Bolagaism.uz', label + ': harflar bo‘yicha katalog, ma’nosi va kelib chiqishi.', body, [('Bosh sahifa', '/'), (label, '/' + slug + '/')], gender)
            buckets = defaultdict(list)
            for item in group:
                buckets[first_letter(item['l'])].append(item)
            for letter, items in buckets.items():
                pages = (len(items) + PAGE_SIZE - 1) // PAGE_SIZE
                root = f'/{slug}/{letter_slug(letter)}/'
                for page in range(1, pages + 1):
                    path = root if page == 1 else root + f'sahifa/{page}/'
                    title = f'{letter} harfi bilan boshlanuvchi {label.lower()}'
                    body = f'<h1>{esc(title)}</h1><p>{len(items)} ta ism · {page}/{pages}-sahifa</p>{self.alphabet(gender, letter)}<div class="name-list">'
                    visible = items[(page - 1) * PAGE_SIZE:page * PAGE_SIZE]
                    for i, item in enumerate(visible, 1):
                        body += self.tile(item)
                        if i == 12 and len(visible) >= 18:
                            body += self.ad('catalog_after_12')
                        if i == 36 and len(visible) >= 44:
                            body += self.ad('catalog_after_36')
                    body += '</div><nav class="pagination" aria-label="Sahifalar">'
                    for p in range(1, pages + 1):
                        url = root if p == 1 else root + f'sahifa/{p}/'
                        body += f'<span aria-current="page">{p}</span>' if p == page else f'<a href="{url}">{p}</a>'
                    body += '</nav>'
                    self.page(path, title + (f' — {page}-sahifa' if page > 1 else '') + ' | Bolagaism.uz', f'{title}. {page}-sahifa: ' + ', '.join(n['l'] for n in visible[:5]) + ' va boshqa ismlar.', body, [('Bosh sahifa', '/'), (label, '/' + slug + '/'), (letter + (f' · {page}' if page > 1 else ''), path)], gender)

    def name_pages(self):
        for k, item in self.by_key.items():
            entry = self.editorial.get(k, {'meaning': item.get('m') or 'Ma’no hali kiritilmagan.', 'origin': item.get('lang') or 'Aniqlanmagan', 'note': '', 'variants': '', 'reviewed': None})
            item = self.by_key[k]
            path = self.routes[k]
            slug, group = GROUPS[item['g']]
            share = 'https://t.me/share/url?' + urlencode({'url': BASE + path, 'text': f'{item["l"]} — {entry["meaning"]}'})
            metadata = f'<dl class="detail-facts"><div class="detail-fact fact-gender"><dt>Jinsi</dt><dd>{"O‘g‘il bola" if item["g"] == "m" else "Qiz bola"}</dd></div><div class="detail-fact fact-origin"><dt>Kelib chiqishi</dt><dd>{esc(entry["origin"])}</dd></div></dl>'
            if entry.get('k'):
                metadata += f'<span>Kirillcha: {esc(entry["k"])}</span>'
            body = f'''<article class="concept-detail"><div class="detail-banner"><span class="name-initial" aria-hidden="true">{esc(item['l'][0])}</span><h1><strong>{esc(item['l'])}</strong> ismining ma’nosi</h1>{metadata}</div><div class="detail-content"><p class="meaning-caption">Ma’nosi</p><p class="meaning-lead">{esc(entry['meaning'])}</p>
<div class="detail-sections"><section><h2>Kelib chiqishi</h2><p>{esc(entry['note'])}</p></section><section><h2>Yozilish variantlari</h2><p>{esc(entry['variants'])}</p></section></div>
<div class="action-row action-row-bottom"><button data-save-name="{esc(k)}" data-name-label="{esc(item['l'])}" aria-pressed="false">♡ Tanlanganlarga qo'shish</button><a class="primary" href="{esc(share)}" target="_blank" rel="noopener">Telegramda ulashish</a></div><div class="status-message" role="status" data-save-status></div></article>'''
            body = body.replace('</article>', '</div></article>')
            if not entry['note']:
                body = body.replace('<section><h2>Kelib chiqishi</h2><p></p></section>', '')
            if not entry['variants']:
                body = body.replace('<section><h2>Yozilish variantlari</h2><p></p></section>', '')
            body += self.ad('name_after_sources')
            related = [self.by_key[r] for r in self.editorial if self.by_key[r]['g'] == item['g'] and r != k][:3]
            body += '<section><h2>Yana ko‘rib chiqing</h2><div class="related-grid">' + ''.join(self.tile(n) for n in related) + '</div></section>'
            body += f'<p><a href="/{slug}/{letter_slug(first_letter(item["l"]))}/">{esc(first_letter(item["l"]))} harfi bilan boshlanuvchi boshqa ismlar →</a></p>'
            entity = {'@type': 'DefinedTerm', 'name': item['l'], 'description': entry['meaning'], 'inDefinedTermSet': {'@type': 'DefinedTermSet', 'name': 'Bolagaism.uz ismlar katalogi', 'url': BASE + '/' + slug + '/'}}
            indexed = k in self.editorial or self.source_policy.get('global_source_applies', False)
            self.page(path, item['l'] + ' ismining ma’nosi' + (' — ' + group if k not in self.editorial else '') + ' | Bolagaism.uz', item['l'] + ': ' + entry['meaning'], body, [('Bosh sahifa', '/'), (group, '/' + slug + '/'), (item['l'], path)], item['g'], noindex=not indexed, modified=entry.get('reviewed'), main_entity=entity)

    def support_pages(self):
        self.page('/qidiruv/', 'Ism qidirish | Bolagaism.uz', 'Ismlar katalogidan qidiring.', '<h1>Ism qidirish</h1><form class="search-panel" action="/qidiruv/"><label for="name-search">Ismni yozing</label><input id="name-search" name="q" type="search" autocomplete="off" placeholder="Masalan: Muhammad" aria-describedby="search-status"><div class="search-filters"><label>Jinsi <select id="filter-gender" name="gender"><option value="">Barchasi</option><option value="m">O‘g‘il bola</option><option value="f">Qiz bola</option></select></label><button type="reset" class="nav-pill">Tozalash</button></div><noscript><p>Qidiruv uchun JavaScript kerak. <a href="/ogil-bola-ismlari/">Alifbo katalogidan foydalaning</a>.</p></noscript></form><p class="search-status" id="search-status" role="status"></p><div id="search-results" class="name-list"></div><button class="nav-pill" id="search-more" hidden>Yana 50 ta</button>', noindex=True)
        self.page('/tanlangan/', 'Tanlangan ismlar | Bolagaism.uz', 'Saqlangan ismlar ro‘yxati.', '<h1>Tanlangan ismlar</h1><p>Tanlangan ismlar shu brauzerda saqlanadi. Brauzer ma’lumotlari tozalansa, ro‘yxat o‘chadi.</p><p id="favorite-status" role="status"></p><div id="favorite-results" class="name-list"></div><noscript><p>Tanlangan ismlarni ko‘rish uchun JavaScript kerak.</p></noscript>', noindex=True)
        self.page('/404.html', 'Sahifa topilmadi | Bolagaism.uz', 'Sahifa topilmadi.', '<div class="paper"><span class="eyebrow">404</span><h1>Sahifa topilmadi</h1><p>Manzil o‘zgargan yoki xato yozilgan bo‘lishi mumkin.</p><div class="action-row"><a class="primary" href="/qidiruv/">Ism qidirish</a><a href="/">Bosh sahifa</a></div></div>', noindex=True)
        body = '''<article class="paper readable"><h1>Ismlar ma’nosi: manbalar va tekshirish</h1><p>Bolagaism.uz ismlarni tanlash va ularning ma’nosini solishtirish uchun yaratilgan. Katalogdagi o‘zbek ismlari ma’no va kelib chiqish bo‘yicha «O'zbek ismlari ma'nosi» — Begmatov E.A. O'zbekiston Milliy Ensiklopediyasi. Davlat ilmiy nashriyoti, 2007 nashridan ma’lumotnoma asosi sifatida foydalanadi.</p><h2>Ma’lumotlar qanday tayyorlanadi?</h2><p>Kitobdagi ma’nolar sayt uchun qisqa va tushunarli o‘zbekcha shaklda qayta bayon qilinadi; matn so‘zma-so‘z ko‘chirilmaydi. Ism sahifalarining pastida umumiy bibliografik manba kichik yozuvda ko‘rsatiladi. Ayrim tahririy sahifalarda qo‘shimcha ochiq manbalar bilan solishtirish ham berilgan.</p><h2>Izoh qanday tayyorlanadi?</h2><p>Ma’no, kelib chiqishi va yozilish variantlari alohida ko‘rsatiladi. Bahsli etimologiya taxmin sifatida bayon qilinadi. Ismdan kelib chiqib bolaning fe’l-atvori yoki kelajagi haqida xulosa qilinmaydi.</p><h2>Tuzatish yuborish</h2><p>Xato ko‘rsangiz, ismni, taklif etilgan tuzatishni va manba havolasini <a href="/contact.html">aloqa sahifasi orqali</a> yuboring.</p></article>'''
        self.page('/manbalar/', 'Manbalar va tekshirish usuli | Bolagaism.uz', 'Ismlar izohining manbalari, tekshirish usuli va tuzatish yuborish.', body, [('Bosh sahifa', '/'), ('Manbalar', '/manbalar/')])
        body = '''<article class="paper readable"><span class="eyebrow">Ota-onalar uchun</span><h1>Farzandingizga ism tanlash</h1><p>Ism tanlashda oilangiz uchun muhim bo‘lgan ma’no, qulay talaffuz va yozilishni birgalikda ko‘rib chiqing. Quyidagi oddiy tartib variantlarni solishtirishga yordam beradi.</p><section><h2>Avval kichik ro‘yxat tuzing</h2><p>Bir necha yoqqan ismni tanlanganlarga qo‘shing. Har birining ma’nosini o‘qing va sizga aynan nimasi yoqqanini yozib qo‘ying. Ma’nosi muhim bo‘lsa, uning manbasi borligini ham tekshiring.</p></section><section><h2>Familiya bilan birga ayting</h2><p>Ismni familiya bilan ovoz chiqarib aytib ko‘ring. Kundalik murojaatda talaffuzi sizga qulaymi? Oila a’zolari uni qanday qisqartirishini ham muhokama qilishingiz mumkin.</p></section>'''
        body += self.ad('article_after_section')
        body += '''<section><h2>Yozilish variantlarini solishtiring</h2><p>Lotin va kirill yozuvida ishlatadigan shaklingizni oldindan kelishib oling. Bir ism turli tillarda turlicha yozilishi mumkin; o‘xshash yozilgan barcha ismlar bir xil ma’noni anglatmaydi.</p></section><section><h2>Tanlovni birgalikda muhokama qiling</h2><p>Yoqtirgan ismingiz sahifasini Telegram orqali yaqinlaringizga yuborishingiz mumkin. Tanlanganlar shu brauzerda saqlanadi, shuning uchun yakuniy ro‘yxatingizni alohida yozib qo‘yish foydali.</p></section><div class="action-row"><a href="/ogil-bola-ismlari/">O'g'il bolalar ismlari</a><a href="/qiz-bola-ismlari/">Qiz bolalar ismlari</a></div></article>'''
        self.page('/maqolalar/ism-tanlash/', 'Farzandga ism tanlash: amaliy yo‘riqnoma | Bolagaism.uz', 'Ismlarni ma’nosi, talaffuzi va yozilishi bo‘yicha solishtirish uchun amaliy yo‘riqnoma.', body, [('Bosh sahifa', '/'), ('Ism tanlash', '/maqolalar/ism-tanlash/')])

    def home(self):
        self.legacy_home()
        featured = ''.join(self.tile(self.by_key[k]) for k in self.editorial)
        body = (ROOT / 'seo/home-intro.html').read_text(encoding='utf-8') + self.search_form()
        body += '<section><div class="section-heading-concept"><div><h2>Ko‘nglingizga yaqin ismni toping</h2><p>Har bir ism ortida o‘ziga xos ma’no bor.</p></div><a href="/tanlangan/">♡ Tanlanganlar</a></div><div class="concept-names">' + featured + '</div></section>'
        body += self.ad('home_after_guide') + (ROOT / 'seo/guide.html').read_text(encoding='utf-8')
        body += '<script>if(location.search){const p=new URLSearchParams(location.search);if(p.has("ism")||p.has("jins")){location.replace("/legacy/"+location.search)}else if(p.has("q")){location.replace("/qidiruv/"+location.search)}}</script>'
        self.page('/', "O'zbek ismlari ma’nosi va kelib chiqishi | Bolagaism.uz", 'Farzandingiz uchun ism tanlang: o‘g‘il va qiz bolalar ismlari, ma’nolari va alifbo katalogi.', body)

    def legacy_home(self):
        source = (ROOT / 'index.html').read_text(encoding='utf-8')
        # Keep the original wizard and its styling, replacing only metadata and ad locations.
        source = re.sub(r'<head>[\s\S]*?</head>', '<head>' + self.head("O'zbek ismlari ma’nosi va kelib chiqishi | Bolagaism.uz", 'Farzandingiz uchun ism tanlang: o‘g‘il va qiz bolalar ismlari, ma’nolari, alifbo katalogi va manbalar.', '/') + '</head>', source, count=1)
        source = re.sub(r'<div class="ad-container">[\s\S]*?</div>', '', source)
        intro = '''<div class="welcome-card welcome-intro"><div class="baby-illustration">👶✨</div><h1 class="welcome-title">Farzandingiz uchun eng chiroyli va ma'noli ismni tanlang</h1><p class="welcome-desc">O'zbek xalq ismlarining to'liq ma'nosi, kelib chiqishi va izohi.</p></div>'''
        source = re.sub(r'<section class="wizard-step" id="stepWelcome">[\s\S]*?</section>', '', source, count=1)
        source = source.replace('<section class="wizard-step" id="stepGender" style="display: none;">', '<section class="wizard-step" id="stepGender" style="display: none;">' + intro, 1)
        source = re.sub(r'<div class="step-card">\s*<h2 class="step-title">Farzandingiz jinsini tanlang</h2>\s*<p class="step-desc">Tanlovingizga ko\'ra mos ismlar saralab beriladi</p>', '<div class="step-card">', source, count=1)
        tiles = ''
        featured = ''.join(self.tile(self.by_key[k]) for k in self.editorial)
        extra = f'<section class="home-seo paper"><h2>Ismlar bilan tanishishni boshlang</h2><p>Ma’nosi va kelib chiqishini ko‘rib chiqing, sizga yoqqan variantlarni solishtiring.</p><div class="related-grid">{featured}</div><h2>Ism tanlash bo‘yicha yo‘riqnoma</h2><p>Ma’nosi, talaffuzi va yozilishini solishtiring. Yoqtirgan variantlaringizni saqlang va yaqinlaringiz bilan muhokama qiling.</p><p><a href="/maqolalar/ism-tanlash/">Foydali maslahatlarni o‘qish →</a></p></section>{self.ad("home_after_guide")}'
        source = source.replace('<button type="button" class="gender-card-btn boy" onclick="window.selectGender(\'m\')">', '<a class="gender-card-btn boy" href="/ogil-bola-ismlari/">', 1)
        source = re.sub(r'<button type="button" class="gender-card-btn girl" onclick="window\.selectGender\(\'f\'\)">', '<a class="gender-card-btn girl" href="/qiz-bola-ismlari/">', source, count=1)
        gender_start = source.find('<section class="wizard-step" id="stepGender"')
        gender_end = source.find('</section>', gender_start)
        if gender_start >= 0 and gender_end >= 0:
            gender_markup = source[gender_start:gender_end]
            gender_markup = gender_markup.replace('</button>', '</a>')
            source = source[:gender_start] + gender_markup + source[gender_end:]
        source = source.replace('</main>', extra + '</main>')
        source = source.replace('<body class="theme-neutral">', '<body class="theme-neutral">' + ('' if self.production else '<div class="preview-banner">Ko‘rib chiqish uchun namuna · reklama joylari ko‘rsatilgan</div>'))
        source = source.replace('class="brand-logo" href="https://bolagaism.uz/"', 'class="brand-logo" href="/"')
        source = source.replace('<script src="app.js"></script>', '<script src="/routes.js"></script><script src="/app.js"></script><script src="/ads-config.js"></script><script src="/ads.js" defer></script>')
        for id_, count in [('statTotal', len(self.unique)), ('statBoys', sum(n['g'] == 'm' for n in self.unique)), ('statGirls', sum(n['g'] == 'f' for n in self.unique))]:
            source = re.sub(f'(<b id="{id_}">).*?(</b>)', lambda m: m[1] + str(count) + m[2], source)
        source = source.replace('content="index, follow"', 'content="noindex, follow"')
        source = re.sub(r'<title>.*?</title>', '<title>Ismni ko‘rish | Bolagaism.uz</title>', source, count=1)
        for filename in ['about.html', 'contact.html', 'privacy.html', 'terms.html']:
            source = source.replace(f'href="{filename}"', f'href="/{filename}"')
        self.write('legacy/index.html', source)

    def build(self):
        self.catalogs()
        self.name_pages()
        self.support_pages()
        self.home()
        for filename in ['app.js', 'style.css', 'CNAME', 'yandex_86cc7771ea469228.html']:
            self.write(filename, (ROOT / filename).read_text(encoding='utf-8'))
        for filename in ['about.html', 'contact.html', 'privacy.html', 'terms.html']:
            content = (ROOT / filename).read_text(encoding='utf-8')
            title = re.search(r'<title>(.*?)</title>', content)[1]
            body = re.search(r'<body>([\s\S]*)</body>', content)[1]
            # Preserve information text, reuse the shared accessible layout.
            body = re.sub(r'^\s*<div class="container">', '<article class="paper readable">', body)
            body = re.sub(r'</div>\s*$', '</article>', body)
            self.page('/' + filename, html.unescape(title), html.unescape(title) + '. Bolagaism.uz haqida ma’lumot.', body)
        for src, dest in [('preview.css', 'seo.css'), ('design.css', 'design.css'), ('page.js', 'page.js'), ('ads.js', 'ads.js')]:
            self.write(dest, (ROOT / 'seo' / src).read_text(encoding='utf-8'))
        self.write('ads-config.js', 'window.BOLAGA_ADS = ' + js_json({'mode': self.ads_mode, 'publisher': self.ads['publisher'], 'consentVerified': self.ads['consent_setup_verified']}) + ';')
        self.write('routes.js', 'window.NAME_ROUTES = ' + js_json(self.routes) + ';')
        self.write('routes.json', js_json(self.routes))
        self.write('names.json', js_json(self.names))
        self.write('names_data.js', 'window.ALL_NAMES = ' + js_json(self.names) + ';')
        self.write('search-index.json', js_json([{'id': n['id'], 'key': key(n), 'l': n['l'], 'k': n.get('k', ''), 'g': n['g'], 'origin': n.get('lang', ''), 'm': n.get('m', ''), 'url': self.href(n)} for n in self.unique]))
        self.write('ads.txt', 'google.com, ' + self.ads['publisher'].removeprefix('ca-') + ', DIRECT, f08c47fec0942fa0\n')
        self.write('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: ' + BASE + '/sitemap.xml\n')
        self.write('.nojekyll', '')
        self.write('favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#FAF7F2"/><text x="32" y="46" text-anchor="middle" font-size="42">B</text></svg>')
        social = ROOT / 'seo/social-card.png'
        if not social.exists():
            raise ValueError('Missing seo/social-card.png')
        shutil.copyfile(social, self.out / 'social-card.png')
        self.files.add('social-card.png')
        urls = self.urls if self.production else []
        self.write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join('<url><loc>' + esc(BASE + path) + '</loc>' + (f'<lastmod>{date}</lastmod>' if date else '') + '</url>' for path, date in urls) + '</urlset>')
        # Reports stay outside the public artifact.
        report_dir = ROOT / 'artifacts'
        report_dir.mkdir(exist_ok=True)
        (report_dir / 'data-audit.json').write_text(json.dumps(self.audit, ensure_ascii=False, indent=2), encoding='utf-8')
        summary = {'html_pages': len([f for f in self.files if f.endswith('.html')]), 'name_pages': len(self.routes), 'reviewed_name_pages': len(self.editorial), 'source_covered_name_pages': len(self.routes) if self.source_policy.get('global_source_applies') else len(self.editorial), 'indexed_name_pages': len(self.routes) if self.production and self.source_policy.get('global_source_applies') else len(self.editorial), 'sitemap_urls': len(urls), 'ad_mode': self.ads_mode, 'production': self.production}
        (report_dir / 'build-summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
        suffixes = ('ali', 'bek', 'jon', 'berdi', 'botir', 'boy', 'murod', 'nazar', 'polvon', 'qul', 'toy', 'to‘ra', "to'ra", 'vali', 'xon', 'xo‘ja', "xo'ja", 'shoh', 'mirzo')
        candidates = []
        for item in self.unique:
            normalized = norm(item['l']).replace(' ', '')
            if len(normalized) <= 9 and not any(normalized.endswith(s) for s in suffixes) and key(item) not in self.editorial:
                candidates.append({'key': key(item), 'name': item['l'], 'gender': item['g'], 'origin': item.get('lang', ''), 'meaning': item.get('m', ''), 'url': self.routes[key(item)], 'status': 'pending_source_review', 'reason': 'Короткое самостоятельное имя; проверить значение и происхождение по независимому источнику.'})
            if len(candidates) >= 1000:
                break
        (report_dir / 'editorial-review-queue.json').write_text(json.dumps({'generated_by': 'build_site.py', 'selection': 'heuristic_short_standalone_names', 'items': candidates}, ensure_ascii=False, indent=2), encoding='utf-8')
        for stale in set(self.previous) - self.files:
            target = self.out / stale
            if target.resolve().is_relative_to(self.out.resolve()) and target.is_file() and not target.is_symlink():
                target.unlink()
        self.write('.build-manifest.json', json.dumps(sorted(self.files)))
        print(json.dumps(summary))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--production', action='store_true')
    parser.add_argument('--ads', choices=['preview', 'off', 'live'], default='preview')
    parser.add_argument('--data', help='Optional converter-produced names.json input')
    args = parser.parse_args()
    if args.production and args.ads == 'preview':
        parser.error('Production must explicitly use --ads off or --ads live; preview placeholders cannot be published.')
    Builder(args.production, args.ads, args.data).build()
