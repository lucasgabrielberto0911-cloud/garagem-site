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
