import os
import json
import pandas as pd

excel_file = 'uz_names.xlsx'

# Принудительные списки Топ-10 с гарантированно высокими просмотрами
FORCED_TOP_BOYS = [
    {"l": "Muhammad", "m": "Maqtovga, olqishlarga sazovor. Payg'ambarimiz (s.a.v.)ning muborak ismlari.", "v": 19500},
    {"l": "Mustafo", "m": "Tanlangan, tanho, saylangan; Muhammad (s.a.v.)ning muborak sifatlaridan biri.", "v": 18200},
    {"l": "Imron", "m": "Tiriklik, barhayotlik, uzoq umr ko'ruvchi, obodlik ramzi.", "v": 17400},
    {"l": "Ali", "m": "Oliy, yuksak martabali; hazrati Ali ibn Abu Tolib nomi bilan bog'liq tabarruk ism.", "v": 16800},
    {"l": "Umar", "m": "Barhayot, uzoq umr ko'ruvchi, tabarruk va adolatli inson.", "v": 15900},
    {"l": "Zubayr", "m": "Kuchli, qudratli, jasur va mard yigit.", "v": 14500},
    {"l": "Zayd", "m": "O'suvchi, ziyoda bo'luvchi, barakali.", "v": 13800},
    {"l": "Ayub", "m": "Sabr-toqatli, sinovlarga dosh beruvchi payg'ambarimiz nomi.", "v": 13100},
    {"l": "Jahongir", "m": "Jahonni egallovchi, dunyoni zabt etuvchi hukmdor.", "v": 12500},
    {"l": "Yusuf", "m": "Husnda tengsiz, go'zallik va jamol ramzi bo'lgan payg'ambar ismi.", "v": 11900}
]

FORCED_TOP_GIRLS = [
    {"l": "Sadiya", "m": "Baxtli, saodatli, omadli va quvonchli qiz.", "v": 19800},
    {"l": "Safiya", "m": "Sof, pokiza, tanlangan, chin do'st.", "v": 18600},
    {"l": "Maryam", "m": "Ibodatgo'y, pokiza; Iso payg'ambarning onalari nomi.", "v": 17900},
    {"l": "Oyisha", "m": "Yashovchi, barhayot, saodatli va pokdomon ayol.", "v": 17100},
    {"l": "Aziza", "m": "Qadrli, hurmatli, ulug' va aziz inson.", "v": 16400},
    {"l": "Muslima", "m": "Musulmon, xudojo'y, iymonli va odobli qiz.", "v": 15200},
    {"l": "Mubina", "m": "Ochiq-oydin, ravshan, porloq va haqiqatni ko'rsatuvchi.", "v": 14300},
    {"l": "Hadicha", "m": "Chaqaloqlarning eng azizi; Payg'ambarimizning ilk zavjalari muborak ismlari.", "v": 13700},
    {"l": "Sumayya", "m": "Yuksak, qadr-qimmati baland, e'zozli ayol.", "v": 12900},
    {"l": "Imona", "m": "Iymonli, e'tiqodli, Allohga inonuvchi qiz.", "v": 12100}
]

names_list = []
existing_names_lower = set()

# 1. Читаем Excel, если он есть
if os.path.exists(excel_file):
    try:
        xl = pd.ExcelFile(excel_file)
        df = xl.parse(xl.sheet_names[0])
        col_names = [str(c).strip() for c in df.columns]

        def find_best_col(keywords, default_idx=0):
            for kw in keywords:
                for idx, col in enumerate(col_names):
                    c_low = col.lower().replace("'", "").replace("‘", "").replace("`", "")
                    if kw in c_low:
                        return idx
            return default_idx if default_idx < len(col_names) else 0

        name_idx = find_best_col(['ism', 'name', 'nom', 'lotin'], 0)
        gender_idx = find_best_col(['jins', 'gender', 'jinsi'], 1)
        lang_idx = find_best_col(['kelib', 'til', 'lang', 'origin'], 2)
        meaning_idx = find_best_col(['mano', 'izoh', 'meaning', 'tafsif'], 3)

        for idx, row in df.iterrows():
            raw_name = str(row.iloc[name_idx]).strip() if name_idx < len(row) and not pd.isna(row.iloc[name_idx]) else ""
            if not raw_name or raw_name.lower() in ['nan', 'none', 'ism', 'name']:
                continue

            raw_gender = str(row.iloc[gender_idx]).strip().lower() if gender_idx < len(row) and not pd.isna(row.iloc[gender_idx]) else "m"
            gender = 'f' if any(k in raw_gender for k in ['qiz', 'f', 'ayol', 'female']) else 'm'

            raw_lang = str(row.iloc[lang_idx]).strip() if lang_idx < len(row) and not pd.isna(row.iloc[lang_idx]) else "Ozbekcha"
            if not raw_lang or raw_lang.lower() == 'nan':
                raw_lang = "Ozbekcha"

            raw_meaning = str(row.iloc[meaning_idx]).strip() if meaning_idx < len(row) and not pd.isna(row.iloc[meaning_idx]) else ""
            if not raw_meaning or raw_meaning.lower() == 'nan':
                raw_meaning = "Malumot kiritilmagan."

            views_val = 200 + ((idx * 23) % 950)

            existing_names_lower.add(raw_name.lower())
            names_list.append({
                "id": int(len(names_list) + 1),
                "l": raw_name,
                "g": gender,
                "lang": raw_lang,
                "m": raw_meaning,
                "v": int(views_val)
            })
    except Exception as e:
        print(f"Excel o'qishda xatolik: {e}")

# 2. Гарантированно добавляем топ-имена для мальчиков
for item in FORCED_TOP_BOYS:
    if item["l"].lower() not in existing_names_lower:
        names_list.append({
            "id": int(len(names_list) + 1),
            "l": item["l"],
            "g": "m",
            "lang": "Arabcha",
            "m": item["m"],
            "v": item["v"]
        })
        existing_names_lower.add(item["l"].lower())
    else:
        # Если имя уже есть в базе, выставляем ему высокий топ-приоритет просмотров
        for name_obj in names_list:
            if name_obj["l"].lower() == item["l"].lower():
                name_obj["v"] = item["v"]

# 3. Гарантированно добавляем топ-имена для девочек
for item in FORCED_TOP_GIRLS:
    if item["l"].lower() not in existing_names_lower:
        names_list.append({
            "id": int(len(names_list) + 1),
            "l": item["l"],
            "g": "f",
            "lang": "Arabcha",
            "m": item["m"],
            "v": item["v"]
        })
        existing_names_lower.add(item["l"].lower())
    else:
        for name_obj in names_list:
            if name_obj["l"].lower() == item["l"].lower():
                name_obj["v"] = item["v"]

# Сохранение в JSON и JS
with open('names.json', 'w', encoding='utf-8') as f:
    json.dump(names_list, f, ensure_ascii=False)

with open('names_data.js', 'w', encoding='utf-8') as f:
    f.write(f"window.ALL_NAMES = {json.dumps(names_list, ensure_ascii=False)};")

print(f"Muvaffaqiyatli! Jami {len(names_list)} ta ism bazaga joylandi va toplar sozlandi.")
