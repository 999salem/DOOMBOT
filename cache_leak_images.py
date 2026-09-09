#!/usr/bin/env python3
"""Best-effort local thumbnail cache for DOOMBOT's curated visual database."""
from __future__ import annotations
import io, json, time
from pathlib import Path
import requests
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'data' / 'leak-images.json'
OUT = ROOT / 'assets' / 'images' / 'leaks'
OUT.mkdir(parents=True, exist_ok=True)
UA = 'Mozilla/5.0 (compatible; SALEM-Doomsday-Intel/1.1; +GitHub Pages image cache)'

def download(url: str) -> bytes:
    response = requests.get(
        url,
        headers={'User-Agent': UA, 'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'},
        timeout=35,
        allow_redirects=True
    )
    response.raise_for_status()
    ctype = response.headers.get('content-type', '')
    if 'image' not in ctype and len(response.content) < 1024:
        raise RuntimeError(f'not image: {ctype}')
    return response.content

def process(raw: bytes, path: Path):
    image = Image.open(io.BytesIO(raw))
    image = ImageOps.exif_transpose(image).convert('RGB')
    image.thumbnail((1200, 900), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (1200, 750), (5, 8, 6))
    fit = ImageOps.contain(image, (1200, 750), Image.Resampling.LANCZOS)
    canvas.paste(fit, ((1200-fit.width)//2, (750-fit.height)//2))
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, 'JPEG', quality=84, optimize=True, progressive=True)

def main():
    data = json.loads(DB.read_text(encoding='utf-8'))
    ok = fail = skip = 0
    for item in data.get('items', []):
        url = item.get('image_url') or ''
        cache = item.get('cache_path') or ''
        if not url or not cache:
            skip += 1
            continue
        path = ROOT / cache
        try:
            process(download(url), path)
            ok += 1
            print('OK ', item.get('id'), path.relative_to(ROOT))
        except Exception as exc:
            fail += 1
            print('ERR', item.get('id'), exc)
        time.sleep(.25)
    print(f'cached={ok} failed={fail} skipped={skip}')
    # External hosts can block individual images; never break the whole site refresh for that.

if __name__ == '__main__':
    main()
