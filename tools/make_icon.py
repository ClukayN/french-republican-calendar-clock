# -*- coding: utf-8 -*-
"""生成应用图标：羊皮纸表盘 + 24 时蓝针 + 十进红针。"""
import math
import os
from PIL import Image, ImageDraw

S = 1024          # 超采样画布
SCALE = S / 256.0
OUT = r"D:\dshWorkspace\output\共和历时钟\build\app.ico"

PAPER = (246, 236, 214, 255)
PAPER_EDGE = (232, 217, 188, 255)
INK = (35, 27, 17, 255)
BRASS = (180, 148, 89, 255)
RED = (156, 42, 36, 255)
BLUE = (30, 58, 95, 255)
HUB = (107, 86, 54, 255)
CREAM = (252, 247, 234, 255)


def sc(v):
    return v * SCALE


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = S / 2.0

    # 外圈投影
    for i in range(14, 0, -1):
        a = int(38 * (i / 14.0) ** 1.6)
        r = sc(120) + i * sc(0.55)
        d.ellipse([c - r, c - r, c + r, c + r], fill=(60, 42, 16, a))

    # 表盘
    r = sc(119)
    d.ellipse([c - r, c - r, c + r, c + r], fill=PAPER_EDGE)
    r2 = sc(115)
    d.ellipse([c - r2, c - r2, c + r2, c + r2], fill=PAPER)

    # 外框
    w = max(2, int(sc(6)))
    r3 = sc(114)
    d.ellipse([c - r3, c - r3, c + r3, c + r3], outline=INK, width=w)
    r4 = sc(105)
    d.ellipse([c - r4, c - r4, c + r4, c + r4], outline=BRASS, width=max(1, int(sc(1.6))))

    # 24 时刻度
    for h in range(24):
        ang = math.radians(h * 15.0)
        big = (h % 6 == 0)
        inner = sc(96 if big else 100)
        outer = sc(110 if big else 106)
        x1, y1 = c + inner * math.sin(ang), c - inner * math.cos(ang)
        x2, y2 = c + outer * math.sin(ang), c - outer * math.cos(ang)
        d.line([x1, y1, x2, y2], fill=INK if big else BRASS,
               width=max(1, int(sc(2.6 if big else 1.3))))

    # 十进时刻度（内圈，红）
    for k in range(0, 100):
        ang = math.radians(k * 3.6)
        big = (k % 10 == 0)
        inner = sc(80 if big else 84)
        outer = sc(94 if big else 90)
        x1, y1 = c + inner * math.sin(ang), c - inner * math.cos(ang)
        x2, y2 = c + outer * math.sin(ang), c - outer * math.cos(ang)
        d.line([x1, y1, x2, y2],
               fill=RED if big else (190, 140, 130, 255),
               width=max(1, int(sc(2.2 if big else 0.9))))

    # 蓝针（24 时）指向 12
    d.line([c, c + sc(12), c, c - sc(74)], fill=BLUE, width=int(sc(7)))
    # 红针（十进时）指向 3.6 时位
    ang = math.radians(3.6 * 36)
    d.line([c, c, c + sc(50) * math.sin(ang), c - sc(50) * math.cos(ang)],
           fill=RED, width=int(sc(5)))
    # 秒针
    ang = math.radians(210)
    d.line([c, c, c + sc(40) * math.sin(ang), c - sc(40) * math.cos(ang)],
           fill=(120, 90, 60, 255), width=max(1, int(sc(2))))

    # 中心
    r5 = sc(8.5)
    d.ellipse([c - r5, c - r5, c + r5, c + r5], fill=HUB)
    r6 = sc(4.0)
    d.ellipse([c - r6, c - r6, c + r6, c + r6], fill=CREAM)

    sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
    img.save(OUT, format="ICO", sizes=[(s, s) for s in sizes])
    print("wrote", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
