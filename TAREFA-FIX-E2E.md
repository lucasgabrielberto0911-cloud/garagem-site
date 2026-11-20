# TAREFA: corrigir e2e do PR #540 (dois botões de WhatsApp no celular)

Você é o autor deste conserto. Trabalho em `~/wt/melhorias-ficha`, branch `reserva/melhorias-ficha`, partindo de `d39e179`. Mesmo PR #540 (https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/540). Esforço medium, mudança pequena e focada.

## O que quebrou no CI (run 44748796046, SHA d39e179)

Não cancele o e2e (1) que ainda pode estar rodando. Os shards 2 e 3 já falharam.

### Regressão deste PR (obrigatório corrigir)

O polimento da ficha repetiu o CTA de WhatsApp no corpo mobile, além da barra fixa. No celular, `getByRole("link", { name: /^Chamar no WhatsApp/ })` agora encontra 2 elementos e o Playwright falha em modo estrito:

1. link do corpo: nome exato "Chamar no WhatsApp", origem `ficha`
2. barra fixa `#ficha-whatsapp`: `aria-label="Chamar no WhatsApp — Honda Civic ..."`, origem `barra fixa`

Falhas:
- `e2e/admin-leads-fluxo.spec.ts:465` — teste "WhatsApp: clique interceptado..." em mobile-390 e mobile-430
- `e2e/seo-modelos-funil.spec.ts:75` — teste "visita e clique consentidos..." em mobile-390 e mobile-430

Procure o mesmo seletor frouxo em todo `e2e/` e ajuste os que clicam na página inteira. Já estão scoped (não precisam mudar, só conferir):
- `e2e/ficha-v2.spec.ts` (`barra.getByRole`)
- `e2e/revisao-pr306.spec.ts` (`bar.getByRole`)
- `e2e/caminho-busca-ficha-whatsapp.spec.ts` (asserção de texto num botão já localizado)

Correção preferida no celular: clicar o CTA da barra fixa, de forma unívoca, por exemplo `page.locator("#ficha-whatsapp")` ou `[data-vehicle-mobile-bar] a` / o equivalente estável que já exista. Não use `.first()` cego se houver um seletor estável. No desktop, mantenha o seletor atual do aside ("Falar no WhatsApp").

Os testes não exigem `origem: ficha`; só o modelo, "Vim pelo Instagram." / origem google no funil, e o evento. A barra fixa atende.

**Não mude o visual da ficha só para o teste passar.** A repetição do CTA no corpo é intencional. Não altere nomes acessíveis de um jeito que prejudique o usuário. Não mexa em admin, home, /estoque, .env, depoimentos, Supabase, prisma.

### Fora do escopo (não "consertar")

`e2e/admin-leads-fluxo.spec.ts:169` ("legenda inteira do Fastback...") falhou só no mobile-390: o wizard ficou em "Etapa 1 de 4: Fotos" ao avançar, com `[WebServer] Error: Fotos inválidas.` No mobile-430 do shard 3 esse teste não falhou. É flake antigo do admin, não veio deste PR da ficha. Não altere o wizard/admin por causa disso.

## Qualidade, git e PR

- Ajuste só os specs necessários. Rode as suítes e2e que você alterar, se o ambiente tiver Playwright; senão deixe para o CI.
- Commit claro, **sem TAREFA.md / TAREFA-*.md**.
- Push: `git push` para `reserva/melhorias-ficha`, **sem force**, **nunca para main**. Se o push falhar no sandbox, deixe o commit local.
- Não abra outro PR. Não faça merge. Não promova. Sem WebSearch/WebFetch.
- Outro modelo vai revisar.

Encerre com resumo, arquivos, testes e o SHA.
