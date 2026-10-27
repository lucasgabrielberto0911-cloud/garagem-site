import type { VerifiedTopicKey } from "@/lib/vehicle-verified";

/**
 * Selos discretos da ficha, sob o preço. Só usam o que a loja já preencheu
 * para este exemplar: procedência = texto de documentação e vistoria, revisões
 * = texto de manutenção, opcionais = itens do anúncio. Sem dado, sem selo.
 */

export type VehicleSealId = "procedencia" | "revisoes" | "opcionais";

export type VehicleSeal = {
  id: VehicleSealId;
  label: string;
};

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
