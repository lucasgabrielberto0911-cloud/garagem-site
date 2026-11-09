# Ordem do Kicks e dependências do Storage — Garagem

Atualização de 2026-11-09 para o PR #433, branch `reserva/codex-verificacao-fotos-estoque`.

## Resumo

- O diff final contra `main` não altera workflows. `verificar-fotos.yml` foi criado e removido em commits desta branch, e não existe na base. A verificação nova fica somente no comando manual `npx tsx scripts/verificar-fotos.ts`.
- A correção da foto de capa do Kicks fica fora do escopo deste PR e permanece pendente; este documento registra apenas o diagnóstico. O E2E de ordem valida um veículo fictício, sem corrigir nem certificar a escolha visual do Kicks real.
- “Recomendados” e as mudanças de categoria padrão foram retirados do PR; ficam para outro trabalho.
- Inventário de metadados por SELECT somente leitura: 361 fotos de 44 veículos; 128 registros com galeria e miniatura no Blob; 233 registros ainda referenciam Storage, em 32 veículos. Desses, 16 fotos são de anúncios disponíveis (Haval H6: 13; Fazer 250: 2; Ka+: 1). O inventário completo abaixo também inclui vendidos, porque suas fichas podem continuar acessíveis.
- O retrato do fundador também depende do Storage: `SiteSettings.id=default`, campo `founderPhotoUrl`, URL https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787433281678-19e323c7-3aab-4778-97e7-36bfb4b3f57c.webp. A consulta de Testimonial não encontrou fotos preenchidas.
- As sete fotos do Kicks estão no Blob. Ordem no banco, JSON-LD público e capa da API conferem. A captura local `/home/lucas/ficha-prints/kicks-01-topo.png` mostra banco traseiro na foto 1/7; `/home/lucas/ficha-prints/estoque-mobile.png` mostra o mesmo interior na capa do card. Isso confirma o problema editorial da capa salva, sem demonstrar bug de ordenação no código. A captura não identifica qual dos outros seis IDs deve virar a nova capa.
- HTTP 402 e desbloqueio por volta de 15/11 são informações fornecidas pelo solicitante, não medições novas. Não houve GET/HEAD de fotos de produção, download, listagem de bucket, alteração de dados ou mudança de variáveis na Vercel nesta atualização. GET limitou-se ao HTML e à API do Kicks; consultas SQL limitaram-se a metadados públicos de fotos.

## Bloqueio de egress público e limite da correção

O código anterior escondia Storage atrás de `/fotos/v1/...` e ainda o buscava no servidor. Agora essas referências legadas retornam 410 com `Cache-Control: no-store`, sem fetch nem fallback ao Storage. As imagens de veículos que já estão no Blob continuam usando suas URLs. URLs diretas de Storage fora do contrato conhecido (outro projeto, documentos, assinatura ou recorte desconhecido) viram placeholder local na apresentação, em vez de escapar como link direto. A rota aceita também `/fotos/v1/original/blob/<caminho>` e `/fotos/v1/1280-contain-q78/blob/<caminho>`, com origem fixa no Blob da loja, sem redirects e com o limite de bytes já existente.

O catálogo JPEG antes rejeitava Blob no carregador compartilhado e tentava baixar Storage com service role. O caminho público agora aceita somente o Blob da loja e converte WebP em JPEG limitado a 1280 px, preservando limites de tamanho e bloqueio de redirects. O carregador administrativo permanece separado por modo de origem. O zoom público redireciona somente para uma foto publicada no Blob; não busca nem gera cópias no Storage ou no bucket privado.

**Não confundir bloqueio de rede com migração concluída.** As 233 referências de veículos e o retrato acima continuam no banco, sem cópia no Blob comprovada. Em miss de cache, as referências legadas terão resposta 410; a recuperação existente dos componentes de veículo pode mostrar o placeholder. O catálogo JPEG das referências antigas também permanece indisponível. Não foram removidas fotos do banco nem substituídas por imagens de outros carros. Não é possível recuperar os pixels ausentes com uma mudança de URL. A conclusão depende de cópia local autorizada e da publicação de cada arquivo no Blob por responsável autorizado. Nenhum merge/deploy foi feito por Codex.

A verificação manual agora alerta sobre referências legadas mesmo se um cache responder 200. Ela continua sem executar automaticamente.

## Nissan Kicks — diagnóstico prioritário

Veículo `cmsnsjelx0000la04wxu40b89`, Nissan Kicks SL 1.6 Flex Start XTRONIC 2019.

Evidências:

- `src/lib/vehicles.ts:84`: seleção da ficha usa `photos.orderBy.order=asc`; o fallback legado também. O admin usa o mesmo critério em `src/app/admin/veiculos/[id]/page.tsx:63`.
- `src/lib/public-stock.ts:45`: card usa a primeira foto por `order asc`.
- `src/components/site/VehicleGallery.tsx:206`: renderiza `photos.map` na ordem recebida; não ordena por nome/URL. Lightbox recebe o mesmo array.
- `src/lib/admin-photo-reconcile.ts:26`: salvamento atribui `order` pela posição recebida no formulário. A URL e o prefixo `oNN` são referências de arquivo, não o critério de ordenação.
- SELECT em `Photo` encontrou sete ordens distintas, 0 a 6. GET de https://www.suagaragem.net/estoque/nissan-kicks-sl-1-6-flex-start-xtronic-2019-cmsnsjelx0000la04wxu40b89 encontrou as mesmas sete URLs nessa ordem. GET de `/api/estoque?q=kicks&category=carro` encontrou a mesma capa da posição 0. Não há evidência de cache divergente nesses metadados.

| Posição atual (order) | Photo.id | URL (galeria e thumbnailUrl iguais) |
| --- | --- | --- |
| 0 | cmufpkghk000bi304btj4ty52 | https://t6ze7ss5b2a5svfd.public.blob.vercel-storage.com/estoque/cmsnsjelx0000la04wxu40b89/o00-cmufpkghk000bi304btj4ty52-T9iuDoOMegqqWhEvan3qBzeWbgyCkW.jpg |
| 1 | cmufpkghk000ci304afth4ztd | https://t6ze7ss5b2a5svfd.public.blob.vercel-storage.com/estoque/cmsnsjelx0000la04wxu40b89/o01-cmufpkghk000ci304afth4ztd-7IXWxagzpqUZkOAp7ysGnsD6RAPpiz.jpg |
| 2 | cmufpkghk000di304ypfib3r2 | https://t6ze7ss5b2a5svfd.public.blob.vercel-storage.com/estoque/cmsnsjelx0000la04wxu40b89/o02-cmufpkghk000di304ypfib3r2-NGI1i51MwbEDQITFxxCln2b0cEeibW.jpg |
| 3 | cmufpkghk000ei304zqoqdrcm | https://t6ze7ss5b2a5svfd.public.blob.vercel-storage.com/estoque/cmsnsjelx0000la04wxu40b89/o03-cmufpkghk000ei304zqoqdrcm-qrAHIG32nEzkCTi5qLSXM85JGo8tVX.jpg |
| 4 | cmufpkghk000fi304cp8a4abt | https://t6ze7ss5b2a5svfd.public.blob.vercel-storage.com/estoque/cmsnsjelx0000la04wxu40b89/o04-cmufpkghk000fi304cp8a4abt-gFcxPh9rHDvazKMjcnOzPqU8CbuwIG.jpg |
| 5 | cmufpkghk000gi304q9xntuyp | https://t6ze7ss5b2a5svfd.public.blob.vercel-storage.com/estoque/cmsnsjelx0000la04wxu40b89/o05-cmufpkghk000gi304q9xntuyp-hvcsZt93RSNJw85DgyLGE0BHcq4ATg.jpg |
| 6 | cmufpkghk000hi304q6kqvhgp | https://t6ze7ss5b2a5svfd.public.blob.vercel-storage.com/estoque/cmsnsjelx0000la04wxu40b89/o06-cmufpkghk000hi304q6kqvhgp-mw9D2eJ1PKDwLDUZ5DPoiX1dBf9zpT.jpg |

