## O que mudou

<!-- Resumo em português -->

## Por quê

## Área

<!-- Uma: home | estoque | ficha | admin | chat | seo | api/meta | infra | docs -->

## Validação

- [ ] `bash scripts/agentes-conflitos.sh` (ou `npm run agentes:conflitos`) sem sobreposição com PRs abertos
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] E2E rodado ou ajustado (se tela pública/admin relevante)
- [ ] Mutação de estoque chama `revalidatePublicStock()` (se aplicável)
- [ ] Sem acesso a produção / sem download de fotos de produção

## Preview

- [ ] Preview Vercel necessário → label `preview` ou commit `[preview]` **só no push final**
- [ ] Não necessário (só docs ou mudança interna)

## Referências

<!-- Issue, pesquisa em docs/pesquisas/, ADR -->
