# Revisão Independente — PR #535 (`reserva/adm-15c-preview-anuncio` @ `a4e6319`)

## Checklist de Verificação
- **Prévia aberta por padrão na Etapa 4:** OK (`useState(true)` em `VehicleFormSummary.tsx`, exibido quando `step === 4`).
- **Foto inteira em moldura 4:3 com fundo desfocado da própria capa (sem barras pretas):** OK (`aspect-[4/3] overflow-hidden bg-asphalt`, `img` de fundo com `data-testid="listing-preview-blur"` e `scale-125 object-cover blur-2xl` + `img` principal com `data-testid="listing-preview-photo"` e `object-contain`).
- **Botão "Esconder prévia":** OK (alterna entre `"Esconder prévia"` e `"Ver como fica no site"` com `aria-expanded` e `aria-controls`).
- **Texto fiel ao card público:** OK (usa `publicCardFacts`, câmbio Manual/Automático, oculta preço quando `status === "vendido"`, nunca exibe cidade).
- **Visual e regras de negócio:** OK (sem dourado, fontes `font-display` Sora / Inter padrão, tokens vermelhos `brand` / `brand-light`, sem valor de parcela/simulador, sem dados sensíveis).
- **Escopo e E2E:** OK (escopo restrito ao admin e testes; `e2e/admin-veiculo-wizard.spec.ts` usa `preview.getByTestId("listing-preview-photo")` em vez de seletor `img` genérico).

## Validação Técnica
- `npx tsc --noEmit`: passou sem erros.
- `npm run test:one -- src/lib/listing-preview.test.ts`: 6/6 testes passando.

## Problemas Bloqueantes
Nenhum.

VEREDITO: OK
