# TAREFA: revisão independente do conserto e2e no PR #540

Você é o revisor independente. O autor deste conserto foi o gemini-4-hydrogen medium. O autor do polimento visual anterior foi o Neon (já revisado OK no d39e179). Não aceite o trabalho sem conferir o diff.

Trabalho em `~/wt/melhorias-ficha`, branch `reserva/melhorias-ficha`. Commit a revisar: `ba41b01f6743b87fa2458545965d5f5ccd6d8838` (em cima de `d39e179`). PR draft: https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/540

## Contexto

No CI 44748796046, e2e (2) e (3) falharam porque no celular existem 2 links "Chamar no WhatsApp" (corpo + barra fixa `#ficha-whatsapp`). O conserto trocou o seletor frouxo nos testes que clicavam na página inteira por `[data-vehicle-mobile-bar] #ficha-whatsapp`. Desktop não mudou. Visual da ficha não mudou. O flake do Fastback/admin ("Etapa 1 de 4: Fotos" / Fotos inválidas) ficou de fora, de propósito.

## O que conferir

- O seletor é unívoco e aponta para a barra fixa no celular.
- Não há outros e2e com o mesmo seletor frouxo (`page.getByRole("link", { name: /^Chamar no WhatsApp/ })` sem escopo) que ainda quebrem.
- Não houve mudança de UI, .env, admin, depoimentos ou prisma.
- Não use WebSearch/WebFetch.

Se couber, rode as suítes tocadas. Veredito claro: **VEREDITO: OK** ou **VEREDITO: BLOQUEANTE**. Se bloqueante, corrija, commit e push **sem force**, nunca para main. Não faça merge. Não promova. Sem TAREFA*.md no commit.
