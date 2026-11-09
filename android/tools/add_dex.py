# -*- coding: utf-8 -*-
"""把 classes.dex 塞进 aapt2 生成的 APK。

不用 `jar uf`：jar 会重写整个 zip，实测会让 AssetManager 看不到 assets
（getAssets().list("www") 返回空），这里逐条复制条目再追加 dex。
"""
import os
import sys
import zipfile

src_apk = sys.argv[1]
dex_path = sys.argv[2]
out_apk = sys.argv[3]

if os.path.exists(out_apk):
    os.remove(out_apk)

with zipfile.ZipFile(src_apk, 'r') as zin:
    names = zin.namelist()
    with zipfile.ZipFile(out_apk, 'w', zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            zi = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            zi.compress_type = info.compress_type
            zi.external_attr = info.external_attr
            zout.writestr(zi, data)
        if 'classes.dex' not in names:
            zi = zipfile.ZipInfo('classes.dex', date_time=(2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            with open(dex_path, 'rb') as f:
                zout.writestr(zi, f.read())

print('wrote', out_apk, os.path.getsize(out_apk), 'bytes')
