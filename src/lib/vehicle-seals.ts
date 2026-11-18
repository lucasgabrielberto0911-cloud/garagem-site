import type { VerifiedTopicKey } from "@/lib/vehicle-verified";
import {
  DOSSIER_CHIP_LABELS,
  publicDossierChips,
  type PublicDossierFlags,
} from "@/lib/vehicle-dossier";

/**
 * Selos discretos da ficha, sob o preço. Só usam o que a loja já preencheu
 * para este exemplar: procedência = texto de documentação e vistoria, revisões
 * = texto de manutenção, opcionais = itens do anúncio, dossiê = chave reserva,
 * manual e vídeo. Sem dado, sem selo.
 */

export type VehicleSealId =
  | "procedencia"
  | "revisoes"
  | "opcionais"
  | "chave-reserva"
  | "manual"
  | "video";

export type VehicleSeal = {
  id: VehicleSealId;
  label: string;
};

const DOSSIER_CHIP_IDS: Record<string, VehicleSealId> = {
  [DOSSIER_CHIP_LABELS.hasSpareKey]: "chave-reserva",
  [DOSSIER_CHIP_LABELS.hasManual]: "manual",
  [DOSSIER_CHIP_LABELS.hasVideo]: "video",
};

/** Converte chips de `publicDossierChips` em selos tipados. */
export function dossierChipsToSeals(chips: readonly string[]): VehicleSeal[] {
  const seals: VehicleSeal[] = [];
  for (const label of chips) {
    const id = DOSSIER_CHIP_IDS[label];
    if (id) seals.push({ id, label });
  }
  return seals;
}

/** Converte as flags do dossiê (chave reserva, manual, vídeo) em selos. */
export function dossierSeals(flags: PublicDossierFlags): VehicleSeal[] {
  return dossierChipsToSeals(publicDossierChips(flags));
}

export function publicVehicleSeals(input: {
  verified: readonly { key: VerifiedTopicKey; text: string }[];
  accessories: readonly string[];
}): VehicleSeal[] {
  const hasText = (key: VerifiedTopicKey) =>
    input.verified.some((item) => item.key === key && item.text.trim() !== "");
  const seals: VehicleSeal[] = [];
  if (hasText("documentacao")) seals.push({ id: "procedencia", label: "Procedência" });
  if (hasText("manutencao")) seals.push({ id: "revisoes", label: "Revisões" });
  const count = input.accessories.filter((item) => item.trim() !== "").length;
  if (count > 0) {
    seals.push({ id: "opcionais", label: count === 1 ? "1 opcional" : `${count} opcionais` });
  }
  return seals;
}