A evidência visual disponível é uma captura local já existente (sem novo download de fotos). Ela mostra o interior traseiro como primeira foto. Comparada com a ordem atual dos metadados, é consistente com capa inadequada no cadastro; não atesta visualmente os demais seis arquivos do Blob.

O relatório inicial não sinalizou o Kicks porque compara igualdade da capa do card com a primeira foto da ficha. Ambas apontam para a mesma posição inadequada; essa regra detecta divergência técnica, mas não reconhece foto de interior nem escolhe a melhor capa. O upload atual é sequencial (`VehiclePhotoManager.tsx:267`), e a reconciliação salva a posição do formulário; não foi encontrada corrida de conclusão de uploads nesse caminho. A origem histórica da escolha dessa capa não pode ser reconstruída só com esses metadados.

### Correção de dados a executar pelo responsável, após identificar a sequência visual

1. Confirmar em cópia local qual dos sete IDs deve ser a capa e a sequência dos outros seis. Sem essa identificação, **a permutação exata ainda está pendente**; nomes `o00…o06` não provam o conteúdo visual.
2. No admin, abrir somente o Kicks, mover essas mesmas fotos para a sequência confirmada e salvar uma vez. A reconciliação deve manter `Photo.id`, `url` e `thumbnailUrl`, alterando `order` para 0…6 segundo a nova posição. Não renomear Blob nem ordenar pelo prefixo do arquivo. Não reimportar as fotos.
3. O salvamento precisa passar pela Server Action existente e por `revalidatePublicStock()` para invalidar tag, home, estoque, sitemap e só o slug do Kicks. UPDATE SQL isolado não invalida ISR e pode deixar a ordem antiga por até 1 h.
4. Conferir card, primeira foto da galeria, navegação, lightbox e JSON-LD com a mesma sequência. Se já existisse um arquivo errado sob uma URL correta, publicar o arquivo correto com URL nova e substituir apenas a referência do Photo.id correspondente; não sobrescrever URL com cache imutável.

Teste de regressão `e2e/ordem-fotos-blob.spec.ts`: sete fotos locais de teste, inserção fora de ordem e prefixos de arquivo em sequência inversa. Verifica primeira foto da API, todas as posições do JSON-LD e navegação visual. Esse teste verifica o contrato de ordenação, não atesta a sequência visual desejada para as fotos reais.

## Inventário completo de referências de veículos ainda no Storage

Fonte: SELECT de `Vehicle.id/brand/model/yearModel/status/historical` e `Photo.id/order/url/thumbnailUrl`; nenhuma consulta ao bucket. Cada bloco fornece os campos exatos a substituir após upload da cópia local no Blob. Ordem é zero-based; campos não listados não devem ser alterados.

### Volkswagen NIVUS 2021 — cmsgmjlr30000lc04jbkxewkj

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmt0tgs740009la04eqesbti2`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785969021270-71575a2c-e6f2-4c3a-b344-9175f73b6930.jpg
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tgs74000ala04d8rss7sf`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785969012609-b1a871c7-a9ff-4d46-87d2-37ab097a8c7d.jpg
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tgs74000bla04rrz2t1l1`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785968994220-e2ecfa3c-a536-471a-b82f-c4b8e3ce130a.jpg
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tgs74000cla04pmoh8w9e`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785969003975-8554485e-f685-4c8f-b9d3-de4b6c0c6d39.jpg
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tgs74000dla040fsbxaom`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785968998767-a2b42ec0-67b7-46ff-a3bb-be15b343c622.jpg
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tgs74000ela04ricy6lx1`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785969008933-e7b755a1-50f4-4bc3-9ec6-931a517acb2f.jpg
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tgs74000fla04xyfpam2j`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785969017343-0c824808-4d37-41fd-8abe-99a4eafd4f28.jpg
  - `thumbnailUrl`: NULL

### Mitsubishi LANCER 2014 — cmsgv18dy0000l204bn1cwvkb

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmsgv1r4p0008l204zrmvco93`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785981041154-5ae25c41-3647-4022-82e3-c60bf06a5d1f.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsgv1r4p0009l204ymptcmmy`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785981039384-bf169dea-296e-4c79-bf07-afb94b8709e9.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsgv1r4p000al204oasxx6du`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785981036334-8cc041f3-8fb1-42af-85b0-8cc30e345f22.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsgv1r4p000bl204kgjxg7fs`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785981037798-29f27728-6311-459f-afb4-f02d71a292e6.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsgv1r4p000cl204b156bzsb`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785981034165-5c47cd80-9bf0-40c7-8463-c398f84f0740.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsgv1r4p000dl204mty7o2mp`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785981030957-75d3bf69-1051-4ea6-aa81-b3e31ebbb075.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsgv1r4p000el2040x3rht9r`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785981032666-14d1765d-4d58-4ccf-b242-69773499c964.webp
  - `thumbnailUrl`: NULL

### jeep COMPASS 2018 — cmsgv81ap0000js04cr251b73

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmt8ozvsw0007la04etwpdsag`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785981373398-1294d92c-4dde-4981-bced-b4f1f5959356.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt8ozvsw0008la04vc5qf16p`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787663992068-b95a3c4e-2043-4291-a7d4-d50f5abf5178.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt8ozvsw0009la04siaef5up`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785981346430-7be58cc4-f976-4505-9eb6-4369df85075b.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt8ozvsw000ala04v9k54oxd`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785981352571-b38c9bb3-4c7d-459a-b863-51d28b7fc297.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt8ozvsw000bla04dl0bb6g9`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1785981369165-43716a44-11d1-4874-96d4-01879fb103a5.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt8ozvsw000cla04bl40irvb`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787663999034-8a082327-fe0e-49b9-9659-2edfb7c8f090.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt8ozvsw000dla04zilyjzx6`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787664002499-764e4493-8087-447e-b78a-077fb996e7b3.webp
  - `thumbnailUrl`: NULL

### hyundai Creta 2019 — cmsgveh7u0000jp04ekr8p4q2

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmt0tkrjy0019jv040419qbmo`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786039464638-c635ccbe-6412-48cf-a30f-da652d8a2d69.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tkrjy001ajv04o1bana54`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786039466892-dc6dc599-b3e1-43d4-b8df-9a5532f31d50.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tkrjy001bjv04avytmj2o`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786039468785-950ab6fa-2ea7-4add-a471-ef500e3b28a7.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tkrjy001cjv04yf83vzpc`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786039472840-d434ebe3-98d9-4685-8ee9-c29272e512bb.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tkrjy001djv04glv4ezqk`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786039474448-3fa901b8-8a21-4187-90b8-c6c815da8d0a.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tkrjy001ejv04ayqgusfj`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786039471395-1839b5f1-cf11-4387-80f1-0b47d81c0d62.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tkrjy001fjv046evrbe2p`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786039469946-6decd514-124a-4ff2-8a27-4e2218487157.webp
  - `thumbnailUrl`: NULL

