# Área: painel — veículos, fotos e publicação

## Escopo

- Lista/edição: `src/app/admin/veiculos/`
- Server Actions: `actions.ts`, `commercial-actions.ts`, `ops-actions.ts`, `verified-actions.ts`
- Componentes: `src/components/admin/` (formulário, fila de fotos, preview de anúncio…)
- Dados admin: `src/lib/admin-vehicles.ts`, invalidação `admin-revalidate.ts`

## Fluxo típico

1. Criar/editar veículo → gravar no Postgres via Prisma.
2. Upload de fotos → fila em `api/upload/*`, variantes WebP, R2 para fotos novas.
3. Publicar / mudar status → **`revalidatePublicStock()`** se afetar o público.
4. Venda → `vendas/actions.ts` ou sell route — estoque e ficha vendida sem preço.

## CSS

- Painel usa **`admin.css`** + Tailwind admin — não depende do bundle CSS do site.
- Não reutilizar componente admin em página pública sem revisar classes.

## Segurança

- Tudo exige sessão admin (`auth.ts`).
- Masters e documentos: bucket privado, URLs assinadas — ver `docs/documentos-privados.md`.

## Testes

- E2E: `admin-veiculo-wizard.spec.ts`, `admin-veiculo-edicao.spec.ts`, `admin-rascunhos-multiplos.spec.ts`, `admin-lista-lote.spec.ts`
- IA admin (mock): `admin-ia.spec.ts` (ver `e2e/README.md`)

## Erros comuns de IA

- Esquecer `revalidatePublicStock` após salvar.
- Alterar privacidade de bucket Storage no mesmo PR que feature de UI.
- Rodar script de backfill de fotos contra produção.

Ver também área [`fotos.md`](fotos.md).
