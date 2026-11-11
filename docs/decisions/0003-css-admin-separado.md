# ADR 0003: CSS Tailwind do admin separado do site público

**Status:** aceito

## Contexto

O bundle CSS do painel inchava o CSS bloqueante da home, estoque e ficha (LCP).

## Decisão

- `tailwind.config.ts` do site **não** escaneia `src/app/admin/**` nem `src/components/admin/**`.
- Painel usa `admin.css` + `tailwind.admin.config.ts`.
- Regras `:focus-visible` duplicadas no fim de `globals.css` e `admin.css`.

## Consequências

- Componente admin em página pública fica sem estilo — não fazer isso.
- Mudanças de foco acessível exigem editar os dois arquivos.
