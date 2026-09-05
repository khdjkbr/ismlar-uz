#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Skript: Excel bazasidagi ismlarni sayt uchun names_data.js va names_data.json ga o'girish.
Qo'llab-quvvatlanadigan ustunlar:
  - T/r (№, ID)
  - Ism (Lotincha nom)
  - Jinsi (Erkak / Ayol)
  - Kelib chiqishi (Tili / Etimologiyasi)
  - Ma'nosi (Izohi)
"""

import sys
import os
import json
import pandas as pd

# Bazaviy mashhur ismlar uchun ko'rishlar soni
POPULAR_SEEDS = {
    "Muhammad": 1850, "Madina": 1790, "Yasmina": 1640, "Fotima": 1510,
    "Rayhona": 1470, "Abdulaziz": 1420, "Oysha": 1420, "Imron": 1390,
    "Yusuf": 1360, "Zuhro": 1350, "Muslima": 1310, "Alisher": 1280,
    "Samira": 1260, "Umar": 1250, "Hadicha": 1180, "Javohir": 1150,
    "Sevinch": 1130, "Behro'z": 1120, "Ulug'bek": 1120, "Temur": 1050,
    "Shahzoda": 1040, "Amirxon": 980, "Gulnora": 980, "Rustam": 960,
    "Dildora": 950, "Sardor": 940, "Yulduz": 930, "Ozoda": 920,
    "Bilol": 920, "Jasur": 910, "Sarvinoz": 910, "Shahnoza": 910,
    "Lola": 890, "Oybek": 880, "Sherzod": 870, "Zilola": 860,
    "Otabek": 850, "Barno": 840, "Sanjar": 820, "Davron": 780
}

def clean_str(val):
    if val is None or pd.isna(val):
        return ""
    return str(val).strip()

def normalize_gender(raw):
    raw_lower = clean_str(raw).lower()
    if any(k in raw_lower for k in ['ayol', 'qiz', 'жен', 'female', 'f']):
        return 'f'
    return 'm'

def convert(excel_path=None, json_path="names_data.json", js_path="names_data.js"):
    if not excel_path or not os.path.exists(excel_path):
        candidates = ["uz_names.xlsx"]
        found = [f for f in candidates if os.path.exists(f)]
        if found:
            excel_path = found[0]
        else:
            all_xlsx = [f for f in os.listdir('.') if f.endswith('.xlsx')]
            if all_xlsx:
                excel_path = all_xlsx[0]
            else:
                print("[-] Excel (.xlsx) fayl topilmadi.")
                return 1

    print(f"[+] Excel fayli yuklanmoqda: {excel_path}...")
    try:
        df_raw = pd.read_excel(excel_path, header=None)
    except Exception as e:
        print(f"[-] Faylni o'qishda xatolik: {e}")
        return 1

    # Sarlavha qatorini aniqlash
    header_idx = None
    for idx, row in df_raw.iterrows():
        row_str = " ".join([str(x) for x in row.values if pd.notna(x)]).lower()
        if "ism" in row_str or "jinsi" in row_str or "kelib chiqishi" in row_str or "маъно" in row_str:
            header_idx = idx
            break

    if header_idx is not None:
        df = pd.read_excel(excel_path, skiprows=header_idx)
    else:
        df = pd.read_excel(excel_path)

    cols = list(df.columns)
    col_id = cols[0]
    col_name = cols if len(cols) > 1 else cols[0]
    col_gender = cols if len(cols) > 2 else cols[0]
    col_lang = cols if len(cols) > 3 else cols[0]
    col_meaning = cols[4] if len(cols) > 4 else cols[0]

    for c in cols:
        cl = str(c).lower().strip()
        if cl in ['t/r', '№', 'id', 'tartib']:
            col_id = c
        elif any(k in cl for k in ['ism', 'lotin', 'name']):
            col_name = c
        elif any(k in cl for k in ['jins', 'gender']):
            col_gender = c
        elif any(k in cl for k in ['kelib chiqishi', 'til', 'etimolog', 'origin']):
            col_lang = c
        elif any(k in cl for k in ['ma\'no', 'mano', 'izoh', 'meaning']):
            col_meaning = c

    items = []
    current_id = 1

    for _, row in df.iterrows():
        name = clean_str(row.get(col_name, ''))
        if not name or name.lower() in ['ism', 'name']:
            continue

        raw_id = row.get(col_id)
        try:
            item_id = int(raw_id) if pd.notna(raw_id) else current_id
        except Exception:
            item_id = current_id

        gender_val = normalize_gender(row.get(col_gender, 'm'))
        lang_val = clean_str(row.get(col_lang, '')) or "O'zbekcha"
        meaning_val = clean_str(row.get(col_meaning, ''))

        if name in POPULAR_SEEDS:
            views = POPULAR_SEEDS[name]
        else:
            views = 120 + (abs(hash(name)) % 450)

        items.append({
            "id": item_id,
            "l": name,
            "g": gender_val,
            "lang": lang_val,
            "m": meaning_val,
            "v": views
        })
        current_id += 1

    if not items:
        print("[-] Jadvaldan hech qanday ism topilmadi.")
        return 1

    # 1. JSON formatida saqlash
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    print(f"[+] JSON bazasi saqlandi: {json_path} ({len(items)} ta ism)")

    # 2. Sayt uchun JavaScript formatida saqlash (window.ALL_NAMES)
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("window.ALL_NAMES = ")
        json.dump(items, f, ensure_ascii=False)
        f.write(";\n")
    print(f"[+] Sayt JS bazasi saqlandi: {js_path} ({os.path.getsize(js_path) / 1024:.1f} KB)")

    return 0

if __name__ == "__main__":
    target_file = sys.argv if len(sys.argv) > 1 else None
    sys.exit(convert(target_file))
