"""Regenerate the original typographic sharing image (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

fonts = [Path('C:/Windows/Fonts/arial.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')]
font = next((p for p in fonts if p.exists()), None)
if not font:
    raise SystemExit('Install Arial or DejaVu Sans to regenerate the image.')
image = Image.new('RGB', (1200, 630), '#FAF7F2')
d = ImageDraw.Draw(image)
d.rounded_rectangle((65, 65, 1135, 565), radius=36, fill='white', outline='#EBE4DA', width=3)
d.ellipse((930, 90, 1080, 240), fill='#EBF4FC')
d.ellipse((1000, 200, 1100, 300), fill='#FDF0F4')
d.text((110, 120), 'BolagaIsm.uz', fill='#3C3835', font=ImageFont.truetype(str(font), 70))
d.text((110, 280), "O'zbek ismlari", fill='#2869a5', font=ImageFont.truetype(str(font), 58))
d.text((110, 360), "Ma'nosi va kelib chiqishi", fill='#7A736E', font=ImageFont.truetype(str(font), 38))
d.text((110, 470), "Farzandingiz uchun ma'noli ism tanlang", fill='#3C3835', font=ImageFont.truetype(str(font), 30))
image.save(Path(__file__).with_name('social-card.png'))
