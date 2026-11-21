# Gera 1 webp 4:3 (640x480, fundo desfocado da própria foto) por post de ENTREGA + manifesto JSON.
# Só entram posts com pelo menos uma foto com cliente (tem_cliente=sim); a imagem é a 1ª foto com cliente.
# Posts sem foto com cliente (anúncio do carro sozinho, interior) ficam de fora.
import csv, json, collections, re, os
from PIL import Image, ImageFilter, ImageOps
from concurrent.futures import ProcessPoolExecutor
SRC='/workspace/vendidos-insta'; OUT='/workspace/vendidos-build/public2/vendidos-insta'
os.makedirs(OUT,exist_ok=True)
W,H=640,480
rows=list(csv.DictReader(open(f'{SRC}/lista.csv')))
g=collections.OrderedDict()
for r in rows: g.setdefault(r['link_post'],[]).append(r)
def unk(v): return (not v) or v.strip().lower()=='desconhecido'
def job(item):
    link,rs=item; meta=rs[0]; r=next(x for x in rs if x['tem_cliente']=='sim')
    code=re.search(r'/(?:p|reel|tv)/([^/]+)/',link).group(1)
    name=f"{r['data_post']}-{code}.webp"
    im=ImageOps.exif_transpose(Image.open(f"{SRC}/{r['arquivo']}")).convert('RGB')
    bg=ImageOps.fit(im,(W,H)).filter(ImageFilter.GaussianBlur(24))
    fg=im.copy(); fg.thumbnail((W,H),Image.LANCZOS)
    bg.paste(fg,((W-fg.width)//2,(H-fg.height)//2))
    bg.save(f'{OUT}/{name}','WEBP',quality=72,method=6)
    obs=set(filter(None,(meta['obs']+';'+r['obs']).split(';')))
    brand=None if unk((meta['marca'] or r['marca'])) else (meta['marca'] or r['marca'])
    model=None if unk((meta['modelo'] or r['modelo'])) else (meta['modelo'] or r['modelo'])
    year=None if unk((meta['ano'] or r['ano'])) else int((meta['ano'] or r['ano']))
    if 'compilacao' in obs: brand=model=year=None
    return dict(id=code,date=r['data_post'],brand=brand,model=model,year=year,src=f'/vendidos-insta/{name}',href=link)
posts=[(k,v) for k,v in g.items() if any(x['tem_cliente']=='sim' for x in v)]
with ProcessPoolExecutor() as ex: items=list(ex.map(job,posts))
items.sort(key=lambda x:x['date'],reverse=True)
json.dump(items,open('/workspace/vendidos-build/vendidos-insta-v2.json','w'),ensure_ascii=False,indent=1)
print(len(items))