### Hyundai HB20X 2015 — cmshugaxb0000i504v18o8dpe

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmshugaxb0001i504196c3fey`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040502966-2887d82d-6d93-4ac1-82ae-9ca3e436e9a0.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmshugaxb0002i504q39917ch`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040501625-f197ca9f-e24f-46b9-b978-643ee77b4141.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmshugaxb0003i504kxw3d89w`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040499166-f6c38813-1a22-4182-9776-aeb831299eff.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmshugaxb0004i504j43i0ucp`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040500536-5b963681-22e8-4b31-a818-32af2e143c19.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmshugaxb0005i504ux49d2uo`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040497713-15efafdd-4ee5-4355-99c0-15eb9ada7542.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmshugaxb0006i504bgbhoml8`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040496129-aba847b7-b8c3-4daf-941a-a22655c7efe9.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmshugaxb0007i5048xnybqxz`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040494123-2b40b350-c1ad-4f04-92fc-ec49c79ce453.webp
  - `thumbnailUrl`: NULL

### Toyota Corolla 2015 — cmshumj3q0008i504ytyggxdq

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmshumrg10000l7046pxq86og`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040805981-8b584c25-39f1-472e-959c-007bd2de7f47.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmshumrg10001l704rcqviuh1`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040807402-18123280-5ccf-419d-bc46-b26653872748.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmshumrg10002l7044crb1165`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040803315-41285cd1-e308-4d82-8106-399c9c933bda.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmshumrg10003l704fyjwfbor`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040804739-ec3eca1d-9d56-4070-bd57-ceec9e5d482f.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmshumrg10004l7042pafcoeg`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040809857-d9463944-e3c6-4376-91d3-6a1b619e0798.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmshumrg10005l704z0pbuwtz`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040808545-c236edcc-58a5-4a83-ba06-e043798a6066.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmshumrg10006l704mhiihhec`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786040801446-15ce28af-5a42-4533-85e3-e0e498bc0aee.webp
  - `thumbnailUrl`: NULL

### Chevrolet Onix 2014 — cmshuwkoy0007l204q6vbimh3

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmt0fw3wv0000ju04wpv4x6s7`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041210860-842d4080-3192-48dd-b26f-7be332681b49.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0fw3wv0001ju047py3gxja`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041287315-d0a94008-90de-4533-9835-868d6a7100e2.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0fw3wv0002ju04z7vu3hw3`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041209374-8a95ca39-c9f4-458a-a7ff-895546d0a76c.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0fw3wv0003ju047qcmqvaq`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041213953-74cae50c-78d7-482b-895d-fde8d72259c8.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0fw3wv0004ju04elqoi7iw`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041216908-a5ee014d-fa1f-43cb-bcad-5b06b1b05048.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0fw3wv0005ju048iitc1h3`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041215242-d54b9332-1c7b-4a9a-bf81-613dad2c892e.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0fw3wv0006ju04ku6jfdgc`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041212245-acaf568a-1a65-4ecc-b3a8-7ef6cf42f863.webp
  - `thumbnailUrl`: NULL

### Ford Ecosport 2021 — cmshv22g9000fl204fk6qz9l2

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmt0tjinm000vjv04evjgc34h`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041499666-c7638f0b-6912-449f-ba68-f89c8d3e9f43.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tjinm000wjv04ph46c75u`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041501764-cf8cf7be-bcf6-4b15-ac69-93abae03b1f3.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tjinm000xjv0407q9k7kp`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041495371-85ac1f6a-f3d7-4a89-bad5-6dab152365df.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tjinm000yjv04hv82fmu2`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041497682-386a5f3a-6849-422e-8764-4dd61fc887d0.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tjinm000zjv04utwll5wi`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041496496-73567420-9516-41e2-b294-3f443f418e01.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tjinm0010jv04zlam7067`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041498606-d678be50-66c8-4fb8-aaa1-c4f3e66ad4a9.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tjinm0011jv04awcdl1z6`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786041500828-a29b0843-ba25-46ea-bbad-5770b4033f55.webp
  - `thumbnailUrl`: NULL

### Ford Fiesta 2014 — cmsozyq3q0000ii04e3q0x24d

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmsozz8s10007ky047ag5j2wv`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473049059-87354b8c-9b48-4ec7-82b7-96dee58f3c94.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsozz8s10008ky04kecywwdx`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473053426-ea6c3574-2f3a-485b-b5f3-0a0d04cbcdd9.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsozz8s10009ky04jhcbkt57`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473042862-b0ffb8dc-db8d-4dab-92e1-7918e55e5ff6.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsozz8s1000aky0421flfu2w`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473045945-8a5262a4-a5c6-4180-8e8e-c73abf010861.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsozz8s1000bky0451rowuzi`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473044709-7396934f-8995-48c7-a5c3-5365d74b7371.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsozz8s1000cky044ybr1uvi`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473047817-2e9a7de5-1ffc-405d-8f5e-7f0430bfa2b1.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsozz8s1000dky04gsvf9dff`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473050662-491e2c3f-74d3-4329-8745-19c9a548e438.webp
  - `thumbnailUrl`: NULL

### Fiat Palio 2013 — cmsp05449000eky04w6cuaf4d

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmsp05449000fky04je7gxv2a`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473301479-640a6f6a-5f21-4959-9855-cf374e2f72c3.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsp05449000gky04qwv4ex2f`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473304772-818f1c10-14d1-4d62-81d1-1a93eb6b22b8.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsp05449000hky04vvhjpr4k`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473294859-2bb9713d-1bfd-4c43-a2b2-97627efeb3ff.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsp05449000iky04wgmc6kj6`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473298553-d0f1c14e-85b8-4a11-8afa-5eaca92b77a6.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsp05449000jky04xtnuikdm`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473296960-4b96e92a-a17e-47b6-b466-29d3dbd3512f.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsp05449000kky046wapengg`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473300228-f171f8f0-b8f6-4786-a501-c24c00531c90.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmsp05449000lky04nayrokpx`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786473303010-f6bbdb4f-b7b9-44db-9747-373e7680c815.webp
  - `thumbnailUrl`: NULL

### Hyundai HB20S 2024 — cmsrx7hnl0000l704p133ruvi

Status: vendido; histórico: não; 10 fotos com dependência.

- `Photo.id=cmt0ti6240007jv04dl0mw8ar`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786649796036-6e63e295-832b-4069-a354-0d8f5f967cb5.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0ti6240008jv04fd3rdina`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786649806155-43675649-b94f-433a-8607-502c4b7d9e65.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0ti6240009jv04duj83bz9`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786649803756-69020240-68cc-4ed6-8625-4fda340efcb2.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0ti624000ajv04b5izklty`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786649816166-dede9398-c37d-4adf-ac3d-13314a412020.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0ti624000bjv04cx45h1ld`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786649809386-6c9d8597-8fe3-43e8-8e72-6d003d30bcf9.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0ti624000cjv04urcxwl1x`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786649811601-38e0f17e-5d3d-4c11-a401-6fa303a1e5b9.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0ti624000djv04jan8jpqb`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786649813775-5b6ecefe-8649-4a7e-b811-0fd32286351f.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0ti624000ejv04l3ja1gz0`; `order=7`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786649818327-43986f47-8d5c-4f1b-8165-43c4703bb769.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0ti624000fjv044rz5wahu`; `order=8`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786649801092-84fc671b-b901-4879-b571-5270e10993dd.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0ti624000gjv047nvevhu1`; `order=9`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1786649798674-a534be08-d945-4d09-9893-da922010c4f4.webp
  - `thumbnailUrl`: NULL

### Toyota Corolla ALTIS 2018 — cmt0ewzpg0000lc0493fl02h7

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmuegmr2r0008kx04srq8fmku`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787162865771-53e3b324-2343-4d89-99d0-aef042303ebf.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmuegmr2r0009kx04mtpmb79u`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787162859985-7fd9db56-c126-4888-93e8-0d25f390b687.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmuegmr2r000akx04y2ozi6b0`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787162877915-b6892640-69d2-4acb-929c-df4d4d51ad93.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmuegmr2r000bkx04f2alu1mp`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787162872466-346aa83f-a842-490b-8c2c-30e0fd59ac3e.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmuegmr2r000ckx04mefnzd4w`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787162875376-cf5d8f2d-f26d-43d4-96bf-25e429c4ea52.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmuegmr2r000dkx044aynl6ay`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787162868658-fe43cac2-369b-4b07-9de1-021e5e65db67.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmuegmr2r000ekx04n89w06w9`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787162862854-43a9eb7f-397e-4916-8023-78c37db22121.webp
  - `thumbnailUrl`: NULL

