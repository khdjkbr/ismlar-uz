#!/usr/bin/env python3
import sys
import os
import json
import pandas as pd

def clean_str(val):
    if pd.isna(val):
        return ""
    return str(val).strip()

def normalize_gender(raw):
    raw_lower = clean_str(raw).lower()
    # Определяем пол: если встречается "аёл", "қиз" или "жен" — девочка (f), иначе мальчик (m)
    if 'аёл' in raw_lower or 'qiz' in raw_lower or 'киз' in raw_lower or 'жен' in raw_lower:
        return 'f'
    return 'm'

def convert(excel_path="Ozbek_ismlari_manosi_Toliq_Katalog_608bet.xlsx"):
    # Проверяем наличие файла по умолчанию или первого найденного .xlsx
    if not os.path.exists(excel_path):
        xlsx_files = [f for f in os.listdir('.') if f.endswith('.xlsx')]
        if xlsx_files:
            excel_path = xlsx_files[0]
        else:
            print(f"[-] Файл {excel_path} не найден в текущей папке.")
            return

    print(f"[+] Чтение файла: {excel_path}...")
    df_raw = pd.read_excel(excel_path, header=None)

    # Поиск строки заголовков таблицы
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
    col_kirill, col_lotin, col_gender, col_lang, col_meaning = cols[2], cols[3], cols[4], cols[5], cols[6]

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
            "k": kirill_name,        # Кириллица
            "l": lotin_name,         # Латиница
            "g": normalize_gender(gender_raw), # m - мальчик, f - девочка
            "lang": lang,            # Происхождение
            "m": meaning,            # Толкование
            "v": seed_views          # Просмотры
        })
        item_id += 1

    with open("names_data.js", "w", encoding="utf-8") as f:
        f.write("window.ALL_NAMES = ")
        json.dump(items, f, ensure_ascii=False)
        f.write(";\n")

    print(f"[+] Успешно! Сконвертировано {len(items)} имён в names_data.js")

if __name__ == "__main__":
    file_arg = sys.argv if len(sys.argv) > 1 else "Ozbek_ismlari_manosi_Toliq_Katalog_608bet.xlsx"
    convert(file_arg)
