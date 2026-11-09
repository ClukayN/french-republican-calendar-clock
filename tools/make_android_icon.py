# -*- coding: utf-8 -*-
"""生成 Android 启动图标：沿用桌面版的羊皮纸表盘，导出各密度 mipmap 与自适应前景。"""
import math
import os
from PIL import Image, ImageDraw

OUT_DIR = r"D:\dshWorkspace\output\共和历时钟\android\src\res"

PAPER = (246, 236, 214, 255)
PAPER_EDGE = (232, 217, 188, 255)
INK = (35, 27, 17, 255)
BRASS = (180, 148, 89, 255)
RED = (156, 42, 36, 255)
BLUE = (30, 58, 95, 255)
HUB = (107, 86, 54, 255)
CREAM = (252, 247, 234, 255)

DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

# 自适应图标前景：108dp 画布，中心 72dp 安全区
FG_DENSITIES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}


def draw_face(size, radius_scale=1.0):
    """在 size×size 画布上画表盘，radius_scale 控制盘面占画布比例。"""
    ss = 8  # 超采样
    S = size * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = S / 2.0
    R = (S / 2.0) * 0.98 * radius_scale

    def u(v):
        return v * (R / 119.0)

    r = u(119)
    d.ellipse([c - r, c - r, c + r, c + r], fill=PAPER_EDGE)
    r2 = u(115)
    d.ellipse([c - r2, c - r2, c + r2, c + r2], fill=PAPER)

    d.ellipse([c - u(114), c - u(114), c + u(114), c + u(114)],
              outline=INK, width=max(1, int(u(6))))
    d.ellipse([c - u(105), c - u(105), c + u(105), c + u(105)],
              outline=BRASS, width=max(1, int(u(1.6))))

    for h in range(24):
        ang = math.radians(h * 15.0)
        big = (h % 6 == 0)
        inner = u(96 if big else 100)
        outer = u(110 if big else 106)
        d.line([c + inner * math.sin(ang), c - inner * math.cos(ang),
                c + outer * math.sin(ang), c - outer * math.cos(ang)],
               fill=INK if big else BRASS,
               width=max(1, int(u(2.6 if big else 1.3))))

    for k in range(0, 100):
        ang = math.radians(k * 3.6)
        big = (k % 10 == 0)
        inner = u(80 if big else 84)
        outer = u(94 if big else 90)
        d.line([c + inner * math.sin(ang), c - inner * math.cos(ang),
                c + outer * math.sin(ang), c - outer * math.cos(ang)],
               fill=RED if big else (190, 140, 130, 255),
               width=max(1, int(u(2.2 if big else 0.9))))

    d.line([c, c + u(12), c, c - u(74)], fill=BLUE, width=max(2, int(u(7))))
    ang = math.radians(3.6 * 36)
    d.line([c, c, c + u(50) * math.sin(ang), c - u(50) * math.cos(ang)],
           fill=RED, width=max(2, int(u(5))))
    ang = math.radians(210)
    d.line([c, c, c + u(40) * math.sin(ang), c - u(40) * math.cos(ang)],
           fill=(120, 90, 60, 255), width=max(1, int(u(2))))

    d.ellipse([c - u(8.5), c - u(8.5), c + u(8.5), c + u(8.5)], fill=HUB)
    d.ellipse([c - u(4.0), c - u(4.0), c + u(4.0), c + u(4.0)], fill=CREAM)

    return img.resize((size, size), Image.LANCZOS)


def main():
    for dens, px in DENSITIES.items():
        folder = os.path.join(OUT_DIR, "mipmap-" + dens)
        os.makedirs(folder, exist_ok=True)
        draw_face(px).save(os.path.join(folder, "ic_launcher.png"))

    # 自适应图标前景：72/108 的盘面，其余留透明
    for dens, px in FG_DENSITIES.items():
        folder = os.path.join(OUT_DIR, "mipmap-" + dens)
        os.makedirs(folder, exist_ok=True)
        face = draw_face(px, radius_scale=72.0 / 108.0)
        canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        canvas.alpha_composite(face)
        canvas.save(os.path.join(folder, "ic_launcher_fg.png"))

    print("icons written to", OUT_DIR)


if __name__ == "__main__":
    main()