### Honda CB 250F TWISTER 2019 — cmt0tby7j0000js04s2ilomdg

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmt0tby7j0001js04pbt4ga6a`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787187400675-3890fd5f-9757-494c-b9c9-a8b21b105da7.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tby7j0002js04624q7xhf`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787187393890-707cb55c-3346-41fb-8e56-d71561ddaf22.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tby7j0003js04efmfklwy`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787187402866-d6ad1ae8-2a18-4f20-9908-b5b23361dddd.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tby7j0004js04ywnfdbx4`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787187397151-9391d80a-a773-4af6-af9f-7d07147e848c.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tby7j0005js04mfbgs32y`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787187405408-10527087-35d6-4e3e-91c4-946667211cf2.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tby7j0006js04unox8gj0`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787187414541-803d18ff-7ee5-49b0-9d5f-0138c4c9bb97.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt0tby7j0007js04260k4uw1`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787187416613-1e7cc683-0e91-461d-b4ba-a9601a057909.webp
  - `thumbnailUrl`: NULL

### FIAT FASTBACK 2023 — cmt4cnnxu0000l4043opg74bj

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmt4cp52d0000la04q3ouvfai`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787401227840-6ebbf98a-a9e1-419e-bf99-72d4d2a7afd4.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt4cp52d0001la04502adzxv`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787401213777-fb89f524-8829-4eb8-b106-f875482cfb22.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt4cp52d0002la04160xit7e`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787401230340-0f242bbe-b76a-43bc-aa20-d5e7ccad1273.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt4cp52d0003la04ckfwz3io`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787401216451-b2ae86f0-9186-4d32-b13f-25d45e4e38df.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt4cp52d0004la04dwneqteq`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787401218727-a9bfb818-bdd7-4203-8452-2c92487f2e8c.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt4cp52d0005la04gdpo3la9`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787401221139-256007b9-be8d-497d-b0c8-b941185bd1c2.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmt4cp52d0006la04zh37inio`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787401224136-ff2d3540-7890-4f89-8776-5eb91f657036.webp
  - `thumbnailUrl`: NULL

### Volkswagen Gol 2012 — cmt9yomxb0000jp04247nx84n

Status: vendido; histórico: não; 8 fotos com dependência.

- `Photo.id=cmta1pn3i0000jy04ift5wa72`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787740660383-9e638f0e-d56d-4235-a1b6-7e6b2607b488.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmta1pn3i0001jy04xno2qxw4`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787740663731-0eaed135-b524-423e-aecd-889e3b4162b9.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmta1pn3i0002jy04hkonitnr`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787740666487-2cfae09f-0544-4a26-b09d-be7b31a8fbdc.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmta1pn3i0003jy04bym0bxkh`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787740668863-a966b996-bb8e-4a28-8b80-bae81a2499dc.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmta1pn3i0004jy04g8bhd2yk`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787740671280-ac3daecc-8885-4523-b7e5-f2ec58784819.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmta1pn3i0005jy04klejun9a`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787740673095-283fd2d3-c2b5-42c0-8dc2-c79ba180f71b.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmta1pn3i0006jy04fyh5outa`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787740675050-e5d1a036-90bb-40c3-a985-ced9c3dccc01.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmta1pn3i0007jy04909c7f52`; `order=7`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787740678039-a4622823-3835-47b0-903e-682094a8eedf.webp
  - `thumbnailUrl`: NULL

### Honda HR-V 2018 — cmtbv7xso0000l50429oklxxy

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmujxc3t60000jh04q89a6rdl`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789001632768-0371056d-e9bd-479b-8222-8ea882b2b5e8.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789001632768-0371056d-e9bd-479b-8222-8ea882b2b5e8-card.webp
- `Photo.id=cmujxc3t60001jh045h4lxos6`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789001635689-bec1427e-fe22-41fd-9c1d-cb36039bbad7.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789001635689-bec1427e-fe22-41fd-9c1d-cb36039bbad7-card.webp
- `Photo.id=cmujxc3t60002jh04xq1y1ygt`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787855770212-fd6fe921-3c96-46b8-84b6-3d9667b599aa.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmujxc3t60003jh04s8qe9ui1`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787855772432-9e911ff5-23ac-4fc9-80e4-fa98278dd475.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmujxc3t60004jh04i2nykxzd`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787855776456-eeec6f1d-d23e-4765-adcc-b17094d871a9.webp
  - `thumbnailUrl`: NULL
- `Photo.id=cmujxc3t60005jh04atkhig05`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789001642811-e7554230-aa8a-4d9a-9fcb-c69a2e1964b7.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789001642811-e7554230-aa8a-4d9a-9fcb-c69a2e1964b7-card.webp
- `Photo.id=cmujxc3t60006jh04kttn13d3`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1787855787063-86cbd73b-4a95-40ad-b158-be4f1eadc10c.webp
  - `thumbnailUrl`: NULL

