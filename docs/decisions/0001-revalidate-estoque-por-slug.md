# ADR 0001: Revalidar estoque por slug, não todas as fichas

**Status:** aceito

## Contexto

No Vercel Hobby, cada revalidação de página ISR consome tempo e cota. Uma edição de um veículo não deve regravar centenas de fichas.

## Decisão

Usar `revalidatePublicStock()` (`src/lib/public-stock-revalidate.ts`), que invalida tag, home, listagem, sitemap e **somente** o path canônico da ficha alterada (e slug anterior se mudou).

**Proibido** como atalho: `revalidatePath("/estoque/[id]", "page")`.

## Consequências

- Toda Server Action que altera dado público de veículo deve chamar o helper.
- TTL de 1 h no cache se esquecer a invalidação.
