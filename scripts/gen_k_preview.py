# -*- coding: utf-8 -*-
"""预览大图：把 icon-512.svg 转成 PNG 便于肉眼核验（K 是否居中、颜色、白底）"""
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = r"D:\deepseekharness\datachange\kizuna"
FONT_TTF = r"D:\deepseekharness\smiley-sans-v2.0.1\SmileySans-Oblique.ttf"

# 直接渲染 512 图标预览（等价于 Android xxxhdpi 效果）
img = Image.new("RGB", (512, 512), (255, 255, 255))
d = ImageDraw.Draw(img)
f = ImageFont.truetype(FONT_TTF, int(512 * 0.62))
d.text((256, 256), "K", font=f, fill=(43, 42, 38), anchor="mm")
img.save(os.path.join(ROOT, "scripts", "_k_preview_512.png"))

# 也渲染 xxxhdpi launcher 预览
img2 = Image.new("RGB", (192, 192), (255, 255, 255))
d2 = ImageDraw.Draw(img2)
f2 = ImageFont.truetype(FONT_TTF, int(192 * 0.60))
d2.text((96, 96), "K", font=f2, fill=(43, 42, 38), anchor="mm")
img2.save(os.path.join(ROOT, "scripts", "_k_preview_launcher.png"))
print("预览图已生成")