### Chevrolet Prisma 2019 — cmtq0atza0000k304gr0hzi8q

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmtq25gy70000l2049vrrb7jz`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710902855-63a3f8b2-9fb4-4d0d-8224-7fbc5c7d1971.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710902855-63a3f8b2-9fb4-4d0d-8224-7fbc5c7d1971-card.webp
- `Photo.id=cmtq25gy70001l2040gwmfq5c`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710904413-40464de0-4e99-4020-b28a-7d21dfa91f80.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710904413-40464de0-4e99-4020-b28a-7d21dfa91f80-card.webp
- `Photo.id=cmtq25gy70002l2048imf49r5`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710906219-21153c26-5266-48e9-849a-1917be9aafeb.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710906219-21153c26-5266-48e9-849a-1917be9aafeb-card.webp
- `Photo.id=cmtq25gy70003l204wlve69xk`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710907857-d5c2518f-296a-418e-bde6-f6cd9651c354.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710907857-d5c2518f-296a-418e-bde6-f6cd9651c354-card.webp
- `Photo.id=cmtq25gy70004l20415p9hk17`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710908922-40dd1f59-b19f-49cd-825f-144afc572189.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710908922-40dd1f59-b19f-49cd-825f-144afc572189-card.webp
- `Photo.id=cmtq25gy70005l204hyw5d4nk`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710910312-571ce0a2-4a02-42c6-8cae-bfcd01e84091.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710910312-571ce0a2-4a02-42c6-8cae-bfcd01e84091-card.webp
- `Photo.id=cmtq25gy70006l204017s1mo3`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710911677-3c348f25-d278-4247-a652-0f4180978cae.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788710911677-3c348f25-d278-4247-a652-0f4180978cae-card.webp

### Honda BIZ 125 2023 — cmtrkwmer0000ky04r6wwpwsv

Status: vendido; histórico: não; 12 fotos com dependência.

- `Photo.id=cmu4t73ja0000l504fks7r3y4`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805888838-56afe8dd-fbf6-4414-8338-97a5fb34139f.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805888838-56afe8dd-fbf6-4414-8338-97a5fb34139f-card.webp
- `Photo.id=cmu4t73ja0001l504c52z8rc3`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805886168-520415b3-4118-428b-9105-e51a7a1b85f8.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805886168-520415b3-4118-428b-9105-e51a7a1b85f8-card.webp
- `Photo.id=cmu4t73ja0002l5043fvkpmsb`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805883460-097801b2-121d-4ef0-a1bf-5b655f857d52.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805883460-097801b2-121d-4ef0-a1bf-5b655f857d52-card.webp
- `Photo.id=cmu4t73ja0003l50420nhvwcv`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805911530-e18254f3-92a4-4d9f-9870-9182c5c09639.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805911530-e18254f3-92a4-4d9f-9870-9182c5c09639-card.webp
- `Photo.id=cmu4t73ja0004l504q9vvwm5e`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805906196-caa3d397-8a76-4e81-8660-1456fbb1f460.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805906196-caa3d397-8a76-4e81-8660-1456fbb1f460-card.webp
- `Photo.id=cmu4t73ja0005l504eo98ul9z`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805898531-0f2356fd-5b97-413c-8aff-7d8e8e2437f3.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805898531-0f2356fd-5b97-413c-8aff-7d8e8e2437f3-card.webp
- `Photo.id=cmu4t73ja0006l504xh069dtv`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805908825-f31b8d7c-568b-45e1-8c57-8a74a1993732.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805908825-f31b8d7c-568b-45e1-8c57-8a74a1993732-card.webp
- `Photo.id=cmu4t73ja0007l504au5jw5x2`; `order=7`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805904148-6b3d8714-44ab-48f8-b13e-f860d93ce940.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805904148-6b3d8714-44ab-48f8-b13e-f860d93ce940-card.webp
- `Photo.id=cmu4t73ja0008l5047hhwao6t`; `order=8`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805901136-9ffd5178-622a-473f-b038-13d57c415228.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805901136-9ffd5178-622a-473f-b038-13d57c415228-card.webp
- `Photo.id=cmu4t73ja0009l504h9qc03d3`; `order=9`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805896084-82472d8a-27be-4d1c-aded-67d2f63c7506.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805896084-82472d8a-27be-4d1c-aded-67d2f63c7506-card.webp
- `Photo.id=cmu4t73ja000al504in2atr0h`; `order=10`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805891811-c68777ec-b409-430e-894e-acf6f971c721.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805891811-c68777ec-b409-430e-894e-acf6f971c721-card.webp
- `Photo.id=cmu4t73ja000bl504rmct58ej`; `order=11`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805893627-fcb9b512-7a91-4328-aae6-da39a9c67c14.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788805893627-fcb9b512-7a91-4328-aae6-da39a9c67c14-card.webp

### HYUNDAI I30 2010 — cmtt0p6jo0000l304qufb2f0y

Status: vendido; histórico: não; 10 fotos com dependência.

- `Photo.id=cmtt0p6jo0001l3041wjmw62o`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892917886-f6690dc7-ce45-4fb8-8072-9e6c3786ab51.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892917886-f6690dc7-ce45-4fb8-8072-9e6c3786ab51-card.webp
- `Photo.id=cmtt0p6jo0002l304m9np8jbl`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892920942-b69ad727-05ac-42e2-bfe0-d83f7000033d.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892920942-b69ad727-05ac-42e2-bfe0-d83f7000033d-card.webp
- `Photo.id=cmtt0p6jo0003l304xs4xbty9`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892923730-77589a6d-1ba0-492a-aec5-e48a1688640d.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892923730-77589a6d-1ba0-492a-aec5-e48a1688640d-card.webp
- `Photo.id=cmtt0p6jo0004l304i403da6w`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892927492-34e19cb2-f2cb-46fa-8f58-e70e33b3951b.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892927492-34e19cb2-f2cb-46fa-8f58-e70e33b3951b-card.webp
- `Photo.id=cmtt0p6jo0005l304b5fkg8fd`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892929846-9d129e82-8a57-4293-89f3-15c842c8bee3.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892929846-9d129e82-8a57-4293-89f3-15c842c8bee3-card.webp
- `Photo.id=cmtt0p6jo0006l304b1cgkg7n`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892932115-8f4523c7-7e1d-4e70-a077-0e32e73337ba.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892932115-8f4523c7-7e1d-4e70-a077-0e32e73337ba-card.webp
- `Photo.id=cmtt0p6jo0007l304exnfj84r`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892945860-1d6daae7-4c4f-4b63-ae3c-f63dabd689e2.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892945860-1d6daae7-4c4f-4b63-ae3c-f63dabd689e2-card.webp
- `Photo.id=cmtt0p6jp0008l304civ0y7rc`; `order=7`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892948001-9289b2f0-f9bc-414e-b8f9-ab3940bdf15e.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892948001-9289b2f0-f9bc-414e-b8f9-ab3940bdf15e-card.webp
- `Photo.id=cmtt0p6jp0009l304du18tv75`; `order=8`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892950111-0a9615cc-d8f8-4839-9468-11232db2587d.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892950111-0a9615cc-d8f8-4839-9468-11232db2587d-card.webp
- `Photo.id=cmtt0p6jp000al304dtmzeb3x`; `order=9`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892953123-b6d6b2b3-6ef9-4a55-af4f-8192a3c05bb8.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1788892953123-b6d6b2b3-6ef9-4a55-af4f-8192a3c05bb8-card.webp

### Fiat Pulse 2023 — cmu1foxv90000jx04pygft1tk

Status: vendido; histórico: não; 6 fotos com dependência.

- `Photo.id=cmu1py07c0007l804hn8elquo`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789401810951-d55f8f39-f83f-4215-b005-24427924c30d.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789401810951-d55f8f39-f83f-4215-b005-24427924c30d-card.webp
- `Photo.id=cmu1py07c0008l8042oye7msl`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789401815229-c050e189-6853-495d-b73b-194c1dadc3fe.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789401815229-c050e189-6853-495d-b73b-194c1dadc3fe-card.webp
- `Photo.id=cmu1py07c0009l804a76l5hqp`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789401804362-b18f1cc0-021d-4c38-b619-e51f10790e8a.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789401804362-b18f1cc0-021d-4c38-b619-e51f10790e8a-card.webp
- `Photo.id=cmu1py07c000al804c4g0176q`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789401806697-e08c47e2-8fee-48e3-b57e-9835bac7085d.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789401806697-e08c47e2-8fee-48e3-b57e-9835bac7085d-card.webp
- `Photo.id=cmu1py07c000bl804qe6qfvir`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789401808953-ae9bd1f1-6910-4752-9529-c249af53b6a4.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789401808953-ae9bd1f1-6910-4752-9529-c249af53b6a4-card.webp
- `Photo.id=cmu1py07c000cl804hf1ztbcf`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789401813032-53938cde-6391-4f22-a3c0-b307de7d601d.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789401813032-53938cde-6391-4f22-a3c0-b307de7d601d-card.webp

### Fiat Palio 2008 — cmu1g23pu0000l504mzurjecm

Status: vendido; histórico: não; 5 fotos com dependência.

- `Photo.id=cmubem0a00005jv05vocoijcn`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789402352514-a39ecc6a-d0d1-4401-9c25-4aa2dbd7fc72.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789402352514-a39ecc6a-d0d1-4401-9c25-4aa2dbd7fc72-card.webp
- `Photo.id=cmubem0a00006jv05v47rlm9q`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789402354204-b6dd5cd8-9938-426c-95f5-0a3b8910d8a6.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789402354204-b6dd5cd8-9938-426c-95f5-0a3b8910d8a6-card.webp
- `Photo.id=cmubem0a00007jv0561pr8yim`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789402348560-6a4c3c74-05af-44bf-be15-e553358c9b33.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789402348560-6a4c3c74-05af-44bf-be15-e553358c9b33-card.webp
- `Photo.id=cmubem0a00008jv05nri0le66`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789402349496-4dab7019-9351-40d8-811e-f135168c2026.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789402349496-4dab7019-9351-40d8-811e-f135168c2026-card.webp
- `Photo.id=cmubem0a00009jv053lx9wz5p`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789402353675-88b5c114-fb76-4339-82de-fe8896c01442.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789402353675-88b5c114-fb76-4339-82de-fe8896c01442-card.webp

### Fiat Grand Siena 2014 — cmu1gkj8s0000l0040jvjn6ij

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmu1pwdv40000l80476925v8z`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403207363-c3fd0d06-9e03-4753-869a-f3462f949c9d.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403207363-c3fd0d06-9e03-4753-869a-f3462f949c9d-card.webp
- `Photo.id=cmu1pwdv40001l804hvoxvdk0`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403209603-bd21f2dc-3bf6-4b3d-8d85-bc5172385f90.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403209603-bd21f2dc-3bf6-4b3d-8d85-bc5172385f90-card.webp
- `Photo.id=cmu1pwdv40002l8046p9eevtf`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403215679-471b23bc-62f7-4cac-aac8-dfd02774e348.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403215679-471b23bc-62f7-4cac-aac8-dfd02774e348-card.webp
- `Photo.id=cmu1pwdv40003l804qc5591t2`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403276385-b2db35a6-fbbd-4d87-953f-1bd11c9c6c0d.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403276385-b2db35a6-fbbd-4d87-953f-1bd11c9c6c0d-card.webp
- `Photo.id=cmu1pwdv40004l804gldhk6zi`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403205136-9bebd29d-94d6-43c4-aea9-98088d542361.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403205136-9bebd29d-94d6-43c4-aea9-98088d542361-card.webp
- `Photo.id=cmu1pwdv40005l8048dgwgq6v`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403213467-e67cd933-c484-4f8f-aec6-46379b637fea.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403213467-e67cd933-c484-4f8f-aec6-46379b637fea-card.webp
- `Photo.id=cmu1pwdv40006l804shdk8h8s`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403211755-e2eb06dc-4072-415c-ae51-c85076956451.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789403211755-e2eb06dc-4072-415c-ae51-c85076956451-card.webp

