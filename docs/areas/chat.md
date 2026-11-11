# Área: assistente (chat do site)

## Escopo

- Rota: `src/app/api/chat/route.ts`
- Lógica: `src/lib/chat-http.ts`, `chat-turn.ts`, `chat-gemini.ts` e módulos `chat-*`
- UI: componente de chat no layout do site (deferido para performance)

## Comportamento obrigatório

1. **Mesmas regras do site:** vendido sem preço; **sem cidade do veículo**; não inventar estoque.
2. **Estoque:** buscas usam cache/dados públicos (`chat-stock-cache.ts`, testes `chat-sales-search.test.ts`).
3. **Modelos:** Gemini + fallbacks; chaves só servidor (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`).
4. **Rate limit:** `rate-limit.ts` — não remover proteção em PR “para debug”.

## Testes

- Unitários: `src/lib/chat-*.test.ts` (muitos cenários de intenção e busca).
- E2E: `chat-ao-vivo.spec.ts`, `chat-mobile-polish.spec.ts`, `chat-research-journeys.spec.ts`
- Script conversa: ver `e2e/README.md` (`E2E_CHAT_CONVERSA=1`).

## Coordenação

- Label de área `chat` no GitHub — conflita com mudanças em `GEMINI_*` e copy do assistente.
- Textos visíveis “Sua Garagem” no assistente: só mudar em PR combinado (AGENTS.md).

## Erros comuns de IA

- Passar `city` do veículo na resposta “para ajudar o cliente”.
- Chamar API de produção para “testar o chat”.
- `force-dynamic` na rota sem necessidade.
