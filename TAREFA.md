# TAREFA: tirar dourado/amarelo de marca e o texto de "simular" no site público

Você é o autor deste PR. Trabalho em `~/wt/fix-dourado`, branch `reserva/fix-dourado`, partindo de `origin/main` @ dff86884e7805f6b401176513fe9a4280154876c. Um PR só, escopo pequeno. Esforço medium (não mínimo, não fast).

## 1. Dourado/amarelo de marca (obrigatório)

Regra fixa do site: vermelho é a cor principal, **nunca dourado**. Na prévia da main (SHA dff8688) a faixa do topo, visível em `/links`, começa vermelha e termina amarela/dourada — medido `rgb(255, 192, 39)` (perto de `#ffc72c`) à direita. O filete sob o wordmark do rodapé também puxa para amarelo/laranja.

Troque esses degradês por **vermelho puro** ou por um **degradê só entre tons de vermelho** (ex.: `#e8181c` → `#d91519` → um vermelho um pouco mais escuro ou mais claro). Sem laranja, âmbar, amarelo ou dourado no cromado da marca.

Pontos já localizados (confirme e corrija todos, e busque o restante):

- `src/app/globals.css`
  - `--brand-gradient: linear-gradient(90deg, #e8181c 0%, #ff8a00 50%, #ffc72c 100%)`
  - `--brand-yellow: #ffc72c`
  - `.brand-shimmer`, `.progress-brand`, `.brand-splash-bar::after`: `linear-gradient(90deg, #e8181c, #ff8a00, #ffc72c, ...)`
- `src/components/site/ScrollProgress.tsx`: barra fixa do topo (`h-[3px]`, classe `progress-brand`) — é a faixa que o Lucas viu no print de `/links`.
- Filete sob o wordmark do rodapé: `src/components/site/SiteFooter.tsx` (`bg-brand-gradient`). O mesmo token aparece em `src/components/site/ui.tsx`, `NotFoundContent.tsx`, `FounderSection.tsx` e no sublinhado do item ativo do `SiteHeader`. Ao corrigir o token CSS, esses filetes devem ficar vermelhos também.
- `tailwind.config.ts`: token `yellow: "#FFC72C"`.

**Varra o código inteiro** (CSS, Tailwind, TSX, SVG, testes) por outros dourados/amarelos de marca: `amber`, `gold`, `yellow`, `#ffc0`, `#ffc7`, `#ffc72c`, `#ffd`, `#FFD700`, `#FFC107`, `brand-yellow`, `brand-gold`, `to-yellow`, `to-amber`, `via-yellow`. Corrija o que for cromado/marca no site público.

O que NÃO deve mudar:
- Verde do WhatsApp `#25D366` / `#128C7E`.
- Gradiente oficial do ícone do Instagram em `LinksHub` (`#fdf497` → `#fd5949` → `#d6249f` → `#285AEB`): é a cor do Instagram, não da marca da loja.
- Fotos, depoimentos, `.env`, chaves, Supabase, `prisma db push`.
- Home e `/estoque` além do que for consequência direta da correção do token de marca (não redesenhar).
- Laranja `#FF8A00` / `brand-orange` usado como aviso no **admin** pode ficar, desde que não entre no degradê da marca do site público. No site público, o cromado da marca (faixa, filetes, shimmer, splash, progress) não pode terminar em laranja/amarelo.

Se `--brand-yellow` / `yellow` do Tailwind forem usados só como status no admin, você pode manter o token no admin ou trocar por um aviso que não seja dourado de marca. O importante é o visitante do site não ver dourado/amarelo de marca.

Ajuste testes que afirmem o degradê antigo ou que já proíbam gold (`#ffc72c`, `#ffd700`, `brand-gradient` com amarelo). Há checagens em `src/lib/visual-pages-whatsapp.test.ts`, `vehicle-promo-kit.test.ts`, `ficha-cta.test.ts`, `site-support-float.test.ts`, `trade-whatsapp.test.ts`. Se algum teste quebrar porque ainda espera o amarelo de marca, atualize. Se algum teste do site público ainda aceitar dourado, reforce a proibição.

## 2. Texto de financiamento (obrigatório)

Em `/financiamento` (`src/app/(site)/financiamento/page.tsx`):

- Troque o texto do CTA **"Simular financiamento no WhatsApp"** por **"Falar sobre financiamento no WhatsApp"**.
- Tire a palavra **"simular"** ou **"simulação"** dos **textos públicos** (página, metadados, FAQ, política de privacidade visível, CTAs). "Financiamos em até 60x" pode ficar. **Proibido simulador e valor de parcela** (nenhum R$/mês, nenhuma calculadora).

Textos públicos já encontrados (corrija e busque outros):

- `src/app/(site)/financiamento/page.tsx`: CTA "Simular financiamento no WhatsApp".
- `src/app/(site)/como-funciona/page.tsx`: `description` da página fala em "simulação".
- `src/app/(site)/faq/page.tsx`: "para simular e fechar, chame no WhatsApp."
- `src/app/(site)/privacidade/page.tsx`: "quando você solicita simulação ou financiamento" — reescreva sem "simulação" (ex.: "quando você solicita financiamento"), sem mudar o sentido jurídico à toa.

NÃO mexa em:
- APIs e código interno do admin (`simulatePurchase`, `/api/admin/compra/simular`, `simulateFinancing`, status `simulacao` de contrato, etc.).
- Testes/fixtures onde "simula" significa o teste (ex.: "Simula uma área segura", "consulta simulada", "marchas simuladas" em fixture de câmbio).
- Comentários de e2e/README.

Atualize o e2e que busca o CTA antigo: `e2e/paginas-apoio.spec.ts` (`getByRole("link", { name: "Simular financiamento no WhatsApp" })`). Procure outras asserções do texto antigo e atualize para o novo. `e2e/integracao-auditoria.spec.ts` já exige que a ficha **não** contenha `/simular/i` — mantenha isso.

Templates de WhatsApp enviados a cliente (`src/lib/lead-whatsapp-templates.ts` tem "Simulação de financiamento") são texto que o cliente lê: reescreva o rótulo/corpo sem "simulação/simular", sem oferecer calculadora ou valor de parcela.

## 3. Qualidade, git e PR

- Rode `npm test` (ou as suítes tocadas) + `npm run lint` + `npm run check` (ou o equivalente) e `tsc` se couber. Corrija o que você quebrar.
- Não rode o e2e Playwright completo localmente (é longo); ajuste os specs que você alterar e, se possível, rode só esses arquivos.
- Commits claros em português, só desta tarefa. Sem `TAREFA.md` no commit (deixe untracked).
- **Push:** `git push -u origin HEAD:reserva/fix-dourado` — **sem force**, **nunca para main**. Se o push falhar por sandbox/`GIT_CONFIG`/`unable to fork`, não insista com force; deixe o commit local que o coordenador empurra.
- Abra um **PR draft** contra `main` com `gh pr create --draft`. Título e corpo em português. No corpo: Modelo e esforço (`gemini-4-neon`, medium), O que mudou, Risco, Como testar, Checagem de simplicidade. Deixe explícito que a faixa/filetes ficaram só em vermelho e que o CTA de financiamento não usa mais "simular".
- **NÃO faça merge. NÃO promova para produção. NÃO force-push. NÃO rode `prisma db push`. NÃO mexa em produção/Supabase/.env.**
- Não revise o próprio trabalho com o mesmo modelo; outro agente vai revisar.

Quando terminar: deixe o PR draft aberto (ou os commits prontos) e encerre com um resumo do que mudou, arquivos, testes rodados e o link do PR se existir.
