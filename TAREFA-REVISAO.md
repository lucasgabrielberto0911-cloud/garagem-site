# REVISÃO do PR #545 — faixa preta da home + infos pontuais

Você é o REVISOR, não o autor. Modelo: gemini-4-hydrogen medium. O autor foi gemini-4-neon medium.

PR: https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/545
Branch: reserva/home-pontual
Commit: deb46e1
Base: main @ da77e99

## 0. NÃO use WebSearch, WebFetch nem Google Search

Revise o diff local (`git diff da77e99..HEAD`, sem TAREFA.md) e o CSS/layout relacionados.

## Critérios obrigatórios

- A faixa preta entre a borda de baixo do header e o degradê vermelho do hero some no celular e no desktop. O override de `pt-site-header` na home não pode desfazer o ajuste da ficha nem do `/estoque`.
- Há infos pontuais sob o título (garantia 3 meses motor e câmbio, vistoria da loja, aceitamos seu carro na troca, financiamos em até 60x), sem card com borda/sombra e sem vazio extra.
- Os 3 botões grandes permanecem (WhatsApp `#25D366` com texto/ícone `text-asphalt`, Ver estoque, assistente vermelho com texto branco, ≥56px).
- Depoimentos: texto não alterado. Sem busca/filtros de volta no estoque ou na home. Sem Simular, valor de parcela, loja digital, dourado.
- O flake de alinhamento da home (`e2e/home-barra-standalone.spec.ts` ~218–219, limite < 2px) NÃO deve ter sido afrouxado. Asserções novas de conteúdo/posição ok, desde que não quebrem o critério.
- Sem `TAREFA.md` no commit. Sem `.env`, chaves, Supabase, `prisma db push`.

Se encontrar um problema bloqueante neste escopo: correção mínima, `npm run check` (ou suítes tocadas), commit em português (sem TAREFA.md), push SEM force (se falhar, deixe local). Não redesenhe a página.

## Saída

Imprima claramente **VEREDITO: OK** ou **VEREDITO: BLOQUEANTE**. Depois: resumo, arquivos, testes, se houve commit novo, riscos não bloqueantes. NÃO faça merge. NÃO promova. NÃO force-push.
