import { publicInspectionNote } from "@/lib/vehicle-specs";

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

export type PurchaseFact = {
  id: string;
  label: string;
  detail?: string;
};

const TIRE_ACCESSORY = /pneu/i;

function cleanLine(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Fatos do anúncio que a loja preencheu. Vazio, falso ou genérico de loja
 * não entra — pneu e equipamento só se estiverem nos acessórios.
 */
export function publicPurchaseFacts(input: {
  inspection?: string | null;
  warranty?: string | null;
  accessories?: readonly string[] | null;
}): PurchaseFact[] {
  const facts: PurchaseFact[] = [];
  const inspectionRaw = cleanLine(input.inspection);
  if (inspectionRaw) {
    const note = publicInspectionNote(inspectionRaw);
    if (note) {
      facts.push({
        id: "inspection",
        label: "Vistoria da loja",
        detail: note,
      });
    }
  }

  const warranty = cleanLine(input.warranty);
  if (warranty) {
    facts.push({ id: "warranty", label: "Garantia", detail: warranty });
  }

  const accessories = (input.accessories ?? [])
    .map((item) => cleanLine(item))
    .filter(Boolean);
  const tires = accessories.filter((item) => TIRE_ACCESSORY.test(item));
  for (const tire of tires) {
    facts.push({ id: `tire:${tire.toLocaleLowerCase("pt-BR")}`, label: tire });
  }

  const equipment = accessories.filter((item) => !TIRE_ACCESSORY.test(item));
  if (equipment.length > 0) {
    const shown = equipment.slice(0, 3);
    const extra = equipment.length - shown.length;
    facts.push({
      id: "equipment",
      label: "Equipamentos",
      detail: extra > 0 ? `${shown.join(", ")} e mais ${extra}` : shown.join(", "),
    });
  }

  return facts;
}
