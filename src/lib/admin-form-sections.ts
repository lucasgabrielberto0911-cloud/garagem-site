/**
 * Seções do cadastro de veículo no painel. Ordem mobile-first: o que muda no
 * dia a dia (preço, status, fotos) fica no topo; ficha e itens vêm depois.
 */

export type VehicleFormSectionId =
  | "identificacao"
  | "essencial"
  | "fotos"
  | "ficha"
  | "descricao"
  | "itens"
  | "operacao";

export type VehicleFormMode = "create" | "edit";

export const VEHICLE_FORM_SECTIONS: ReadonlyArray<{
  id: VehicleFormSectionId;
  label: string;
  nav: string;
  createOnly?: boolean;
}> = [
  { id: "identificacao", label: "Identificação", nav: "Veículo" },
  { id: "essencial", label: "Preço e status", nav: "Preço" },
  { id: "fotos", label: "Fotos e vídeo", nav: "Fotos" },
  { id: "ficha", label: "Ficha técnica", nav: "Ficha" },
  { id: "descricao", label: "Descrição", nav: "Descrição" },
  { id: "itens", label: "Acessórios e itens", nav: "Itens" },
  { id: "operacao", label: "Operação interna", nav: "Operação", createOnly: true },
];

export function vehicleFormSections(mode: VehicleFormMode) {
  return VEHICLE_FORM_SECTIONS.filter(
    (section) => mode === "create" || !section.createOnly,
  );
}

const FIELD_SECTION: Record<string, VehicleFormSectionId> = {
  brand: "identificacao",
  model: "identificacao",
  version: "identificacao",
  color: "identificacao",
  plate: "identificacao",
  category: "identificacao",
  price: "essencial",
  status: "essencial",
  locationCity: "essencial",
  featured: "essencial",
  photos: "fotos",
  year: "ficha",
  yearModel: "ficha",
  km: "ficha",
  fuel: "ficha",
  transmission: "ficha",
  engine: "ficha",
  doors: "ficha",
  plateEnd: "ficha",
  warranty: "ficha",
  inspection: "ficha",
  description: "descricao",
  accessories: "itens",
  purchasePrice: "operacao",
};

export function sectionForField(field: string): VehicleFormSectionId | null {
  return FIELD_SECTION[field] ?? null;
}

/** Seções com erro, na ordem em que aparecem na tela. */
export function sectionsWithErrors(
  errors: Record<string, string | undefined>,
): VehicleFormSectionId[] {
  const hit = new Set<VehicleFormSectionId>();
  for (const [field, message] of Object.entries(errors)) {
    if (!message) continue;
    const section = sectionForField(field);
    if (section) hit.add(section);
  }
  return VEHICLE_FORM_SECTIONS.map((section) => section.id).filter((id) =>
    hit.has(id),
  );
}

/**
 * Cadastro novo abre tudo (tem que preencher). Edição abre só o que costuma
 * mudar — preço/status e fotos — e o que precisa de atenção.
 */
export function initialOpenSections(
  mode: VehicleFormMode,
  options: { descriptionNeedsAttention?: boolean; photoCount?: number } = {},
): VehicleFormSectionId[] {
  if (mode === "create") {
    return vehicleFormSections("create")
      .map((section) => section.id)
      .filter((id) => id !== "operacao");
  }
  const open: VehicleFormSectionId[] = ["essencial", "fotos"];
  if (options.descriptionNeedsAttention) open.push("descricao");
  return open;
}

function compact(parts: Array<string | null | undefined | false>) {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" · ");
}

export function identitySummary(input: {
  brand: string;
  model: string;
  version?: string | null;
  color?: string | null;
  plate?: string | null;
}) {
  const name = compact([`${input.brand} ${input.model}`.trim()]);
  return compact([name, input.version, input.color, input.plate]) || "Preencher marca e modelo";
}

export function fichaSummary(input: {
  year: string | number;
  yearModel: string | number;
  km: string;
  transmission?: string | null;
  fuel?: string | null;
}) {
  const years = input.year && input.yearModel ? `${input.year}/${input.yearModel}` : "";
  const km = input.km ? `${input.km} km` : "";
  return compact([years, km, input.transmission, input.fuel]) || "Ano, km, câmbio";
}

export function descriptionSummary(text: string, max = 70) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Sem texto";
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export function accessoriesSummary(items: string[], max = 3) {
  if (items.length === 0) return "Nenhum item marcado";
  const head = items.slice(0, max).join(", ");
  return items.length > max ? `${head} +${items.length - max}` : head;
}