### Honda CG Start 160 2024 — cmu4giq7n0000l604u1syorry

Status: vendido; histórico: não; 9 fotos com dependência.

- `Photo.id=cmufp9d620000jq04gh3or1ba`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789584208741-d9b94bcc-d1a5-4c3c-812c-19fa60ffdca9.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789584208741-d9b94bcc-d1a5-4c3c-812c-19fa60ffdca9-card.webp
- `Photo.id=cmufp9d620001jq045auekbtz`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789584214165-82947281-6685-4e8e-8b73-f89f4e45d2b1.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789584214165-82947281-6685-4e8e-8b73-f89f4e45d2b1-card.webp
- `Photo.id=cmufp9d620002jq04gogny1qm`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789587665730-a9a56ee6-156b-4267-a80b-14a9127ba7c1.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789587665730-a9a56ee6-156b-4267-a80b-14a9127ba7c1-card.webp
- `Photo.id=cmufp9d620003jq04n0jpubqx`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789584240164-31fe2ff6-487a-4455-b690-170bc0506c45.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789584240164-31fe2ff6-487a-4455-b690-170bc0506c45-card.webp
- `Photo.id=cmufp9d620004jq0426vlmnne`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789587672903-96e6d367-50b3-4b16-8542-b8146f4ff8ed.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789587672903-96e6d367-50b3-4b16-8542-b8146f4ff8ed-card.webp
- `Photo.id=cmufp9d620005jq04wsc9ko53`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789584258913-0ca7ee58-85d0-4e23-8690-5ba945c2bf56.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789584258913-0ca7ee58-85d0-4e23-8690-5ba945c2bf56-card.webp
- `Photo.id=cmufp9d620006jq04k4rtjx0l`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789587676751-45db4d7d-1aa4-4884-b64e-1badc385f133.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789587676751-45db4d7d-1aa4-4884-b64e-1badc385f133-card.webp
- `Photo.id=cmufp9d620007jq04e2psobnd`; `order=7`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789587679837-080abeae-2fd0-440f-92fa-6ca406ba14e9.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789587679837-080abeae-2fd0-440f-92fa-6ca406ba14e9-card.webp
- `Photo.id=cmufp9d620008jq04f243yoxx`; `order=8`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789587684521-9768cacc-6875-42ec-bfb0-e2c4926971ea.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1789587684521-9768cacc-6875-42ec-bfb0-e2c4926971ea-card.webp

### Honda Civic 2015 — cmubrhzwf0000l304geveibp1

Status: vendido; histórico: não; 8 fotos com dependência.

- `Photo.id=cmueglebu0000kx04k8td4842`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790028541547-df27c432-7b16-4456-8b26-48cdfb54e167.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790028541547-df27c432-7b16-4456-8b26-48cdfb54e167-card.webp
- `Photo.id=cmueglebu0001kx04ywd2udky`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790028556809-2d592658-ab2c-4c41-b26e-d69539a68e83.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790028556809-2d592658-ab2c-4c41-b26e-d69539a68e83-card.webp
- `Photo.id=cmueglebu0002kx042ft4mq3d`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790026261716-380ddadf-9afc-4abd-a48a-65eb76fc79cd.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790026261716-380ddadf-9afc-4abd-a48a-65eb76fc79cd-card.webp
- `Photo.id=cmueglebu0003kx04tkr150vz`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790026256911-55ab3801-06ba-4619-940c-ef2a2a74b6c4.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790026256911-55ab3801-06ba-4619-940c-ef2a2a74b6c4-card.webp
- `Photo.id=cmueglebu0004kx04o8mc5ab7`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790026260181-b53fee77-a67a-4a7a-8b85-95d3df32a07d.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790026260181-b53fee77-a67a-4a7a-8b85-95d3df32a07d-card.webp
- `Photo.id=cmueglebu0005kx04jt74setr`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790026263077-c35593b5-fd42-4865-a687-4c62529bf38f.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790026263077-c35593b5-fd42-4865-a687-4c62529bf38f-card.webp
- `Photo.id=cmueglebu0006kx04riuronc6`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790028567973-a2f8b3ae-8050-4f7f-b853-0dc9b7aea804.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790028567973-a2f8b3ae-8050-4f7f-b853-0dc9b7aea804-card.webp
- `Photo.id=cmueglebu0007kx04d0xu1n36`; `order=7`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790028579904-77e9d639-e3be-4fee-8209-8d2c1017dc64.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790028579904-77e9d639-e3be-4fee-8209-8d2c1017dc64-card.webp

