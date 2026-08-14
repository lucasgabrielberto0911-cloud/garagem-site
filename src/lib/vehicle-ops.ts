export const VEHICLE_COST_KINDS = [
  { value: "despachante", label: "Despachante" },
  { value: "documentacao", label: "Documentação" },
  { value: "ipva", label: "IPVA" },
  { value: "mecanica", label: "Mecânica / revisão" },
  { value: "estetica", label: "Estética" },
  { value: "laudo", label: "Laudo / vistoria" },
  { value: "transporte", label: "Transporte" },
  { value: "outro", label: "Outro" },
] as const;

export type VehicleCostKind = (typeof VEHICLE_COST_KINDS)[number]["value"];

export const VEHICLE_DOC_KINDS = [
  { value: "crlv", label: "CRLV / DUT" },
  { value: "recibo", label: "Recibo de compra" },
  { value: "procuracao", label: "Procuração" },
  { value: "laudo", label: "Laudo" },
  { value: "nf", label: "Nota fiscal" },
  { value: "outro", label: "Outro" },
] as const;

export type VehicleDocKind = (typeof VEHICLE_DOC_KINDS)[number]["value"];

export function costKindLabel(kind: string) {
  return VEHICLE_COST_KINDS.find((item) => item.value === kind)?.label ?? kind;
}

export function docKindLabel(kind: string) {
  return VEHICLE_DOC_KINDS.find((item) => item.value === kind)?.label ?? kind;
}

export function isOtherKind(kind: string) {
  return kind === "outro";
}

/** Título na lista: o nome livre entra no lugar de “Outro”. */
export function costListTitle(kind: string, description: string) {
  const note = description.trim();
  if (isOtherKind(kind)) return note || "Outro";
  return note ? `${costKindLabel(kind)} · ${note}` : costKindLabel(kind);
}

export function docListTitle(kind: string, title: string) {
  const name = title.trim();
  if (isOtherKind(kind)) return name || "Outro";
  return name || docKindLabel(kind);
}

export function isCostKind(value: string): value is VehicleCostKind {
  return VEHICLE_COST_KINDS.some((item) => item.value === value);
}

export function isDocKind(value: string): value is VehicleDocKind {
  return VEHICLE_DOC_KINDS.some((item) => item.value === value);
}

export function extrasTotal(costs: Array<{ amount: number }>) {
  return costs.reduce((sum, item) => sum + (item.amount || 0), 0);
}

export function investedTotal(
  purchasePrice: number | null | undefined,
  costs: Array<{ amount: number }>,
) {
  return (purchasePrice ?? 0) + extrasTotal(costs);
}

export function hasCostBasis(
  purchasePrice: number | null | undefined,
  costs: Array<{ amount: number }>,
) {
  return (purchasePrice != null && purchasePrice > 0) || extrasTotal(costs) > 0;
}

export function expectedMargin(
  salePrice: number,
  purchasePrice: number | null | undefined,
  costs: Array<{ amount: number }>,
) {
  return salePrice - investedTotal(purchasePrice, costs);
}
