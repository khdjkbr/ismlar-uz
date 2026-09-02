#!/usr/bin/env python3
import sys
import os
import json

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

    # Если имя файла не передано или файл не найден, ищем любой файл .xlsx в папке
    if not excel_path or not os.path.exists(excel_path):
        xlsx_candidates = [f for f in os.listdir('.') if f.endswith('.xlsx')]
        if xlsx_candidates:
            excel_path = xlsx_candidates[0]
            print(f"[+] Найден Excel-файл: {excel_path}")
        else:
            print(f"[-] Excel файл (.xlsx) не найден. Сайт использует встроенные имена.")
            return 0

    print(f"[+] Чтение файла: {excel_path}...")
    try:
        df_raw = pd.read_excel(excel_path, header=None)
    except Exception as e:
        print(f"[-] Ошибка чтения Excel ({excel_path}): {e}")
        return 0

    # Поиск строки с заголовками таблицы
    header_idx = None
    for idx, row in df_raw.iterrows():
        row_str = " ".join([str(x) for x in row.values if pd.notna(x)]).lower()
        if "кириллицада" in row_str or "лотинча" in row_str or ("ҳарф" in row_str and "жинси" in row_str):
            header_idx = idx
            break

    if header_idx is not None:
        df = pd.read_excel(excel_path, skiprows=header_idx)
    else:
        df = df_raw

    cols = list(df.columns)
    col_kirill = cols if len(cols) > 2 else cols[0]
    col_lotin = cols[3] if len(cols) > 3 else cols[0]
    col_gender = cols[4] if len(cols) > 4 else cols[0]
    col_lang = cols[5] if len(cols) > 5 else cols[0]
    col_meaning = cols[6] if len(cols) > 6 else cols[0]

    for c in cols:
        cl = str(c).lower()
        if 'кирилл' in cl: col_kirill = c
        elif 'лотин' in cl or 'lotin' in cl: col_lotin = c
        elif 'жинс' in cl: col_gender = c
        elif 'тил' in cl or 'этимолог' in cl: col_lang = c
        elif 'маъно' in cl or 'изоҳ' in cl: col_meaning = c

    items = []
    item_id = 1

    for _, row in df.iterrows():
        kirill_name = clean_str(row.get(col_kirill, ''))
        lotin_name = clean_str(row.get(col_lotin, ''))
        gender_raw = clean_str(row.get(col_gender, ''))
        lang = clean_str(row.get(col_lang, ''))
        meaning = clean_str(row.get(col_meaning, ''))

        if not kirill_name and not lotin_name:
            continue

        if not lotin_name: lotin_name = kirill_name
        if not kirill_name: kirill_name = lotin_name

        seed_views = 45 + (hash(kirill_name) % 300)

        items.append({
            "id": item_id,
            "k": kirill_name,
            "l": lotin_name,
            "g": normalize_gender(gender_raw),
            "lang": lang,
            "m": meaning,
            "v": seed_views
        })
        item_id += 1

    if items:
        with open("names_data.js", "w", encoding="utf-8") as f:
            f.write("window.ALL_NAMES = ")
            json.dump(items, f, ensure_ascii=False)
            f.write(";\n")
        print(f"[+] Успешно! Сконвертировано {len(items)} имён в names_data.js")
    else:
        print("[!] Таблица пустая или структура отличается.")

    return 0

if __name__ == "__main__":
    target = sys.argv if len(sys.argv) > 1 else None
    convert(target)
