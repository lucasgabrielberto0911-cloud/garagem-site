/** Contrato compartilhado de captura e restauração; a ligação ao formulário pertence ao M6. */
export const VEHICLE_DRAFT_FIELDS = [
  "step",
  "fields",
  "photos",
  "brand",
  "model",
  "version",
  "color",
  "year",
  "yearModel",
  "plate",
  "plateEnd",
  "engine",
  "purchase",
  "description",
  "status",
  "values",
  "category",
  "locationCity",
  "fuel",
  "transmission",
  "accessories",
  "consigned",
] as const;

export const VEHICLE_DRAFT_FORM_FIELDS = [
  "doors",
  "warranty",
  "inspection",
  "featured",
  "hasVideo",
  "inStoreName",
  "hasSpareKey",
  "hasManual",
] as const;

/** Copia somente campos do contrato, sem compartilhar objetos com o formulário. */
export function vehicleDraftFields(source: Record<string, unknown>) {
  return structuredClone(
    Object.fromEntries(
      VEHICLE_DRAFT_FIELDS.filter((key) => Object.hasOwn(source, key)).map(
        (key) => [key, source[key]],
      ),
    ),
  );
}

export function vehicleDraftSummary(payload: unknown) {
  const draft =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const fields =
    draft.fields && typeof draft.fields === "object"
      ? (draft.fields as Record<string, unknown>)
      : {};
  const title = [draft.brand, draft.model, draft.year]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ");
  return {
    title: title || "Veículo sem identificação",
    preparationId:
      typeof fields.preparationId === "string" ? fields.preparationId : null,
  };
}

export function vehicleDraftHref(key: string, preparationId: string | null) {
  const params = new URLSearchParams({ draft: key.slice("vehicle:".length) });
  if (preparationId) params.set("prep", preparationId);
  return `/admin/veiculos/novo?${params}`;
}
