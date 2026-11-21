# vendidos-v3: gera 1 webp 600x750 (4:5) por post de ENTREGA, recorte cheio (cover) centrado no "foco"
# (pessoas + veículo) apontado pelo modelo de visão. Sem faixas, sem borrado, sem barras pretas.
# Entrada: classificacao.jsonl (classificar.py) + fotos originais em /workspace/vendidos-insta/.
import json, os, re, csv
from PIL import Image, ImageOps
SRC = '/workspace/vendidos-insta'; D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, 'public', 'vendidos-insta'); os.makedirs(OUT, exist_ok=True)
W, H = 600, 750
MARCAS = {'vw': 'Volkswagen', 'volks': 'Volkswagen', 'gm': 'Chevrolet', 'chevy': 'Chevrolet'}
def crop(im, foco):
    iw, ih = im.size; tr = W / H
    if iw / ih > tr: cw, ch = round(ih * tr), ih
    else: cw, ch = iw, round(iw / tr)
    x0, y0, x1, y1 = (foco if foco and len(foco) == 4 else [0, 0, 1, 1])
    cx = (x0 + x1) / 2 * iw; cy = (y0 + y1) / 2 * ih
    # se a caixa cabe, garante que ela fique inteira dentro do recorte
    left = min(max(cx - cw / 2, 0), iw - cw); top = min(max(cy - ch / 2, 0), ih - ch)
    bw, bh = (x1 - x0) * iw, (y1 - y0) * ih
    if bw <= cw: left = min(max(left, x1 * iw - cw), x0 * iw); left = min(max(left, 0), iw - cw)
    if bh <= ch: top = min(max(top, y1 * ih - ch), y0 * ih); top = min(max(top, 0), ih - ch)
    return im.crop((round(left), round(top), round(left) + cw, round(top) + ch)).resize((W, H), Image.LANCZOS)
def clean(v):
    if not v or str(v).strip().lower() in ('null', 'none', 'desconhecido', '?'): return None
    return str(v).strip()
rows = [json.loads(l) for l in open(os.path.join(D, 'classificacao.jsonl'))]
items = []; resumo = []
for r in rows:
    code = re.search(r'/(?:p|reel|tv)/([^/]+)/', r['link']).group(1)
    keep = r.get('tipo') == 'entrega'
    brand = clean(r.get('marca')); model = clean(r.get('modelo'))
    if brand: brand = MARCAS.get(brand.lower(), brand)
    resumo.append(dict(id=code, data=r['data'], tipo=r.get('tipo'), marca=brand, modelo=model, confianca=r.get('confianca'), melhor_foto=r.get('melhor_foto'), texto_grande=r.get('texto_grande'), motivo=r.get('motivo'), link=r['link']))
    if not keep: continue
    name = f"{r['data']}-{code}.webp"
    im = ImageOps.exif_transpose(Image.open(os.path.join(SRC, r['melhor_foto']))).convert('RGB')
    crop(im, r.get('foco')).save(os.path.join(OUT, name), 'WEBP', quality=78, method=6)
    items.append(dict(id=code, date=r['data'], brand=brand, model=model, src=f'/vendidos-insta/{name}'))
items.sort(key=lambda x: x['date'], reverse=True)
json.dump(items, open(os.path.join(D, 'vendidos-insta.json'), 'w'), ensure_ascii=False, indent=1)
resumo.sort(key=lambda x: x['data'], reverse=True)
with open(os.path.join(D, 'classificacao-v3.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(resumo[0].keys())); w.writeheader(); w.writerows(resumo)
json.dump(resumo, open(os.path.join(D, 'classificacao-v3.json'), 'w'), ensure_ascii=False, indent=1)
print('entregas', len(items), 'sem modelo', sum(1 for i in items if not i['model']), 'descartados', len(rows) - len(items))
