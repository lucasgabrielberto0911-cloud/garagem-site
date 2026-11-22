Error executing tool read_file: File not found.
### Resumo da revisão (`e78b089` — `origin/main...HEAD`)

**Arquivos revisados:**
- `src/app/(site)/vender/page.tsx`
- `src/components/site/SellForm.tsx`
- `src/components/site/SellPhotoUpload.tsx`
- `src/lib/public-contact-pages.test.ts`

**Avaliação dos critérios:**
1. **Escopo estrutural:** OK. Nenhum campo novo, nenhum texto alterado e nenhuma mudança de ordem, padding ou espaçamento — apenas classes de cor, opacidade, peso tipográfico e anel de foco/erro (`fieldInputClass`).
2. **Contraste WCAG AA real:** OK nos textos e campos interativos.
   - Labels (`text-cream` sobre `ink` `#17171A`): **16,44:1**; `(opcional)` (`text-cream/80`): **10,78:1**; textos de apoio (`text-cream/85` e `text-cream/90`): **12,06:1** e **13,43:1**.
   - Inputs (`bg-asphalt` `#0D0D0F`): valor `text-cream` (**17,84:1**) vs placeholder `text-cream/65` (**7,79:1** com o fundo; razão **2,29:1** contra o valor digitado — passa AA; opcionalmente `text-cream/55` entrega **5,80:1** com o fundo e **3,08:1** de separação para o valor digitado).
   - Bordas de campo/botão (`border-white/45`): **4,52:1** sobre `asphalt` e **4,50:1** sobre `ink` (≥ 3:1). Foco/erro (`brand-light` `#FF4448`): **5,71:1** sobre `asphalt` e **5,26:1** sobre `ink` (≥ 3:1).
   - Observação: em `SellForm.tsx:399`, `WhatsAppButton` (`variant="outline"`) recebe `border-white/45` por cima do `border-white/20` interno do componente, deixando duas classes conflitantes no mesmo elemento.
3. **Regras visuais do site:** Botão vermelho (`bg-brand` + `text-white`, **5,16:1**) e botão WhatsApp sólido (`#25D366` + `text-asphalt`) estão corretos, sem dourado/amarelo. **Porém reprova em "SEM cards com borda":** o commit endureceu as bordas de blocos estáticos (`border-white/35` em `FormBlock`, rodapé de envio, `<details>`, aviso de rascunho e itens de foto; `border-white/30` e `border-brand/60` em `AfterSend`; `border-brand/50` no bloco de WhatsApp em `vender/page.tsx:117`). Pior: quando `<details>` abre (`SellForm.tsx:313-318`), sua `border-white/35` encosta na `border-white/35` do `FormBlock` interno, criando **borda dupla**.
4. **Coerência com tokens da marca:** Reprova. Foram introduzidas 7 ocorrências de `text-red-300` (`#FCA5A5`, tom salmão/rosa pastel) e `text-red-400` (`#F87171`) nos componentes públicos — onde antes não havia nenhuma ocorrência de `red-*`. Isso destoa de `text-brand-light` (`#FF4448`) usado na própria `vender/page.tsx` (`PageHeader` e "Como funciona"). O token existente `text-brand-light` já atinge **5,26:1** sobre `bg-ink` e **5,71:1** sobre `bg-asphalt` (ambos ≥ 4,5:1 AA para texto pequeno).
5. **Qualidade do teste novo (`public-contact-pages.test.ts:107-120`):** Reprova por fragilidade. Acopla na ordem literal de classes utilitárias, usa regex guloso atravessando o arquivo inteiro (`bg-brand` até `focus-visible:ring-white` com curinga multilinha, sujeito a falso-positivo entre elementos distintos) e congela justamente os desvios (`text-red-300`, `text-red-400`, `border-white/35 bg-ink`, `border-brand/50 bg-ink`) sem calcular contraste real.
6. **Verificação (`npm run check`):** Passou integralmente (2011 testes unitários, `eslint`, `check-footguns` e `tsc` sem erros).

### Ajustes obrigatórios
1. **Remover bordas fortes de "cards" nos blocos estáticos (`SellForm.tsx`, `SellPhotoUpload.tsx`, `vender/page.tsx`):** manter `border-white/45` apenas nos controles interativos (inputs, textarea, dropzone de upload e botões outline). Nos blocos de agrupamento (`FormBlock`, rodapé do formulário, `<details>`, aviso de rascunho, itens de `AfterSend`, itens de `SellPhotoUpload` e bloco de atalho em `vender/page.tsx`), separar seções por superfície (`bg-ink` / `bg-asphalt` / `bg-white/[0.04]`) e pelo `gap-3` já existente (sem adicionar espaço em branco extra e eliminando a borda dupla entre `<details>` e o `FormBlock` interno).
2. **Substituir `text-red-300` e `text-red-400` por tokens da marca (`SellForm.tsx`, `SellPhotoUpload.tsx`):** usar `text-brand-light` nos títulos de grupo, asterisco obrigatório e alertas de erro (garante **5,26:1** em `ink` e **5,71:1** em `asphalt`, cumprindo WCAG AA) e `hover:text-brand-light` (ou `hover:text-white`) na ação "Apagar preenchimento", removendo qualquer `red-*` padrão do Tailwind na área pública.
3. **Reescrever o teste em `src/lib/public-contact-pages.test.ts`:** trocar o snapshot frágil de strings/ordem de classes e o regex multilinha guloso por checagens semânticas e/ou cálculo real de razão de contraste WCAG (≥ 4,5:1 texto, ≥ 3:1 borda de campo/foco) a partir das cores de `tailwind.config.ts`, garantindo também ausência de `text-red-*` e de bordas fortes nos containers estáticos, com asserção do botão de submit restrita à tag do próprio botão.

VEREDITO: AJUSTAR
VERTEX_USAGE model=gemini-4-carbon pedido=gemini-4-carbon:high input=85298 cached=437190 output=4783 thoughts=15250 total=542521 reqs=12
