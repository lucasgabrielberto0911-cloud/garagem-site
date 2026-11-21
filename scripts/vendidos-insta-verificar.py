# 2ª passada (pedido do Lucas 21/11 11:04): só entra post cuja foto escolhida mostra CLIENTE (pessoa) JUNTO do veículo.
# Para cada entrega da 1ª passada, reenvia as fotos do post e pede a melhor foto com pessoa + veículo.
# Saída: verificacao.jsonl. Sem placa/nome/dado pessoal no prompt nem na resposta.
import json, os, base64, csv, collections, threading, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import classificar as C
D = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(D, 'verificacao.jsonl')
rows = list(csv.DictReader(open(os.path.join(D, 'lista.csv'))))
g = collections.OrderedDict()
for r in rows: g.setdefault(r['link_post'], []).append(r)
ent = [json.loads(l) for l in open(os.path.join(D, 'classificacao.jsonl'))]
ent = [e for e in ent if e.get('tipo') == 'entrega']
done = set(json.loads(l)['link'] for l in open(OUT)) if os.path.exists(OUT) else set()
P = """Fotos de UM post de entrega de veículo de uma revenda (cada uma precedida do nome do arquivo). Veículo: {marca} {modelo}.
Responda só JSON:
- "foto": nome do arquivo da melhor foto que mostra PELO MENOS UMA PESSOA (o cliente) JUNTO DO VEÍCULO, ambos bem visíveis na mesma foto. Prefira foto sem texto grande da arte por cima; entre as válidas, a mais bonita/nítida. Se NENHUMA foto tiver pessoa junto do veículo, use null.
- "pessoa_com_carro": true/false para a foto escolhida (false se foto=null).
- "texto_grande": true se a foto escolhida tem texto/arte grande sobreposto.
- "foco": [x0,y0,x1,y1] frações 0–1 da caixa que contém as pessoas e o veículo na foto escolhida.
NUNCA escreva placa, nome ou dado pessoal."""
wl = threading.Lock()
def job(e):
    if e['link'] in done: return
    rs = g[e['link']]
    parts = [{'text': P.format(marca=e.get('marca') or '', modelo=e.get('modelo') or '')}]
    for r in rs[:10]:
        parts += [{'text': 'arquivo: ' + r['arquivo']}, {'inlineData': {'mimeType': 'image/jpeg', 'data': base64.b64encode(open(os.path.join(D, 'small', r['arquivo']), 'rb').read()).decode()}}]
    try: res, _ = C.call(parts)
    except Exception as ex: print('ERRO', e['link'], ex, flush=True); return
    if res.get('foto') not in [r['arquivo'] for r in rs]: res['foto'] = None; res['pessoa_com_carro'] = False
    res['link'] = e['link']
    with wl: open(OUT, 'a').write(json.dumps(res, ensure_ascii=False) + '\n')
with ThreadPoolExecutor(int(os.environ.get('PAR', '20'))) as ex: list(ex.map(job, ent))
print('linhas', sum(1 for _ in open(OUT)))
