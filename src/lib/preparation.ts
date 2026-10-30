import { parseMoneyBR } from "./admin-money";
import { isValidPlate, normalizePlate } from "./format";

export type PreparationInput = {
  brand: string;
  model: string;
  color: string | null;
  year: number | null;
  km: number | null;
  plate: string | null;
  ready: boolean;
  posted: boolean;
  purchasedAt: Date | null;
  purchasePrice: number | null;
};

const text = (value: FormDataEntryValue | null) => String(value ?? "").replace(/\s+/g, " ").trim();

/** Valida o formulário de "Em preparação". Só marca e modelo são obrigatórios. */
export function parsePreparationForm(form: FormData): { ok: true; data: PreparationInput } | { ok: false; message: string } {
  const brand = text(form.get("brand"));
  const model = text(form.get("model"));
  if (!brand || !model) return { ok: false, message: "Informe a marca e o modelo." };

  const yearText = text(form.get("year"));
  const year = yearText ? Number(yearText) : null;
  if (year != null && (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1)) return { ok: false, message: "Ano inválido." };

  const kmText = text(form.get("km")).replace(/\./g, "");
  const km = kmText ? Number(kmText) : null;
  if (km != null && (!Number.isInteger(km) || km < 0 || km > 2_000_000)) return { ok: false, message: "KM inválido." };

  const plateText = text(form.get("plate"));
  if (plateText && !isValidPlate(plateText)) return { ok: false, message: "Placa inválida." };

  const priceText = text(form.get("purchasePrice"));
  const purchasePrice = priceText ? parseMoneyBR(priceText) : null;
  if (priceText && (purchasePrice == null || purchasePrice < 0)) return { ok: false, message: "Valor de compra inválido." };

  const dateText = text(form.get("purchasedAt"));
  const purchasedAt = dateText ? new Date(`${dateText}T12:00:00-03:00`) : null;
  if (purchasedAt && Number.isNaN(purchasedAt.getTime())) return { ok: false, message: "Data da compra inválida." };

  return {
    ok: true,
    data: {
      brand, model, color: text(form.get("color")) || null, year, km,
      plate: plateText ? normalizePlate(plateText) : null,
      ready: form.get("ready") === "on", posted: form.get("posted") === "on",
      purchasedAt, purchasePrice,
    },
  };
}

/** Só dados reais do carro em preparação; câmbio, combustível, fotos e preço o admin confirma no cadastro. */
export function preparationPrefill(item: Pick<PreparationInput, "brand" | "model" | "color" | "year" | "km" | "plate" | "purchasePrice">) {
  return {
    brand: item.brand,
    model: item.model,
    color: item.color,
    year: item.year ?? undefined,
    yearModel: item.year ?? undefined,
    km: item.km ?? undefined,
    plate: item.plate,
    purchasePrice: item.purchasePrice,
  };
}

/** Carro vindo de "Em preparação" só entra no estoque público com ao menos uma foto. */
export function preparationPhotoError(photoCount: number): string | null {
  return photoCount > 0 ? null : "Adicione as fotos do carro antes de cadastrar no estoque.";
}

export const PREPARATION_CLAIM_ERROR = "Este carro já foi movido ou não está mais marcado como pronto em Em preparação.";

/** Consome a preparação dentro da transação do cadastro; sem exatamente 1 registro pronto, lança e reverte o veículo. */
export async function claimPreparation(
  tx: { preparationVehicle: { deleteMany(args: { where: { id: string; ready: true } }): Promise<{ count: number }> } },
  id: string,
) {
  const { count } = await tx.preparationVehicle.deleteMany({ where: { id, ready: true } });
  if (count !== 1) throw new Error(PREPARATION_CLAIM_ERROR);
}

/** Mantém escopos antigos; cadastros independentes recebem um identificador estável pela página. */
export function vehicleDraftScope(vehicleId?: string | null, preparationId?: string | null, draftId?: string | null) {
  if (vehicleId) return vehicleId;
  const suffix = (preparationId || draftId)?.replace(/^(?:new-)+/, "");
  return !suffix || suffix === "new" ? "new" : `new-${suffix}`;
}
