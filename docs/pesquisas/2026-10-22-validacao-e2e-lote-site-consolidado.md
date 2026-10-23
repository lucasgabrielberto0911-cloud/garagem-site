# Validação E2E do lote-site na branch consolidada de auditoria

## Resumo

Validação automatizada de ponta a ponta (E2E) com Playwright da suíte `e2e/lote-site.spec.ts` executada na branch `reserva/auditoria-consolidada` (consolidação dos PRs #362 Segurança, #363 Regras Admin, #364 Regras Site e #365 Identidade Visual).

A suíte foi executada contra build de produção do Next.js 16 (`npm run build`) e banco local PostgreSQL (`garagem_e2e`) semeado via `npm run e2e:seed`.

**Resultado geral:** 100% de aprovação (12 passed de 12 testes, 0 falhas, 0 flaky em 38,1 segundos).

Todos os testes passaram nas quatro resoluções configuradas:
1. `mobile-320` (320 × 740)
2. `mobile-390` (390 × 844)
3. `mobile-430` (430 × 932)
4. `desktop` (1440 × 900)

## Validação dos casos de teste

### 1. Contato inicial de venda dispensa placa e mantém dados em erro (`/vender`)
- **Arquivo:** [e2e/lote-site.spec.ts](file:///home/lucas/wt/agy1/e2e/lote-site.spec.ts#L14-L42)
- **Status:** Aprovado em todos os 4 viewports (tempos: 3.0s, 3.7s, 4.8s e 4.6s).
- **Comportamento validado:**
  - O campo de placa inicia oculto (`toBeHidden()`), dispensando a placa no primeiro contato.
  - Ao expandir campos adicionais e fornecer placa inválida ("ABC12"), o erro `#plate-error` é exibido sem perder os dados já digitados (`name`, `phone`, `brand`, `model`, `year`).
  - Nenhum lead inválido é persistido no banco no estado de erro.
  - Ao limpar a placa e submeter novamente, a venda é concluída com sucesso: o recibo `#sell-form-receipt-heading` é exibido e o registro é gravado em `LeadVenda` com `plate: ""`, preservando `interestVehicleId` e `source: "vender"`.
  - Mensagem de garantia de atendimento ("Placa e outros detalhes podem ser combinados no atendimento") visível ao usuário.

### 2. Cookies compactos preservam escolhas, privacidade e alvos de toque
- **Arquivo:** [e2e/lote-site.spec.ts](file:///home/lucas/wt/agy1/e2e/lote-site.spec.ts#L44-L65)
- **Status:** Aprovado em todos os 4 viewports (tempos: 2.4s, 2.4s, 2.4s e 2.2s).
- **Comportamento validado:**
  - Barra de consentimento no mobile tem altura contida (< 100px) e não causa scroll horizontal.
  - Botões ("Aceitar" e "Só o essencial") possuem alvos de toque acessíveis (altura ≥ 44px).
  - Persistência e leitura adequadas no `localStorage` (`garagem_consent = "essential"` e `"accepted"`).
  - Link direto para a política de privacidade (`/privacidade`).

### 3. Modelo só vendido mantém histórico e pedido preenchido sem preço (`/modelo/[slug]`)
- **Arquivo:** [e2e/lote-site.spec.ts](file:///home/lucas/wt/agy1/e2e/lote-site.spec.ts#L67-L77)
- **Status:** Aprovado em todos os 4 viewports (tempos: 1.3s, 1.2s, 1.3s e 1.3s).
- **Comportamento validado:**
  - Carro vendido não exibe preço em nenhum local (regra central de negócio do site).
  - Listagem indica "Já passaram pela Garagem" sem cards ativos de estoque (`article.listing-card` count = 0).
  - Meta description atualizada informando indisponibilidade no momento.
  - CTA "Pedir Honda Fit" navega para `/pedido` com o modelo já pré-preenchido e campo de preço vazio.

## Evidências da execução

### Log de execução do Playwright
```text
Running 12 tests using 1 worker

      1 …s:14:5 › contato inicial de venda dispensa placa e mantém dados em erro
  ✓   1 …› contato inicial de venda dispensa placa e mantém dados em erro (3.0s)
      2 …:5 › cookies compactos preservam escolhas, privacidade e alvos de toque
  ✓   2 …okies compactos preservam escolhas, privacidade e alvos de toque (2.4s)
      3 …67:5 › modelo só vendido mantém histórico e pedido preenchido sem preço
  ✓   3 …modelo só vendido mantém histórico e pedido preenchido sem preço (1.3s)
      4 …s:14:5 › contato inicial de venda dispensa placa e mantém dados em erro
  ✓   4 …› contato inicial de venda dispensa placa e mantém dados em erro (3.7s)
      5 …:5 › cookies compactos preservam escolhas, privacidade e alvos de toque
  ✓   5 …okies compactos preservam escolhas, privacidade e alvos de toque (2.4s)
      6 …67:5 › modelo só vendido mantém histórico e pedido preenchido sem preço
  ✓   6 …modelo só vendido mantém histórico e pedido preenchido sem preço (1.2s)
      7 …s:14:5 › contato inicial de venda dispensa placa e mantém dados em erro
  ✓   7 …› contato inicial de venda dispensa placa e mantém dados em erro (4.8s)
      8 …:5 › cookies compactos preservam escolhas, privacidade e alvos de toque
  ✓   8 …okies compactos preservam escolhas, privacidade e alvos de toque (2.4s)
      9 …67:5 › modelo só vendido mantém histórico e pedido preenchido sem preço
  ✓   9 …modelo só vendido mantém histórico e pedido preenchido sem preço (1.3s)
     10 …s:14:5 › contato inicial de venda dispensa placa e mantém dados em erro
  ✓  10 …› contato inicial de venda dispensa placa e mantém dados em erro (4.6s)
     11 …:5 › cookies compactos preservam escolhas, privacidade e alvos de toque
  ✓  11 …okies compactos preservam escolhas, privacidade e alvos de toque (2.2s)
     12 …67:5 › modelo só vendido mantém histórico e pedido preenchido sem preço
  ✓  12 …modelo só vendido mantém histórico e pedido preenchido sem preço (1.3s)

  12 passed (38.1s)
```

### Verificações complementares
- **Tipagem (`npx tsc --noEmit`):** 0 erros.
- **Build de produção (`npm run build`):** Sucesso na compilação estática e dinâmica de todas as rotas públicas e administrativas.
- **Banco de dados local:** `garagem_e2e` sincronizado via `npx prisma db push --skip-generate` e semeado via `npm run e2e:seed`.

## Prioridades (impacto × esforço)

Nenhum defeito impeditivo ou regressão foi identificado. A branch consolidada está íntegra para as jornadas públicas validadas.

| Item | Prioridade | Impacto | Esforço | Situação |
|---|---|---|---|---|
| Regressão em `/vender` (dispensa de placa e retenção de formulário em erro) | Alta | Alto | Baixo | Validado e aprovado 100% |
| Ocultação de preço em modelos vendidos (`/modelo/[slug]`) | Alta | Alto | Baixo | Validado e aprovado 100% |
| Acessibilidade e persistência do banner de cookies | Média | Médio | Baixo | Validado e aprovado 100% |
| Configuração de worktrees (`node_modules` com hardlinks) | Baixa | Médio | Baixo | Gotcha documentado e aplicado conforme AGENTS.md |

## Lista de tarefas para o PR consolidado

- [x] Rodar `e2e/lote-site.spec.ts` com banco semeado e Next.js buildado na branch consolidada.
- [x] Confirmar aprovação dos casos desktop e mobile (320px, 390px, 430px).
- [x] Garantir que o caso crítico de venda sem placa e sem perda de dados permaneça funcional.
- [x] Validar tipagem TypeScript com `tsc --noEmit`.
- [x] Relatório registrado em `docs/pesquisas/2026-10-22-validacao-e2e-lote-site-consolidado.md`.
