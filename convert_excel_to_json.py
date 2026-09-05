import os
import json
import pandas as pd

excel_file = 'uz_names.xlsx'

if not os.path.exists(excel_file):
    print(f"Xatolik: {excel_file} fayli topilmadi!")
    exit(1)

# Читаем Excel файл
try:
    df = pd.read_excel(excel_file)
except Exception as e:
    print(f"Excel faylni ochishda xatolik: {e}")
    exit(1)

if df.empty:
    print("Excel fayl bo'sh!")
    exit(1)

# Приводим названия колонок к нижнему регистру для гибкого поиска
col_map = {}
for col in df.columns:
    c_clean = str(col).strip().lower().replace("'", "").replace("‘", "").replace("`", "")
    col_map[c_clean] = col

def find_col(keywords, default_idx=0):
    for kw in keywords:
        for c_clean, orig in col_map.items():
            if kw in c_clean:
                return orig
    if default_idx < len(df.columns):
        return df.columns[default_idx]
    return None

name_col = find_col(['ism', 'name', 'nom', 'lotin'], 0)
gender_col = find_col(['jins', 'gender', 'pol', 'jinsi'], 1)
lang_col = find_col(['kelib', 'til', 'lang', 'origin'], 2)
meaning_col = find_col(['mano', 'ma`no', 'izoh', 'meaning', 'tafsif'], 3)

names_list = []

for idx, row in df.iterrows():
    # Имя
    val_name = str(row[name_col]).strip() if name_col and not pd.isna(row[name_col]) else ""
    if not val_name or val_name.lower() in ['nan', 'none', 'ism', 'name']:
        continue

    # Пол (приводим к 'm' или 'f')
    val_gender = str(row[gender_col]).strip().lower() if gender_col and not pd.isna(row[gender_col]) else "m"
    if any(w in val_gender for w in ['qiz', 'f', 'жен', 'аёл', 'ayol', 'female']):
        gender = 'f'
    else:
        gender = 'm'

    # Происхождение
    val_lang = str(row[lang_col]).strip() if lang_col and not pd.isna(row[lang_col]) else "O'zbekcha"
    if not val_lang or val_lang.lower() == 'nan':
        val_lang = "O'zbekcha"

    # Значение
    val_meaning = str(row[meaning_col]).strip() if meaning_col and not pd.isna(row[meaning_col]) else ""
    if not val_meaning or val_meaning.lower() == 'nan':
        val_meaning = "Ma'lumot kiritilmagan."

    # Просмотры
    views_val = 200 + ((idx * 23) % 950)

    names_list.append({
        "id": int(idx + 1),
        "l": val_name,
        "g": gender,
        "lang": val_lang,
        "m": val_meaning,
        "v": int(views_val)
    })

# Записываем в names_data.js
js_content = f"window.ALL_NAMES = {json.dumps(names_list, ensure_ascii=False)};"

with open('names_data.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Tayyor! {len(names_list)} ta ism 'names_data.js' ga muvaffaqiyatli yuklandi.")
