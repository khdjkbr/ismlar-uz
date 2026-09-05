import os
import json
import pandas as pd

excel_file = 'uz_names.xlsx'

if not os.path.exists(excel_file):
    print(f"Xato: {excel_file} fayli topilmadi!")
    exit(1)

# Читаем Excel файл
try:
    df = pd.read_excel(excel_file)
except Exception as e:
    print(f"Excel faylni o'qishda xatolik: {e}")
    exit(1)

# Если таблица пустая
if df.empty:
    print("Excel fayl bo'sh!")
    exit(1)

names_list = []

# Определяем соответствие колонок по смыслу
cols = list(df.columns)
col_name_idx = 0
col_gender_idx = -1
col_lang_idx = -1
col_meaning_idx = -1

for idx, c in enumerate(cols):
    c_str = str(c).strip().lower()
    if any(k in c_str for k in ['ism', 'name', 'lotin', 'nom']):
        col_name_idx = idx
    elif any(k in c_str for k in ['jins', 'gender', 'pol', 'sex']):
        col_gender_idx = idx
    elif any(k in c_str for k in ['kelib', 'til', 'lang', 'milli']):
        col_lang_idx = idx
    elif any(k in c_str for k in ['mano', "ma'no", 'izoh', 'meaning', 'tafsif']):
        col_meaning_idx = idx

# Если смысл колонок не распознан по заголовкам, берем по порядку
if col_gender_idx == -1 and len(cols) > 1:
    col_gender_idx = 1
if col_lang_idx == -1 and len(cols) > 2:
    col_lang_idx = 2
if col_meaning_idx == -1 and len(cols) > 3:
    col_meaning_idx = 3

for row_num, row in df.iterrows():
    # Извлекаем имя
    raw_name = row.iloc[col_name_idx] if col_name_idx < len(row) else ''
    if pd.isna(raw_name):
        continue
    name_str = str(raw_name).strip()
    if not name_str or name_str.lower() in ['nan', 'none', 'ism', 'name']:
        continue

    # Извлекаем пол
    raw_gender = row.iloc[col_gender_idx] if (col_gender_idx != -1 and col_gender_idx < len(row)) else 'm'
    gender_str = str(raw_gender).strip().lower() if not pd.isna(raw_gender) else 'm'
    gender = 'f' if ('qiz' in gender_str or 'f' in gender_str or 'жен' in gender_str or 'аёл' in gender_str or 'ayol' in gender_str) else 'm'

    # Извлекаем происхождение
    raw_lang = row.iloc[col_lang_idx] if (col_lang_idx != -1 and col_lang_idx < len(row)) else "O'zbekcha"
    lang_str = str(raw_lang).strip() if not pd.isna(raw_lang) else "O'zbekcha"
    if not lang_str or lang_str.lower() == 'nan':
        lang_str = "O'zbekcha"

    # Извлекаем значение (ma'nosi)
    raw_meaning = row.iloc[col_meaning_idx] if (col_meaning_idx != -1 and col_meaning_idx < len(row)) else ""
    meaning_str = str(raw_meaning).strip() if not pd.isna(raw_meaning) else "Ma'lumot kiritilmagan."
    if not meaning_str or meaning_str.lower() == 'nan':
        meaning_str = "Ma'lumot kiritilmagan."

    # Стартовые просмотры для карточки
    views_val = 150 + ((row_num * 17) % 850)

    names_list.append({
        "id": int(row_num + 1),
        "l": name_str,
        "g": gender,
        "lang": lang_str,
        "m": meaning_str,
        "v": int(views_val)
    })

# Формируем итоговый JS-файл
output_js = f"window.ALL_NAMES = {json.dumps(names_list, ensure_ascii=False)};"

with open('names_data.js', 'w', encoding='utf-8') as f:
    f.write(output_js)

print(f"Muvaffaqiyatli yakunlandi! Jami {len(names_list)} ta ism 'names_data.js' fayliga saqlandi.")