### Honda HR-V 2016 — cmud192iz0000l6041ewv0ki6

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmud19jyr0000l9046yapnp27`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102943150-bd2e8636-29f2-4ba3-8cf1-65920e219250.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102943150-bd2e8636-29f2-4ba3-8cf1-65920e219250-card.webp
- `Photo.id=cmud19jyr0001l904r5cbqi3f`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102957343-c9a59d8c-6782-4d79-89c7-e965bfe2f937.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102957343-c9a59d8c-6782-4d79-89c7-e965bfe2f937-card.webp
- `Photo.id=cmud19jyr0002l90419ip35uk`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102893196-6a5e31ea-0e64-4d37-8c03-b931e5360dbe.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102893196-6a5e31ea-0e64-4d37-8c03-b931e5360dbe-card.webp
- `Photo.id=cmud19jyr0003l9048yt9rqky`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102895760-b952a757-cbc2-4bcc-a0ed-83c9c0bff726.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102895760-b952a757-cbc2-4bcc-a0ed-83c9c0bff726-card.webp
- `Photo.id=cmud19jyr0004l904peoqfl1b`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102897953-6f6af2e4-1626-4599-b988-f9f72e85cc42.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102897953-6f6af2e4-1626-4599-b988-f9f72e85cc42-card.webp
- `Photo.id=cmud19jyr0005l904v2rqex0o`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102970976-c8291585-7867-41b5-a3bd-cd2829fe9ded.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102970976-c8291585-7867-41b5-a3bd-cd2829fe9ded-card.webp
- `Photo.id=cmud19jyr0006l904emebecjx`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102982226-9574000d-9ea3-4532-ab0c-72e17c277c9c.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790102982226-9574000d-9ea3-4532-ab0c-72e17c277c9c-card.webp

### Ford KA SEDAN 2019 — cmuqzvj310000l704vrrt6ijm

Status: vendido; histórico: não; 7 fotos com dependência.

- `Photo.id=cmuqzvm8j0000if04v219ene2`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947142932-fd383da6-90b9-4b8d-bfdd-da3603ee74fe.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947142932-fd383da6-90b9-4b8d-bfdd-da3603ee74fe-card.webp
- `Photo.id=cmuqzvm8k0001if042bfluxsx`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947132011-af4d6689-8222-48e2-8731-2b2e216b713a.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947132011-af4d6689-8222-48e2-8731-2b2e216b713a-card.webp
- `Photo.id=cmuqzvm8k0002if04u0a784ms`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947095963-8cf73725-5b3f-4148-8c3d-1078690ddea4.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947095963-8cf73725-5b3f-4148-8c3d-1078690ddea4-card.webp
- `Photo.id=cmuqzvm8k0003if04vy8rqmzq`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947099702-612d209a-d19e-41e1-98a6-b11656621dc3.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947099702-612d209a-d19e-41e1-98a6-b11656621dc3-card.webp
- `Photo.id=cmuqzvm8k0004if04wq25ktrm`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947097173-6e3db5a9-96eb-4d41-92ea-fa54bfbd5878.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947097173-6e3db5a9-96eb-4d41-92ea-fa54bfbd5878-card.webp
- `Photo.id=cmuqzvm8k0005if04sb0cmjfb`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947154286-27547f0a-3007-40a8-998d-68d9124c13b5.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947154286-27547f0a-3007-40a8-998d-68d9124c13b5-card.webp
- `Photo.id=cmuqzvm8k0006if04b091p22j`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947119409-19dafeeb-9de1-4663-805d-a454910f07f6.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1790947119409-19dafeeb-9de1-4663-805d-a454910f07f6-card.webp

### Volkswagen Gol 2012 — cmux8br7n0000l004rmqr3y77

Status: vendido; histórico: não; 6 fotos com dependência.

- `Photo.id=cmux8br7n0001l004l18gvfeo`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1791324154099-4f86ca2d-c6a4-438c-b0bd-85ea352890ee.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1791324154099-4f86ca2d-c6a4-438c-b0bd-85ea352890ee-card.webp
- `Photo.id=cmux8br7n0002l004m6rybtuv`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1791324165012-0376ef7a-220e-434b-9eaa-98f865837827.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1791324165012-0376ef7a-220e-434b-9eaa-98f865837827-card.webp
- `Photo.id=cmux8br7n0003l004a5dtxz17`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1791324032928-0764931a-aaa6-4e04-b91f-3d5a4bcf37de.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1791324032928-0764931a-aaa6-4e04-b91f-3d5a4bcf37de-card.webp
- `Photo.id=cmux8br7n0004l004s52wolkx`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1791324032928-d25f1112-074e-4cfb-aefd-dbe1fb6f00c6.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1791324032928-d25f1112-074e-4cfb-aefd-dbe1fb6f00c6-card.webp
- `Photo.id=cmux8br7n0005l0045fcyyb2d`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1791324177195-71481e41-24d6-4501-ae2a-ae9bdc00a6df.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1791324177195-71481e41-24d6-4501-ae2a-ae9bdc00a6df-card.webp
- `Photo.id=cmux8br7n0006l004gj040p1q`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1791324187614-47ec1538-61da-4317-b4d3-208533f412c5.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1791324187614-47ec1538-61da-4317-b4d3-208533f412c5-card.webp

### GWM Haval H6 2025 — cmvgz7bz40000jv08ld2ibv6p

Status: disponivel; histórico: não; 13 fotos com dependência.

- `Photo.id=cmvgz7bz40002jv08bkeaamaf`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792518636080-8b69a628-5d16-4b6b-a310-f2cda69fe84e-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792518636080-8b69a628-5d16-4b6b-a310-f2cda69fe84e-g800-card.webp
- `Photo.id=cmvgz7bz40003jv08d5tdl58r`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-8734d09e-ecc2-4b15-b09a-53e4700eaa0a-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-8734d09e-ecc2-4b15-b09a-53e4700eaa0a-g800-card.webp
- `Photo.id=cmvgz7bz40004jv08mpzw7kqx`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-003ae9cc-f7f1-46bd-8584-70bc69084f9f-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-003ae9cc-f7f1-46bd-8584-70bc69084f9f-g800-card.webp
- `Photo.id=cmvgz7bz40005jv08kuo5ne3g`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-206aeb9d-1a2f-4598-8ac9-365e897f25e1-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-206aeb9d-1a2f-4598-8ac9-365e897f25e1-g800-card.webp
- `Photo.id=cmvgz7bz40006jv08n6l3pdkd`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-601218f6-098e-4047-bb48-da962e1a0d51-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-601218f6-098e-4047-bb48-da962e1a0d51-g800-card.webp
- `Photo.id=cmvgz7bz40007jv08wzcxf3hk`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-2d1fbd63-ba0c-4fc7-a87b-46d38aa8225e-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-2d1fbd63-ba0c-4fc7-a87b-46d38aa8225e-g800-card.webp
- `Photo.id=cmvgz7bz40008jv08rje7xvkk`; `order=7`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-95ea70a3-5f45-40e1-9b87-6a9bfc75fc13-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-95ea70a3-5f45-40e1-9b87-6a9bfc75fc13-g800-card.webp
- `Photo.id=cmvgz7bz40009jv08qbgl7nl2`; `order=8`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-ad4b5a66-2e27-4b4e-84e8-4a5fe44c2a45-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-ad4b5a66-2e27-4b4e-84e8-4a5fe44c2a45-g800-card.webp
- `Photo.id=cmvgz7bz4000ajv08h3xn8gt0`; `order=9`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-f5c69fed-25b6-42bd-bdfe-346c042ecaa4-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-f5c69fed-25b6-42bd-bdfe-346c042ecaa4-g800-card.webp
- `Photo.id=cmvgz7bz4000bjv0856r4xv7n`; `order=10`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-44ba6338-e7ac-4cad-bd70-a93213abf0e9-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-44ba6338-e7ac-4cad-bd70-a93213abf0e9-g800-card.webp
- `Photo.id=cmvgz7bz4000cjv0873mfx130`; `order=11`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-e4391d3e-94c7-47d7-a6ce-21346b9cad69-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792517926470-e4391d3e-94c7-47d7-a6ce-21346b9cad69-g800-card.webp
- `Photo.id=cmvgz7bz4000djv089s1xhbu0`; `order=12`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792518405749-0a39df9c-0eda-44b2-910f-99d3206f997e-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792518405749-0a39df9c-0eda-44b2-910f-99d3206f997e-g800-card.webp
- `Photo.id=cmvgz7bz4000ejv0841noq74b`; `order=13`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792518647844-1e47232c-4235-4423-8ac1-53b3bbbbdcfe-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792518647844-1e47232c-4235-4423-8ac1-53b3bbbbdcfe-g800-card.webp

### Chevrolet Onix Plus 2022 — cmvh3c0z60000la08psrif85y

Status: vendido; histórico: não; 9 fotos com dependência.

- `Photo.id=cmvh3c0z60001la083iez0x9n`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792525037105-5da5a235-6b2e-4c4b-8fd4-0b291c797b92-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792525037105-5da5a235-6b2e-4c4b-8fd4-0b291c797b92-g800-card.webp
- `Photo.id=cmvh3c0z60002la08tp9pnz0s`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792525074806-d4762031-73de-4aa1-9097-7f48ea01e970-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792525074806-d4762031-73de-4aa1-9097-7f48ea01e970-g800-card.webp
- `Photo.id=cmvh3c0z60003la080bub5ra1`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792524614155-963a6873-6598-4692-8b96-0cf0ca9bc1fe-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792524614155-963a6873-6598-4692-8b96-0cf0ca9bc1fe-g800-card.webp
- `Photo.id=cmvh3c0z60004la081prr4qgt`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792524614155-c00d5fcb-a022-4729-a7af-17413f15d62d-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792524614155-c00d5fcb-a022-4729-a7af-17413f15d62d-g800-card.webp
- `Photo.id=cmvh3c0z60005la08cmszku9c`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792524614155-58bcac07-7cb0-40f6-8a01-6f22c8c9c882-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792524614155-58bcac07-7cb0-40f6-8a01-6f22c8c9c882-g800-card.webp
- `Photo.id=cmvh3c0z60006la0824q6qr8o`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792524614155-a3fac707-25b3-4809-b747-ca4e20e39bff-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792524614155-a3fac707-25b3-4809-b747-ca4e20e39bff-g800-card.webp
- `Photo.id=cmvh3c0z60007la08xs8xblop`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792524614155-fc8659f1-748e-4e8e-9314-2e4ccf2320f6-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792524614155-fc8659f1-748e-4e8e-9314-2e4ccf2320f6-g800-card.webp
- `Photo.id=cmvh3c0z60008la08z5hkc1yz`; `order=7`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792525101000-dd80ca3b-cbe6-4974-afea-3470d3fc98fb-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792525101000-dd80ca3b-cbe6-4974-afea-3470d3fc98fb-g800-card.webp
- `Photo.id=cmvh3c0z60009la08ckf6qlf4`; `order=8`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792525109678-062ec89b-70f9-454f-8c13-cceaeeb0a5cf-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792525109678-062ec89b-70f9-454f-8c13-cceaeeb0a5cf-g800-card.webp

### Fiat Fastback 2024 — cmvjmollf0000l808wfn4g8gt

Status: vendido; histórico: não; 8 fotos com dependência.

- `Photo.id=cmvjmollf0001l808f3kytqq8`; `order=0`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678507065-97176c8d-0df2-48c4-97d9-be33b93af203-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678507065-97176c8d-0df2-48c4-97d9-be33b93af203-g800-card.webp
- `Photo.id=cmvjmollf0002l808srt315qo`; `order=1`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678527111-1f5861e0-a438-4449-9a97-a73c59f4b2e1-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678527111-1f5861e0-a438-4449-9a97-a73c59f4b2e1-g800-card.webp
- `Photo.id=cmvjmollf0003l808msz10ibn`; `order=2`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678458289-387f9cef-f696-4717-a3d6-650996819f9b-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678458289-387f9cef-f696-4717-a3d6-650996819f9b-g800-card.webp
- `Photo.id=cmvjmollf0004l808cb5vzods`; `order=3`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678458289-73832684-d715-42e5-9619-f7b67d375035-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678458289-73832684-d715-42e5-9619-f7b67d375035-g800-card.webp
- `Photo.id=cmvjmollf0005l808y1dm7vri`; `order=4`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678458289-c253597a-cc49-42fb-bc7c-f30d5095db93-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678458289-c253597a-cc49-42fb-bc7c-f30d5095db93-g800-card.webp
- `Photo.id=cmvjmollf0006l808x6p7qtal`; `order=5`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678458289-ad069caf-e956-4011-8179-e1b18317dfaa-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678458289-ad069caf-e956-4011-8179-e1b18317dfaa-g800-card.webp
- `Photo.id=cmvjmollf0007l8087l7mof3f`; `order=6`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678539018-24fee4de-58b0-413b-b5cf-ba05bdb3c296-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678539018-24fee4de-58b0-413b-b5cf-ba05bdb3c296-g800-card.webp
- `Photo.id=cmvjmollf0008l808o208fiqs`; `order=7`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678553174-8135c9d3-e8c2-4604-8bb9-4a1351b6225f-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1792678553174-8135c9d3-e8c2-4604-8bb9-4a1351b6225f-g800-card.webp

### Ford Ka+ 2020 — cmvr32eul0000l708vc6nd01c

Status: disponivel; histórico: não; 1 fotos com dependência.

- `Photo.id=cmvr32eul0008l7089raxuvxv`; `order=7`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1793129238717-53b16d27-126f-4034-936f-010772863f41-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1793129238717-53b16d27-126f-4034-936f-010772863f41-g800-card.webp

### Yamaha Fazer 250 2025 — cmvy8qouf0000jt08z7cj22xl

Status: disponivel; histórico: não; 2 fotos com dependência.

- `Photo.id=cmvy8qouf000bjt08z21gyina`; `order=10`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1793562179978-0eab1763-7725-4b9c-ab73-78abe96cf3df-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1793562179978-0eab1763-7725-4b9c-ab73-78abe96cf3df-g800-card.webp
- `Photo.id=cmvy8qouf000cjt08kscz82br`; `order=11`
  - `url`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1793562179978-8d231124-7388-4cb9-b298-c5a07e99bc31-g800.webp
  - `thumbnailUrl`: https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/1793562179978-8d231124-7388-4cb9-b298-c5a07e99bc31-g800-card.webp

## Prioridades e tarefas prontas para execução

1. **Alta × baixo esforço — sequência do Kicks:** responsável identifica a ordem dos sete IDs em cópia local; aplicar exclusivamente no admin e conferir invalidação. Bloqueador: sequência visual ainda não fornecida.
2. **Alta × médio esforço — recuperar as 16 fotos disponíveis:** localizar cópias locais de Haval H6, Fazer 250 e Ka+; publicar no Blob e substituir `url`/`thumbnailUrl` dos IDs acima, mantendo `order`. Revalidar cada veículo por Server Action. Se não houver cópia local, aguardar acesso autorizado ao ambiente apropriado; não baixar Storage de produção por script.
3. **Média × médio esforço — vendidos e retrato:** migrar os demais 217 registros e o retrato do fundador; validar fichas vendidas sem preço e com noindex; invalidar `site-settings` ao trocar o retrato.
4. **Alta × baixo esforço — evitar regressão no upload:** o fluxo administrativo de upload ainda é legado Supabase. Migrá-lo para Blob exige tarefa própria de upload/autorização/derivados; este PR bloqueia consumo público do Storage e não muda segredos ou dados de produção. Enquanto isso, novo upload legado não ficará disponível publicamente.

## Validação após a revisão de escopo

- `npm test`: 1.713 testes aprovados, zero falhas. Banco explicitamente local (`127.0.0.1:5432/garagem_e2e`), com `E2E_TEST` desligado nos unitários. A primeira execução com `E2E_TEST=1` teve oito falhas por substituir respostas HTTP por fixtures; a repetição com o ambiente correto passou integralmente.
- `npm run lint`: aprovado.
- `npm run build`: aprovado, com `DATABASE_URL` e `DIRECT_URL` locais e `E2E_TEST=1`.
- `npx tsc --noEmit` e `npx tsc --noEmit --project tsconfig.test.json`: aprovados.
- `E2E_TEST=1 E2E_PORT=3379 npx playwright test e2e/ordem-fotos-blob.spec.ts e2e/fotos-publicas.spec.ts`: 12 cenários aprovados, em 320, 390, 430 e 1440 px. Banco local dedicado, fixture local no browser e interceptação do servidor por `E2E_TEST=1`.
- `git diff --check`: aprovado.

História verificada: o visitante abre o estoque e a ficha, recebe a capa e a sequência ordenadas por `Photo.order` e navega pela galeria; os caminhos públicos de fotos não buscam Storage, e o catálogo pode converter fotos do Blob.

| Fronteira | Resultado | Evidência |
| --- | --- | --- |
| Banco local → API de estoque | Aprovado | Card escolhe `order=0` mesmo com inserção fora de ordem e nomes invertidos. |
| Banco local → ficha/JSON-LD | Aprovado | As sete URLs aparecem exatamente em `order=0…6`. |
| Ficha → navegação da galeria | Aprovado | Todas as sete posições conferidas em quatro tamanhos de tela. |
| Proxy legado → Storage | Bloqueado | Testes GET/HEAD esperam 410 sem nenhuma chamada ao fetcher, inclusive preview/fallback. |
| Catálogo → Blob → JPEG | Aprovado em teste local | Bytes gerados localmente, fetch simulado, JPEG com maior lado de 1280 px. Storage, origem arbitrária e redirect recusados. |
| Zoom → fonte pública | Aprovado | Somente Blob publicado recebe redirect; Storage recebe 204 sem download. |
| Arquivos reais ainda no Storage → Blob | Pendente | 233 fotos de veículos e o retrato do fundador sem cópia local comprovada. Não houve migração em produção. |
| Sequência visual desejada do Kicks | Pendente | Captura local confirma capa de interior; falta identificar os IDs na sequência desejada. |

Não foi acionado preview nem feito merge. Medição Lighthouse no preview não executada; não foram baixadas fotos para medição. O teste com fixture não certifica resolução/conteúdo visual dos arquivos reais.
