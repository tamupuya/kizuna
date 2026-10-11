# -*- coding: utf-8 -*-
"""
生成"K"图标（得意黑 SmileySans，纯白底）并替换所有 Android + PWA 图标资源。

覆盖：
1. Android launcher 图标（legacy PNG，全白底 + 深色 K）
2. Android 自适应图标 foreground（透明底 + K，安全区内）
3. Android 启动屏 splash.png（白底 + K）
4. PWA SVG 图标（内嵌 woff2 字体的 K，纯白底）

K 颜色：#2b2a26（品牌深色，与 App 主文字一致）
背景色：#FFFFFF（纯白）
"""
from PIL import Image, ImageDraw, ImageFont
import os

FONT_TTF = r"D:\deepseekharness\smiley-sans-v2.0.1\SmileySans-Oblique.ttf"
FONT_WOFF2 = r"D:\deepseekharness\smiley-sans-v2.0.1\SmileySans-Oblique.ttf.woff2"
ROOT = r"D:\deepseekharness\datachange\kizuna"

K_COLOR = (43, 42, 38, 255)      # #2b2a26
WHITE = (255, 255, 255, 255)


def render_k_bbox(font_size):
    """渲染 K 并返回其紧凑包围盒（透明像素裁剪后的 bbox）"""
    # 用大画布渲染，避免裁剪
    canvas = 1024
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT_TTF, font_size)
    # 先放中间
    d.text((canvas // 2, canvas // 2), "K", font=f, fill=K_COLOR, anchor="mm")
    # 裁剪到非透明 bbox
    return img.crop(img.getbbox())


def make_k_image(target_size, k_frac, with_bg=True):
    """
    生成一张 target_size × target_size 的图标。
    k_frac: K 占画布宽度的比例（光学居中）
    with_bg: True=白底方形，False=透明底（adaptive foreground）
    """
    # 渲染一个高分辨率 K，再缩放
    # 用 target_size*4 的高分辨率渲染，抗锯齿更好
    hi = target_size * 4
    k_img = render_k_bbox(hi)  # K 的紧凑 bbox 图
    # 按目标 K 宽度缩放
    k_w = int(target_size * k_frac)
    ratio = k_w / k_img.width
    k_h = int(k_img.height * ratio)
    k_img = k_img.resize((k_w, k_h), Image.LANCZOS)

    if with_bg:
        img = Image.new("RGBA", (target_size, target_size), WHITE)
    else:
        img = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))

    # 光学居中：K 的视觉中心在 bbox 的垂直中点，而非 em 中点
    px = (target_size - k_w) // 2
    py = (target_size - k_h) // 2
    img.paste(k_img, (px, py), k_img)
    return img


def save_png(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.convert("RGB").save(path, "PNG")


def save_png_rgba(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG")


# ============================================================
# 1. Android launcher 图标（legacy PNG）
# ============================================================
mipmaps = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
for dpi, size in mipmaps.items():
    # 全白底 + K（legacy 方形图标）
    full = make_k_image(size, k_frac=0.60, with_bg=True)
    base = os.path.join(ROOT, "android", "app", "src", "main", "res", f"mipmap-{dpi}")
    save_png(full, os.path.join(base, "ic_launcher.png"))
    save_png(full, os.path.join(base, "ic_launcher_round.png"))
    # adaptive foreground：透明底 + 更小的 K（安全区）
    fg = make_k_image(size, k_frac=0.42, with_bg=False)
    save_png_rgba(fg, os.path.join(base, "ic_launcher_foreground.png"))
    print(f"[launcher] {dpi} ({size}px) 完成")

# ============================================================
# 2. 自适应图标：把 background 颜色改为纯白
# ============================================================
color_xml = os.path.join(ROOT, "android", "app", "src", "main", "res", "values", "ic_launcher_background.xml")
with open(color_xml, "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n')
print("[adaptive] ic_launcher_background → #FFFFFF")

# ============================================================
# 3. 启动屏 splash.png（白底 + K）
# ============================================================
splash_dirs = [
    "drawable",
    "drawable-hdpi", "drawable-mdpi", "drawable-xhdpi", "drawable-xxhdpi", "drawable-xxxhdpi",
    "drawable-land-hdpi", "drawable-land-mdpi", "drawable-land-xhdpi",
    "drawable-land-xxhdpi", "drawable-land-xxxhdpi",
    "drawable-port-hdpi", "drawable-port-mdpi", "drawable-port-xhdpi",
    "drawable-port-xxhdpi", "drawable-port-xxxhdpi",
]
# splash 建议分辨率（Capacitor 默认按密度）
splash_sizes = {
    "mdpi": 480, "hdpi": 720, "xhdpi": 960, "xxhdpi": 1440, "xxxhdpi": 1920,
}
for d in splash_dirs:
    # 从目录名推断密度
    dens = "xhdpi"  # 默认
    for dd in ["xxxhdpi", "xxhdpi", "xhdpi", "hdpi", "mdpi"]:
        if d.endswith(dd):
            dens = dd
            break
    size = splash_sizes[dens]
    splash = make_k_image(size, k_frac=0.24, with_bg=True)  # splash K 小一些，居中
    path = os.path.join(ROOT, "android", "app", "src", "main", "res", d, "splash.png")
    save_png(splash, path)
print("[splash] 全部 splash.png 已替换为白底 K")

# ============================================================
# 4. PWA SVG 图标（内嵌 PNG 渲染的 K，轻量）
# ============================================================
import base64
import io


def render_k_png(size):
    """渲染高分辨率 K 为 PNG，返回 base64 data URI"""
    k_img = render_k_bbox(size * 2)
    # 缩放到目标尺寸（K 占 width）
    k_w = size
    ratio = k_w / k_img.width
    k_h = int(k_img.height * ratio)
    k_img = k_img.resize((k_w, k_h), Image.LANCZOS)
    buf = io.BytesIO()
    k_img.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def make_svg(size, maskable=False):
    # 目标 K 宽度
    k_w = int(size * (0.48 if maskable else 0.58))
    png_b64 = render_k_png(k_w)
    k_h = None
    # 重新算高度（与 png 一致）
    tmp = render_k_bbox(k_w)
    k_h = int(tmp.height * (k_w / tmp.width))
    px = (size - k_w) // 2
    py = (size - k_h) // 2

    if maskable:
        bg = f'<rect width="{size}" height="{size}" fill="#FFFFFF"/>'
    else:
        radius = int(size * 0.22)
        bg = f'<rect width="{size}" height="{size}" rx="{radius}" fill="#FFFFFF"/>'

    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
  {bg}
  <image x="{px}" y="{py}" width="{k_w}" height="{k_h}" href="data:image/png;base64,{png_b64}"/>
</svg>
'''


svg_dir = os.path.join(ROOT, "public")
for name, size, mask in [
    ("icon-192.svg", 192, False),
    ("icon-512.svg", 512, False),
    ("icon-512-maskable.svg", 512, True),
]:
    with open(os.path.join(svg_dir, name), "w", encoding="utf-8") as f:
        f.write(make_svg(size, mask))
    print(f"[svg] {name} ({size}px, maskable={mask}) 完成")

# ============================================================
# 5. 复制一份 512 作为 og-cover（可选，保留）
# ============================================================
with open(os.path.join(svg_dir, "og-cover.svg"), "w", encoding="utf-8") as f:
    f.write(make_svg(512, False))
print("[svg] og-cover.svg 完成")

print("ALL-ICONS-DONE")
