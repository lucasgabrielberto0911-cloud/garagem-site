# Área: painel — leads, agenda e pedidos

## Escopo

| Tema | Onde |
| --- | --- |
| CRM / leads | `src/app/admin/leads/`, `actions.ts` |
| Agenda | `src/app/admin/agenda/` |
| Funil | `src/lib/lead-funnel.ts`, `src/lib/leads.ts` |
| Pedido público | `src/app/(site)/pedido/page.tsx` |
| Veículo desejado | `src/app/(site)/estoque/wanted-actions.ts`, `WantedVehicleCta` |
| Webhook / e-mail | `LEAD_WEBHOOK_URL`, `RESEND_*` (opcional; pedido salva mesmo se falhar) |

## Comportamento

1. Dados de lead e cliente são **privados** — não expor em API pública, chat ou JSON-LD.
2. Actions usam `expireAdminData()` e tags de admin (`ADMIN_NEW_LEADS_TAG`, etc.) após mutação.
3. **Sem disparo automático** de WhatsApp em massa pelo painel (histórico manual de contato).
4. Normalização de telefone: `admin-phone.ts`; evitar duplicar cliente (locks em `admin-customer-lock.ts`).

## Diferença de vendas

- **Venda** fecha negócio e dispara `revalidatePublicStock` no veículo → [`admin-vendas.md`](admin-vendas.md).
- **Lead** é atendimento comercial anterior ou paralelo.

## Testes

- `e2e/admin-leads-fluxo.spec.ts`, `e2e/pedido-compacto.spec.ts`

## Erros comuns de IA

- Vazar telefone/e-mail de lead em log público ou resposta de API aberta.
- Criar automação que manda mensagem sem fluxo humano aprovado.
- Confundir origem do lead (`lead-origin.ts`, `WANTED_LEAD_SOURCE`).
