# vendidos-v3: gera 1 webp 600x750 (4:5) por post de ENTREGA, recorte cheio (cover) centrado no "foco"
# (pessoas + veículo) apontado pelo modelo de visão. Sem faixas, sem borrado, sem barras pretas.
# Entrada: classificacao.jsonl (classificar.py) + verificacao.jsonl (verificar.py: foto com pessoa JUNTO do veículo)
# + recorte_texto.json (recorte_texto.py: posição vertical que não corta texto da arte nas fotos altas 9:16)
# + fotos originais em /workspace/vendidos-insta/. Gera também a versão 360w e um LQIP (WebP ~16x20 em base64).
import json, os, re, csv, base64, io
from PIL import Image, ImageOps
SRC = '/workspace/vendidos-insta'; D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, 'public', 'vendidos-insta'); os.makedirs(OUT, exist_ok=True)
W, H = 600, 750
MARCAS = {'vw': 'Volkswagen', 'volks': 'Volkswagen', 'gm': 'Chevrolet', 'chevy': 'Chevrolet'}
def crop(im, foco, top_frac=None, centro_v=False):
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
    if top_frac is not None: top = min(max(top_frac * ih, 0), ih - ch)
    elif centro_v: top = (ih - ch) / 2
    return im.crop((round(left), round(top), round(left) + cw, round(top) + ch)).resize((W, H), Image.LANCZOS)
def clean(v):
    if not v or str(v).strip().lower() in ('null', 'none', 'desconhecido', '?'): return None
    return str(v).strip()
rows = [json.loads(l) for l in open(os.path.join(D, 'classificacao.jsonl'))]
ver = {v['link']: v for v in (json.loads(l) for l in open(os.path.join(D, 'verificacao.jsonl')))}
rt = json.load(open(os.path.join(D, 'recorte_texto.json'))) if os.path.exists(os.path.join(D, 'recorte_texto.json')) else {}
items = []; resumo = []
for r in rows:
    code = re.search(r'/(?:p|reel|tv)/([^/]+)/', r['link']).group(1)
    v = ver.get(r['link'], {})
    keep = r.get('tipo') == 'entrega' and v.get('pessoa_com_carro') is True and bool(v.get('foto'))
    if keep: r = dict(r, melhor_foto=v['foto'], foco=v.get('foco') or r.get('foco'), texto_grande=v.get('texto_grande'))
    r['pessoa_com_carro'] = v.get('pessoa_com_carro')
    brand = clean(r.get('marca')); model = clean(r.get('modelo'))
    if brand: brand = MARCAS.get(brand.lower(), brand)
    resumo.append(dict(id=code, data=r['data'], tipo=r.get('tipo'), marca=brand, modelo=model, confianca=r.get('confianca'), melhor_foto=r.get('melhor_foto'), texto_grande=r.get('texto_grande'), pessoa_com_carro=r.get('pessoa_com_carro'), motivo=r.get('motivo'), link=r['link']))
    if not keep: continue
    name = f"{r['data']}-{code}.webp"
    im = ImageOps.exif_transpose(Image.open(os.path.join(SRC, r['melhor_foto']))).convert('RGB')
    out = crop(im, r.get('foco'), rt.get(r['melhor_foto']), bool(r.get('texto_grande')))
    out.save(os.path.join(OUT, name), 'WEBP', quality=74, method=6)
    small = name.replace('.webp', '-360.webp')
    out.resize((360, 450), Image.LANCZOS).save(os.path.join(OUT, small), 'WEBP', quality=72, method=6)
    b = io.BytesIO(); out.resize((16, 20), Image.LANCZOS).save(b, 'WEBP', quality=40)
    lqip = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
    items.append(dict(id=code, date=r['data'], brand=brand, model=model, src=f'/vendidos-insta/{name}', srcSmall=f'/vendidos-insta/{small}', lqip=lqip))
items.sort(key=lambda x: x['date'], reverse=True)
json.dump(items, open(os.path.join(D, 'vendidos-insta.json'), 'w'), ensure_ascii=False, indent=1)
resumo.sort(key=lambda x: x['data'], reverse=True)
with open(os.path.join(D, 'classificacao-v3.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(resumo[0].keys())); w.writeheader(); w.writerows(resumo)
json.dump(resumo, open(os.path.join(D, 'classificacao-v3.json'), 'w'), ensure_ascii=False, indent=1)
print('entregas', len(items), 'sem modelo', sum(1 for i in items if not i['model']), 'descartados', len(rows) - len(items))
