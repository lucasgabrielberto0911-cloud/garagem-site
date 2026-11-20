# Gera 1 webp 4:3 (640x480, fundo desfocado da própria foto) por post + manifesto JSON.
import csv, json, collections, re, os
from PIL import Image, ImageFilter, ImageOps
from concurrent.futures import ProcessPoolExecutor
SRC='/workspace/vendidos-insta'; OUT='/workspace/vendidos-build/public/vendidos-insta'
W,H=640,480
rows=list(csv.DictReader(open(f'{SRC}/lista.csv')))
g=collections.OrderedDict()
for r in rows: g.setdefault(r['link_post'],[]).append(r)
def unk(v): return (not v) or v.strip().lower()=='desconhecido'
def job(item):
    link,rs=item; r=rs[0]
    code=re.search(r'/(?:p|reel|tv)/([^/]+)/',link).group(1)
    name=f"{r['data_post']}-{code}.webp"
    im=ImageOps.exif_transpose(Image.open(f"{SRC}/{r['arquivo']}")).convert('RGB')
    bg=ImageOps.fit(im,(W,H)).filter(ImageFilter.GaussianBlur(24))
    fg=im.copy(); fg.thumbnail((W,H),Image.LANCZOS)
    bg.paste(fg,((W-fg.width)//2,(H-fg.height)//2))
    bg.save(f'{OUT}/{name}','WEBP',quality=72,method=6)
    obs=set(filter(None,r['obs'].split(';')))
    brand=None if unk(r['marca']) else r['marca']
    model=None if unk(r['modelo']) else r['modelo']
    year=None if unk(r['ano']) else int(r['ano'])
    if 'compilacao' in obs: brand=model=year=None
    return dict(id=code,date=r['data_post'],brand=brand,model=model,year=year,src=f'/vendidos-insta/{name}',href=link)
with ProcessPoolExecutor() as ex: items=list(ex.map(job,g.items()))
items.sort(key=lambda x:x['date'],reverse=True)
json.dump(items,open('/workspace/vendidos-build/vendidos-insta.json','w'),ensure_ascii=False,indent=1)
print(len(items))
