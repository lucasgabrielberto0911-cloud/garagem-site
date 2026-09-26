/** Selos do dossiê público. Só entram na ficha quando o admin marcou o item. */
export const DOSSIER_CHIP_LABELS = {
  hasSpareKey: "Chave reserva",
  hasManual: "Manual do proprietário",
  hasVideo: "Vídeo sob pedido",
} as const;

export type PublicDossierFlags = {
  hasSpareKey?: boolean | null;
  hasManual?: boolean | null;
  hasVideo?: boolean | null;
};

/** Chips da ficha, na ordem do anúncio. Falso, nulo ou ausente não aparece. */
export function publicDossierChips(flags: PublicDossierFlags): string[] {
  const chips: string[] = [];
  if (flags.hasSpareKey) chips.push(DOSSIER_CHIP_LABELS.hasSpareKey);
  if (flags.hasManual) chips.push(DOSSIER_CHIP_LABELS.hasManual);
  if (flags.hasVideo) chips.push(DOSSIER_CHIP_LABELS.hasVideo);
  return chips;
}
