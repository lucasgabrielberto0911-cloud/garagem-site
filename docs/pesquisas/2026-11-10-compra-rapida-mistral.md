# Compra rápida no admin e Mistral Large 4

## Resumo

A jornada tem placa/versão, compra/observações e resultado. A confirmação no seletor FIPE substitui o checklist de identidade. Preço e identificação mínima bastam; sem FIPE, o resultado informa que não há base para estimar revenda/lucro. Notas, custos e parecer usam hipóteses, sem transformar declarações em evidência verificada.

O cálculo continua em `purchase-simulator.ts`, sem alteração na matemática. A entrada curta recebe os fatores e parâmetros da política publicada; repasse usa a configuração rápida nos cenários, mantendo as reservas adversas. As revisões guardam a entrada curta e o parecer em `evidenceSnapshot`, sem migration nova e sem criar veículo, venda ou custo.

## Evidências e decisões

- `src/components/admin/compra/PurchaseForm.tsx:18`: duas etapas objetivas, um textarea opcional, seleção humana da versão, origem interna escolhida explicitamente e FIPE visível durante a compra. Revisões antigas continuam legíveis.
- `src/lib/purchase-quick.ts:14`: validação e mapeamento para o motor existente. Revenda deriva de FIPE × fator da política, em centavos com arredondamento para baixo. Sem amostra fictícia ou condição marcada como verificada.
- `src/lib/purchase-plate.ts:12`: GET exclusivamente no servidor para `https://placafipe.com/placa/{PLACA}`, timeout de oito segundos, cache privado por hash (sucesso cinco minutos; falha um minuto), mensagens para 404/429 e bloqueio de redirecionamentos. Parser lê identidade e códigos de tabelas; não devolve chassi, município ou documentos.
- `src/app/api/admin/compra/placa/route.ts:8` e `src/lib/fipe-history-store.ts:77`: usa códigos FIPE retornados pela placa; sem códigos, usa o `/match` existente. Não elimina silenciosamente uma versão quando um dos códigos falha. Histórico e validação do snapshot continuam no fluxo existente.
- `src/lib/admin-ai/purchase-nvidia.ts:74`: duas fases isoladas (custos → motor → parecer), sem importar o Assistente público. Extrai faixas em centavos e substitui cada categoria uma vez. O parecer não pode devolver números monetários nos textos; a nota é limitada pelo resultado financeiro e pelo laudo. Números de lucro, teto e ideal vêm exclusivamente do motor.
- `src/lib/purchase-store.ts:37`: cache compartilhado de resultados validados por hash, usando a tabela de cache já existente, com prefixo próprio e TTL de quinze minutos. A chave inclui entrada sanitizada e saída do motor para o parecer. O cache em memória deduplica chamadas na instância. Sem credencial, ignora parecer cacheado e mantém o cálculo com aviso.
- Credencial lida em execução: `ADMIN_AI_NVIDIA_API_KEY`, com fallback para `NVIDIA_API_KEY`. Nenhuma chave, prompt completo ou resposta bruta vai para logs/analytics. Sanitização também alcança o texto livre e os campos de identidade antes do envio.
- [Exemplo oficial NVIDIA Build](https://build.nvidia.com/mistralai/mistral-large-4-1t-a52b): endpoint `https://integrate.api.nvidia.com/v1/chat/completions` e ID `mistralai/mistral-large-4-1t-a52b`. [Referência oficial](https://docs.api.nvidia.com/nim/reference/mistralai-mistral-large-4-1t-a52b): modelo com saída estruturada e esforço de raciocínio `low`, usado para reduzir latência. Não há fallback para outro modelo.

## Validação e limites

Testes unitários cobrem fronteiras, mapeamento, custos sem duplicidade, cenários de repasse, privacidade, cache, falta de chave, erro/timeout/429 e parecer com dinheiro inventado. A jornada Playwright cobre os quatro tamanhos (320, 390, 430 e 1440), seleção explícita entre duas versões, salvamento/reabertura/revisão, ausência de criação de entidades comerciais e fallback manual sem FIPE inventada. Provedores são mockados; banco dedicado em loopback.

Verificação local concluída:

- `npm test`: 1.806 testes passaram, incluindo regressão de reenvio idempotente após reordenação de chaves pelo JSONB.
- `npx playwright test e2e/admin-compra.spec.ts --max-failures=1`: 12 testes passaram nos quatro tamanhos. Capturas locais revisadas; sem rolagem horizontal.
- `npm run lint`, `npx tsc --noEmit`, `npx tsc --noEmit --project tsconfig.test.json` e `npm run build`: passaram.
- Build e navegador usam `DATABASE_URL`/`DIRECT_URL` para `127.0.0.1/garagem_e2e`, credenciais NVIDIA vazias e notificações externas desligadas. Foi aplicada somente a estrutura já existente nesse banco de teste; nenhum seed foi executado.

A consulta direta à página inicial do Placa FIPE recebeu HTTP 403/Cloudflare neste ambiente. O formato público legível apresenta tabelas de identificação e códigos FIPE, mas não foi possível inspecionar o HTML completo nem confirmar XHR. A fixture do parser é sintética, baseada nesse formato; não contém cadastro de cliente. Bloqueios do provedor caem no preenchimento manual. A aceitação operacional do provedor no servidor de hospedagem continua sendo uma verificação externa necessária.

Não foram feitas chamadas NVIDIA com credencial real, downloads de fotos reais, mudanças de login/ambiente, alterações de flags remotas ou acesso ao banco de produção. O cadastro FIPE por código, os prompts/chaves do chat, a nota JEV, o Assistente público e o menu permanecem fora do diff.

## Prioridades e tarefas para revisão

1. Impacto alto × esforço baixo: revisar o PR draft e os checks; conferir visualmente as capturas da jornada nos quatro tamanhos.
2. Impacto alto × esforço baixo: na homologação autorizada, verificar uma consulta Placa FIPE e uma resposta NVIDIA com a credencial administrativa configurada pelo responsável. Confirmar alcance do provedor e latência; se o bloqueio de HTML persistir, tratar a fonte em tarefa própria, mantendo o fallback explícito.
3. Impacto médio × esforço baixo: validar as metas, reservas e fatores provisórios com a operação antes de usá-los como política comercial definitiva.
