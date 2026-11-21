# Para fotos com arte de texto grande em formato alto (9:16), pede ao modelo de visão a posição vertical
# de um recorte 4:5 (largura total) que mantenha cliente + veículo e NÃO corte linhas de texto ao meio.
# Saída: recorte_texto.json {arquivo: top_fracao}. Sem placa/dado pessoal no prompt nem na resposta.
import json, os, base64, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import classificar as C   # reaproveita token() e call()
D = os.path.dirname(os.path.abspath(__file__))
alvo = json.load(open(os.path.join(D, 'alvo_texto.json')))  # [arquivo, w, h] calculado no box (PIL)
P = """Esta imagem tem {w}x{h} px. Vou recortar uma janela de largura total e altura {ch} px (proporção 4:5), deslocando só na vertical.
Escolha o "top" (px a partir do topo, entre 0 e {mx}) que: 1) mantém as pessoas e o veículo inteiros o máximo possível; 2) NÃO corta nenhuma linha de texto da arte ao meio — cada linha de texto deve ficar totalmente dentro ou totalmente fora da janela (prefira deixar fora textos de título se for preciso para não cortar). Responda só JSON {{"top": <int>, "obs": "<até 10 palavras>"}}. Não escreva placa nem dado pessoal."""
out = {}
for f, w, h in alvo:
    ch = round(w * 5 / 4); mx = h - ch
    parts = [{'text': P.format(w=w, h=h, ch=ch, mx=mx)}, {'inlineData': {'mimeType': 'image/jpeg', 'data': base64.b64encode(open(os.path.join(D, 'small', f), 'rb').read()).decode()}}]
    res, _ = C.call(parts)
    out[f] = max(0, min(mx, int(res['top']))) / h
    print(f, out[f], res.get('obs'), flush=True)
json.dump(out, open(os.path.join(D, 'recorte_texto.json'), 'w'), indent=1)
