/**
 * Âncoras da ficha pública: fotos, especificações e o texto do anúncio.
 * Os campos da ficha continuam os que o veículo já tem.
 */

export const FICHA_SECTION = {
  fotos: "fotos",
  especificacoes: "especificacoes",
  detalhes: "detalhes",
} as const;

export type FichaSectionId = (typeof FICHA_SECTION)[keyof typeof FICHA_SECTION];

const LINKS: ReadonlyArray<{ id: FichaSectionId; label: string }> = [
  { id: FICHA_SECTION.fotos, label: "Fotos" },
  { id: FICHA_SECTION.especificacoes, label: "Especificações" },
  { id: FICHA_SECTION.detalhes, label: "Detalhes" },
];

/** Detalhes só entra quando o anúncio tem texto ou itens. */
export function fichaSectionLinks(hasDetails: boolean) {
  return LINKS.filter(
    (link) => hasDetails || link.id !== FICHA_SECTION.detalhes,
  );
}

/**
 * Topo do scroll para a seção ficar logo abaixo da barra de âncoras.
 * `targetTop` e `navBottom` são coordenadas da viewport.
 */
export function fichaSectionScrollTop(
  targetTop: number,
  navBottom: number,
  scrollY: number,
) {
  return Math.max(0, scrollY + targetTop - navBottom - 8);
}
