# Reclassifica os posts de Vendido do Instagram com modelo de visão (Vertex, conta de serviço da VM).
# Não pede nem grava placa, nome, CPF ou telefone. Saída: classificacao.jsonl (1 linha por post).
import csv, json, base64, os, sys, time, collections, urllib.request, threading
from concurrent.futures import ThreadPoolExecutor
MODEL = os.environ.get('MODEL', 'gemini-4-carbon')
PROJ = 'gen-lang-client-0672670913'
URL = f'https://aiplatform.googleapis.com/v1/projects/{PROJ}/locations/global/publishers/google/models/{MODEL}:generateContent'
D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, 'classificacao.jsonl')
_tok = {'t': None, 'exp': 0}; lock = threading.Lock()
def token():
    with lock:
        if time.time() > _tok['exp']:
            r = urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', headers={'Metadata-Flavor': 'Google'})
            d = json.load(urllib.request.urlopen(r)); _tok['t'] = d['access_token']; _tok['exp'] = time.time() + d['expires_in'] - 120
        return _tok['t']
PROMPT = """Você analisa posts do Instagram de uma revenda de carros e motos seminovos (Sua Garagem, Linhares-ES).
As imagens abaixo são TODAS as fotos de UM post (cada uma precedida do nome do arquivo). Data do post: {data}. Palpite antigo (pode estar errado): marca={marca} modelo={modelo}.
Responda SÓ um JSON com:
- "tipo": "entrega" se o post registra a venda/entrega de UM veículo específico a um cliente (cliente junto do carro/moto, "entregue", "vendido", "mais uma conquista", "chave na mão" de um carro só); "compilacao" se junta várias vendas/números (ex.: "23 sonhos realizados", colagem de vários clientes); "anuncio" se é anúncio do veículo à venda (carro sozinho, interior, preço, ficha); "institucional" (loja, equipe, aviso, sorteio); "outro".
- "marca" e "modelo" do veículo entregue (leia o texto da arte, ex. "CITY 2018" → Honda / City; "I30 PRETO" → Hyundai / i30; "SAVEIRO ROBUST" → Volkswagen / Saveiro Robust; e reconheça pelo próprio veículo: grade, faróis, logotipo, lanternas). Use a grafia comercial (ex.: "Onix", "HB20", "EcoSport", "Corolla", "Biz 125", "CG 160"). Não inclua ano, cor, versão longa nem motorização no modelo (versão curta tipo "Kicks Sense", "Onix Plus" pode). null só se for realmente impossível.
- "confianca": número 0 a 1 para marca/modelo.
- "melhor_foto": nome do arquivo da melhor foto do post para a vitrine: cliente + veículo bem visíveis, de preferência sem texto grande da arte na frente; se só houver arte, a que mostra melhor cliente e carro.
- "texto_grande": true se a melhor foto tem texto/arte grande sobreposto.
- "foco": caixa [x0,y0,x1,y1] em frações 0–1 da melhor foto que contém as pessoas e o veículo (área a preservar num recorte).
- "motivo": até 12 palavras explicando o tipo.
NUNCA escreva placa, nome de pessoa, telefone ou qualquer dado pessoal. Não transcreva a placa."""
def call(parts):
    body = json.dumps({'contents': [{'role': 'user', 'parts': parts}], 'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.2}}).encode()
    for a in range(6):
        try:
            r = urllib.request.Request(URL, data=body, headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'})
            d = json.load(urllib.request.urlopen(r, timeout=180))
            txt = ''.join(p.get('text', '') for p in d['candidates'][0]['content']['parts'] if not p.get('thought'))
            return json.loads(txt), d.get('usageMetadata', {})
        except urllib.error.HTTPError as e:
            msg = e.read()[:200]; time.sleep(5 * (a + 1) if e.code in (429, 500, 503) else 2)
            if e.code not in (429, 500, 503) and a > 1: raise RuntimeError(msg)
        except Exception as e:
            time.sleep(3 * (a + 1)); err = e
    raise RuntimeError('falhou')
rows = list(csv.DictReader(open(os.path.join(D, 'lista.csv'))))
g = collections.OrderedDict()
for r in rows: g.setdefault(r['link_post'], []).append(r)
done = set()
if os.path.exists(OUT):
    for l in open(OUT): done.add(json.loads(l)['link'])
wl = threading.Lock(); usage = collections.Counter()
def job(item):
    link, rs = item
    if link in done: return
    r0 = rs[0]
    parts = [{'text': PROMPT.format(data=r0['data_post'], marca=r0['marca'] or '?', modelo=r0['modelo'] or '?')}]
    for r in rs[:10]:
        parts.append({'text': 'arquivo: ' + r['arquivo']})
        parts.append({'inlineData': {'mimeType': 'image/jpeg', 'data': base64.b64encode(open(os.path.join(D, 'small', r['arquivo']), 'rb').read()).decode()}})
    try:
        res, u = call(parts)
    except Exception as e:
        print('ERRO', link, e, flush=True); return
    if res.get('melhor_foto') not in [r['arquivo'] for r in rs]: res['melhor_foto'] = next((r['arquivo'] for r in rs if r['tem_cliente'] == 'sim'), rs[0]['arquivo'])
    res.update(link=link, data=r0['data_post'], fotos=len(rs), tem_cliente_antigo=any(r['tem_cliente'] == 'sim' for r in rs), obs_antigo=r0['obs'])
    with wl:
        open(OUT, 'a').write(json.dumps(res, ensure_ascii=False) + '\n')
        for k in ('promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount'): usage[k] += u.get(k, 0)
items = list(g.items())
if len(sys.argv) > 1: items = items[:int(sys.argv[1])]
with ThreadPoolExecutor(int(os.environ.get("PAR","8"))) as ex: list(ex.map(job, items))
print('USO', MODEL, dict(usage), 'linhas', sum(1 for _ in open(OUT)))
