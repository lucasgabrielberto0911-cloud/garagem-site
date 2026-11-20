# TAREFA: revisão independente do PR #541

Você é o revisor independente. O autor foi o gemini-4-neon medium. Não revise com o mesmo modelo e não aceite o próprio trabalho do autor sem conferir o diff.

Trabalho em `~/wt/melhorias-vender`, branch `reserva/melhorias-vender`, commit `d9074b43369405b8b4fb781a9ed15192af03ead1`. PR draft: https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/541

## O que revisar

Polimento visual e de usabilidade de `/vender` e do formulário público no celular (e desktop o suficiente). Confira o diff contra `origin/main` e rode as suítes tocadas (`src/lib/public-contact-pages.test.ts`, `src/lib/sell-draft.test.ts`, `src/lib/sell-form-progress.test.ts` e o que mais o PR alterar) + lint/`tsc` nas áreas mexidas.

Pontos obrigatórios:
- Formulário mais simples no celular: etapas curtas ou agrupamento claro, progresso visível, poucos campos na frente, opcionais (placa, km, fotos, observações) à parte. Placa permanece opcional.
- Campos e botões principais ≥56px, texto no mínimo 16px, uma coluna no celular, erros em linguagem simples junto ao campo (sem jargão técnico).
- WhatsApp verde `#25D366` com letra branca; assistente, se aparecer, vermelho.
- Depois do envio, fica claro que a gente avalia e retorna no WhatsApp das 8h às 23h. Recibo `#sell-form-receipt-heading` permanece. Honeypot, rascunho local, fotos e `?interesse=` não podem ter quebrado.
- **Nenhum texto do formulário** (nome, telefone, placa, observações, mensagem) vai para Meta ou GA4. `trackLead` deve continuar só com `content_name: "Vender/Trocar"` e `content_ids: []`.
- Sem valor de parcela, sem simulador, sem as palavras "Simular"/"simulação" em páginas públicas. "Financiamos em até 60x" pode.
- Sem dourado/amarelo de marca. Vermelho como cor principal. Fontes Sora/Inter.
- Nunca "loja digital". Atendimento: "Atendemos Linhares, Aracruz e Grande Vitória" / "Combinamos o atendimento pelo WhatsApp", se houver texto novo.
- Desktop sem sticky que pareça segundo scroll (o aside não deve usar `lg:sticky` se isso criar scroll interno). Não reabra o #515 da ficha. O #536 (wizard do admin) não entra neste PR.
- Barra fixa do WhatsApp no celular não cobre o formulário nem os botões (`data-clear-fab` / `clear-fab-screen`).
- Sem dados reais de cliente, sem placa/CPF/telefone/chassi/RENAVAM mandados a IA, sem mexer em `.env`, chaves, depoimentos, Supabase ou `prisma db push`.
- Não use WebSearch, WebFetch nem Google Search.

## Veredito

No final, escreva com clareza:
- **VEREDITO: OK** ou **VEREDITO: BLOQUEANTE** (e o que precisa corrigir).

Se achar bloqueante, corrija no mesmo worktree, faça commit e `git push` **sem force**, nunca para main. Não faça merge. Não promova para produção. Não inclua TAREFA.md no commit.

Não revise o próprio conserto com este mesmo modelo se a mudança for grande; descreva o que corrigiu.

Encerre com o veredito, arquivos olhados, testes rodados e riscos não bloqueantes.
