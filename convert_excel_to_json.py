import json
import os
import pandas as pd

excel_file = 'uz_names.xlsx'

if not os.path.exists(excel_file):
    print(f"Error: {excel_file} not found!")
    exit(1)

df = pd.read_excel(excel_file)

# Очищаем заголовки колонок от пробелов и приводим к нижнему регистру
df.columns = [str(c).strip().lower() for c in df.columns]

names_list = []

for idx, row in df.iterrows():
    # Поиск полей с гибкими названиями колонок
    lotin = str(row.get('ism', row.get('name', row.get('lotin', row.iloc[0])))).strip()
    if not lotin or lotin.lower() == 'nan':
        continue

    # Определение пола (m / f)
    raw_gender = str(row.get('jinsi', row.get('gender', row.get('jins', 'm')))).strip().lower()
    gender = 'f' if ('qiz' in raw_gender or 'f' in raw_gender or 'жен' in raw_gender) else 'm'

    # Происхождение
    lang = str(row.get('kelib_chiqishi', row.get('til', row.get('lang', "O'zbekcha")))).strip()
    if lang.lower() == 'nan' or not lang:
        lang = "O'zbekcha"

    # Значение / ma'nosi
    meaning = str(row.get('manosi', row.get("ma'nosi", row.get('meaning', row.get('izoh', ''))))).strip()
    if meaning.lower() == 'nan':
        meaning = "Ma'lumot kiritilmagan."

    # Просмотры
    views = row.get('views', row.get('korishlar', 100))
    try:
        views = int(views)
    except:
        views = 100

    names_list.append({
        "id": idx + 1,
        "l": lotin,
        "g": gender,
        "lang": lang,
        "m": meaning,
        "v": views
    })

# Записываем в names_data.js для index.html
js_content = f"window.ALL_NAMES = {json.dumps(names_list, ensure_ascii=False, indent=2)};"

with open('names_data.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Successfully generated names_data.js with {len(names_list)} names!")
