#!/usr/bin/env python3
import sys
import os
import json

CYR_TO_LAT = {
    'А': 'A', 'а': 'a', 'Б': 'B', 'б': 'b', 'В': 'V', 'в': 'v', 'Г': 'G', 'г': 'g',
    'Д': 'D', 'д': 'd', 'Е': 'E', 'е': 'e', 'Ё': 'Yo', 'ё': 'yo', 'Ж': 'J', 'ж': 'j',
    'З': 'Z', 'з': 'z', 'И': 'I', 'и': 'i', 'Й': 'Y', 'й': 'y', 'К': 'K', 'к': 'k',
    'Л': 'L', 'л': 'l', 'М': 'M', 'м': 'm', 'Н': 'N', 'н': 'n', 'О': 'O', 'о': 'o',
    'П': 'P', 'п': 'p', 'Р': 'R', 'р': 'r', 'С': 'S', 'с': 's', 'Т': 'T', 'т': 't',
    'У': 'U', 'у': 'u', 'Ф': 'F', 'ф': 'f', 'Х': 'X', 'х': 'x', 'Ц': 'S', 'ц': 's',
    'Ч': 'Ch', 'ч': 'ch', 'Ш': 'Sh', 'ш': 'sh', 'Ъ': "'", 'ъ': "'", 'Ь': '', 'ь': '',
    'Э': 'E', 'э': 'e', 'Ю': 'Yu', 'ю': 'yu', 'Я': 'Ya', 'я': 'ya',
    'Ў': 'Oʻ', 'ў': 'oʻ', 'Қ': 'Q', 'қ': 'q', 'Ғ': 'Gʻ', 'ғ': 'gʻ', 'Ҳ': 'H', 'ҳ': 'h'
}

def cyr_to_lat(text):
    if not text:
        return ""
    res = []
    for ch in text:
        res.append(CYR_TO_LAT.get(ch, ch))
    return ''.join(res)

def clean_str(val):
    if val is None:
        return ""
    import pandas as pd
    if pd.isna(val):
        return ""
    return str(val).strip()

def normalize_gender(raw):
    raw_lower = clean_str(raw).lower()
    if 'аёл' in raw_lower or 'qiz' in raw_lower or 'киз' in raw_lower or 'жен' in raw_lower:
        return 'f'
    return 'm'

def convert(excel_path=None):
    import pandas as pd

    if not excel_path or not os.path.exists(excel_path):
        xlsx_candidates = [f for f in os.listdir('.') if f.endswith('.xlsx')]
        if xlsx_candidates:
            excel_path = xlsx_candidates[0]
            print(f"[+] Excel fayli topildi: {excel_path}")
        else:
            print(f"[-] Excel (.xlsx) fayli topilmadi. O'rnatilgan zaxira bazadan foydalaniladi.")
            return 0

    print(f"[+] Fayl o'qilmoqda: {excel_path}...")
    try:
        df_raw = pd.read_excel(excel_path, header=None)
    except Exception as e:
        print(f"[-] Excelni o'qishda xatolik: {e}")
        return 0

    header_idx = None
    for idx, row in df_raw.iterrows():
        row_str = " ".join([str(x) for x in row.values if pd.notna(x)]).lower()
        if "лотинча" in row_str or "кириллицада" in row_str or ("ҳарф" in row_str and "жинси" in row_str):
            header_idx = idx
            break

    if header_idx is not None:
        df = pd.read_excel(excel_path, skiprows=header_idx)
    else:
        df = df_raw

    cols = list(df.columns)
    col_kirill = cols if len(cols) > 2 else cols[0]
    col_lotin = cols if len(cols) > 3 else cols[0]
    col_gender = cols if len(cols) > 4 else cols[0]
    col_lang = cols[5] if len(cols) > 5 else cols[0]
    col_meaning = cols[6] if len(cols) > 6 else cols[0]

    for c in cols:
        cl = str(c).lower()
        if 'лотин' in cl or 'lotin' in cl: col_lotin = c
        elif 'кирилл' in cl: col_kirill = c
        elif 'жинс' in cl: col_gender = c
        elif 'тил' in cl or 'этимолог' in cl: col_lang = c
        elif 'маъно' in cl or 'изоҳ' in cl: col_meaning = c

    items = []
    item_id = 1

    for _, row in df.iterrows():
        lotin_name = clean_str(row.get(col_lotin, ''))
        kirill_name = clean_str(row.get(col_kirill, ''))
        gender_raw = clean_str(row.get(col_gender, ''))
        lang = clean_str(row.get(col_lang, ''))
        meaning = clean_str(row.get(col_meaning, ''))

        if not lotin_name and kirill_name:
            lotin_name = cyr_to_lat(kirill_name)

        if not lotin_name:
            continue

        seed_views = 45 + (hash(lotin_name) % 300)

        items.append({
            "id": item_id,
            "l": lotin_name,
            "g": normalize_gender(gender_raw),
            "lang": cyr_to_lat(lang) if any(ord(c) > 127 for c in lang) else lang,
            "m": meaning,
            "v": seed_views
        })
        item_id += 1

    if items:
        with open("names_data.js", "w", encoding="utf-8") as f:
            f.write("window.ALL_NAMES = ")
            json.dump(items, f, ensure_ascii=False)
            f.write(";\n")
        print(f"[+] Muvaffaqiyatli! {len(items)} ta ism faqat lotin alifbosida names_data.js ga saqlandi.")
    else:
        print("[!] Jadvaldan ismlar topilmadi.")

    return 0

if __name__ == "__main__":
    target = sys.argv if len(sys.argv) > 1 else None
    convert(target)
