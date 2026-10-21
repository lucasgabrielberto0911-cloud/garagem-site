import { parseMoneyBR } from "./admin-money";

export function vehicleFieldErrors(
  input: {
    year: number;
    yearModel: number;
    km: number;
    status: string;
    doors: number | null;
  },
  currentYear = new Date().getFullYear(),
) {
  const errors: Record<string, string> = {};
  if (
    !Number.isInteger(input.year) ||
    input.year < 1950 ||
    input.year > currentYear + 1
  )
    errors.year = `Ano de fabricação: informe um ano inteiro entre 1950 e ${currentYear + 1}.`;
  if (
    !Number.isInteger(input.yearModel) ||
    input.yearModel < 1950 ||
    input.yearModel > currentYear + 2
  )
    errors.yearModel = `Ano modelo: informe um ano inteiro entre 1950 e ${currentYear + 2}.`;
  if (!Number.isInteger(input.km) || input.km < 0 || input.km > 999999)
    errors.km = "Informe KM inteiro entre 0 e 999.999.";
  if (!["disponivel", "reservado", "vendido"].includes(input.status))
    errors.status = "Status inválido.";
  if (
    input.doors != null &&
    (!Number.isInteger(input.doors) || input.doors < 0 || input.doors > 6)
  )
    errors.doors = "Portas: informe um número inteiro entre 0 e 6 ou deixe vazio.";
  return errors;
}

export function parseVehicleKm(value: string) {
  const text = value.trim();
  return /^(?:\d+|\d{1,3}(?:[.\s]\d{3})+)(?:\s*km)?$/i.test(text)
    ? Number(text.replace(/km$/i, "").replace(/[.\s]/g, "")) : NaN;
}

/** Entrada humana e FormData usam a mesma interpretação no cliente e servidor. */
export function parseVehicleFormFields(form: Pick<FormData, "get">) {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const integer = (name: string) => /^\d+$/.test(text(name)) ? Number(text(name)) : NaN;
  const km = parseVehicleKm(form.get("kmDisplay") == null ? text("km") : text("kmDisplay"));
  const year = integer("year");
  const yearModel = integer("yearModel");
  const doors = text("doors") ? integer("doors") : null;
  const price = parseMoneyBR(form.get("priceDisplay") == null ? text("price") : text("priceDisplay"));
  const purchaseRaw = ["on", "true"].includes(text("consigned")) ? "" : text("purchasePrice");
  const purchasePrice = parseMoneyBR(purchaseRaw);
  const plate = text("plate").replace(/[\s-]/g, "").toUpperCase() || null;
  const fieldErrors = vehicleFieldErrors({ year, yearModel, km, doors, status: text("status") || "disponivel" });
  if (price == null || price < 1 || price > 9_999_999)
    fieldErrors.price = "Preço: informe entre R$ 1,00 e R$ 9.999.999,00 (ex.: 45.900,00).";
  if (purchaseRaw && (purchasePrice == null || purchasePrice < 0))
    fieldErrors.purchasePrice = "Preço de compra: informe zero ou um valor positivo (ex.: 45.900,00).";
  if (plate && !/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(plate))
    fieldErrors.plate = "Placa: informe ABC-1234 ou ABC1D23, ou deixe vazio.";
  return { year, yearModel, km, doors, price, purchasePrice, plate, fieldErrors };
}
