# TAREFA: revisão independente do PR #540

Você é o revisor independente. O autor foi o gemini-4-neon medium. Não revise com o mesmo modelo e não aceite o próprio trabalho do autor sem conferir o diff.

Trabalho em `~/wt/melhorias-ficha`, branch `reserva/melhorias-ficha`, commit `d39e179d5f9040a939f431b3f96d1274d3fbd81b`. PR draft: https://github.com/lucasgabrielberto0911-cloud/garagem-site/pull/540

## O que revisar

Polimento visual da ficha do anúncio no celular (`/estoque/[id]`). Confira o diff contra `origin/main` e, se couber, rode as suítes tocadas (`src/lib/ficha-cta.test.ts` e o que mais o PR alterar) + lint/`tsc` nas áreas mexidas.

Pontos obrigatórios:
- Hierarquia no celular: foto, título, preço e CTA principal de WhatsApp visíveis cedo; botões principais ≥56px.
- WhatsApp verde `#25D366` com letra branca; assistente, se aparecer, vermelho.
- Barra fixa (`VehicleMobileBar`) permanece; não cobre conteúdo (padding/safe-area).
- Fotos 4:3 com fundo desfocado; não borrou placa, não mudou cor, não trocou o recorte.
- Desktop **sem** `lg:sticky` no `.ficha-aside` (o Lucas pediu "um scroll só"; o #515 não entra neste PR).
- Sem valor de parcela, sem simulador, sem as palavras "Simular"/"simulação" em páginas públicas. "Financiamos em até 60x" pode.
- Sem dourado/amarelo de marca. Vermelho como cor principal. Fontes Sora/Inter.
- Nunca "loja digital". Atendimento: "Atendemos Linhares, Aracruz e Grande Vitória" / "Combinamos o atendimento pelo WhatsApp", se houver texto novo.
- Transmissão só Manual/Automático (CVT e Xtronic podem). Motor só por cilindrada; sem cv e sem número de marchas.
- Sem dados reais de cliente, sem placa/CPF/telefone/chassi/RENAVAM mandados a IA, sem mexer em `.env`, chaves, depoimentos, Supabase ou `prisma db push`.
- Não use WebSearch, WebFetch nem Google Search.

## Veredito

No final, escreva com clareza:
- **VEREDITO: OK** ou **VEREDITO: BLOQUEANTE** (e o que precisa corrigir).

Se achar bloqueante, corrija no mesmo worktree, faça commit e `git push` **sem force**, nunca para main. Não faça merge. Não promova para produção. Não inclua TAREFA.md no commit.

Não revise o próprio conserto com este mesmo modelo se a mudança for grande; descreva o que corrigiu.

Encerre com o veredito, arquivos olhados, testes rodados e riscos não bloqueantes.
