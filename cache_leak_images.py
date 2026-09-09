#!/usr/bin/env python3
from __future__ import annotations
import io,json,os,time
from pathlib import Path
import requests
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'data/leak-images.json'
OUT=ROOT/'assets/images/leaks'
OUT.mkdir(parents=True,exist_ok=True)
UA='Mozilla/5.0 (compatible; SALEM-Doomsday-Intel/1.0; +GitHub Pages image cache)'

def download(url:str)->bytes:
    r=requests.get(url,headers={'User-Agent':UA,'Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'},timeout=35,allow_redirects=True)
    r.raise_for_status()
    ctype=r.headers.get('content-type','')
    if 'image' not in ctype and len(r.content)<1024: raise RuntimeError(f'not image: {ctype}')
    return r.content

def process(raw:bytes,path:Path):
    im=Image.open(io.BytesIO(raw))
    im=ImageOps.exif_transpose(im).convert('RGB')
    im.thumbnail((1200,900),Image.Resampling.LANCZOS)
    canvas=Image.new('RGB',(1200,750),(5,8,6))
    fit=ImageOps.contain(im,(1200,750),Image.Resampling.LANCZOS)
    canvas.paste(fit,((1200-fit.width)//2,(750-fit.height)//2))
    canvas.save(path,'JPEG',quality=84,optimize=True,progressive=True)

def main():
    data=json.loads(DB.read_text(encoding='utf-8'))
    ok=fail=skip=0
    for item in data['items']:
        url=item.get('image_url') or ''
        cache=item.get('cache_path') or ''
        if not url or not cache: skip+=1; continue
        path=ROOT/cache
        try:
            raw=download(url); process(raw,path); ok+=1
            print('OK ',item['id'],path.relative_to(ROOT))
        except Exception as e:
            fail+=1; print('ERR',item['id'],e)
        time.sleep(.35)
    print(f'cached={ok} failed={fail} skipped={skip}')
    if not ok and fail: raise SystemExit(2)

if __name__=='__main__': main()
