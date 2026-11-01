/**
 * Tipo do anúncio (carro ou moto) com combustível, câmbio e acessórios
 * prontos equivalentes — no estilo LM Veículos.
 */

export const VEHICLE_CATEGORIES = [
  { value: "carro", label: "Carro" },
  { value: "moto", label: "Moto" },
] as const;

export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number]["value"];

export function isVehicleCategory(value: unknown): value is VehicleCategory {
  return value === "carro" || value === "moto";
}

export function parseVehicleCategory(value: unknown): VehicleCategory {
  return isVehicleCategory(value) ? value : "carro";
}

export function vehicleCategoryLabel(category: string): string {
  return category === "moto" ? "Moto" : "Carro";
}

export const CAR_FUELS = [
  "Flex",
  "Gasolina",
  "Etanol",
  "Diesel",
  "Híbrido",
  "Elétrico",
] as const;

export const MOTO_FUELS = ["Gasolina", "Etanol", "Flex", "Elétrico"] as const;

export const CAR_TRANSMISSIONS = [
  "Manual",
  "Automático",
  "CVT",
  "Automatizado",
] as const;

export const MOTO_TRANSMISSIONS = [
  "Manual",
  "Automático",
  "Semi-automático",
  "CVT",
] as const;

export const CAR_ACCESSORY_PRESETS = [
  "Multimídia",
  "Bluetooth",
  "Ar-condicionado",
  "Ar digital",
  "Direção hidráulica",
  "Direção elétrica",
  "Vidros elétricos",
  "Travas elétricas",
  "Alarme",
  "Sensor de estacionamento",
  "Câmera de ré",
  "Bancos de couro",
  "Bancos elétricos",
  "Airbag duplo",
  "ABS",
  "Controle de estabilidade",
  "Piloto automático",
  "Volante multifuncional",
  "Rodas de liga leve",
  "Teto solar",
  "Faróis de LED",
  "Farol de neblina",
  "Retrovisores elétricos",
  "Computador de bordo",
  "Entrada USB",
  "Apple CarPlay / Android Auto",
  "Keyless (partida por botão)",
  "Sensor de chuva",
  "Sensor crepuscular",
] as const;

export const MOTO_ACCESSORY_PRESETS = [
  "ABS",
  "Freio a disco",
  "Freio a disco (dianteiro e traseiro)",
  "Injeção eletrônica",
  "Partida elétrica",
  "Painel digital",
  "Painel digital TFT",
  "Farol de LED",
  "LED diurno (DRL)",
  "USB",
  "Bluetooth",
  "Alarme",
  "Imobilizador",
  "Guidão esportivo",
  "Guidão alto",
  "Bauleto",
  "Bauleto original",
  "Protetor de motor",
  "Protetor de carenagem",
  "Escape esportivo",
  "Amortecedor a gás",
  "Suspensão regulável",
  "Pneus novos",
  "Rodas de liga",
  "Manete regulável",
  "Empunhadura aquecida",
  "Cavalete central",
  "Para-brisa",
  "Bolha / carenagem",
  "Kit relógio / computador de bordo",
] as const;

/** Presets de carro (compatibilidade). */
export const VEHICLE_ACCESSORY_PRESETS = CAR_ACCESSORY_PRESETS;

export function getFuels(category: VehicleCategory): readonly string[] {
  return category === "moto" ? MOTO_FUELS : CAR_FUELS;
}

export function getTransmissions(category: VehicleCategory): readonly string[] {
  return category === "moto" ? MOTO_TRANSMISSIONS : CAR_TRANSMISSIONS;
}

export function getAccessoryPresets(
  category: VehicleCategory,
): readonly string[] {
  return category === "moto" ? MOTO_ACCESSORY_PRESETS : CAR_ACCESSORY_PRESETS;
}

export function defaultFuel(category: VehicleCategory): string {
  return category === "moto" ? "Gasolina" : "Flex";
}

export function defaultTransmission(category: VehicleCategory): string {
  return category === "moto" ? "Manual" : "Automático";
}

/** Remove presets do outro tipo; mantém itens manuais e os do tipo atual. */
export function filterAccessoriesForCategory(
  accessories: string[],
  category: VehicleCategory,
): string[] {
  const keep = new Set(
    getAccessoryPresets(category).map((item) => item.toLocaleLowerCase("pt-BR")),
  );
  const drop = new Set(
    getAccessoryPresets(category === "moto" ? "carro" : "moto").map((item) =>
      item.toLocaleLowerCase("pt-BR"),
    ),
  );

  return accessories.filter((item) => {
    const key = item.toLocaleLowerCase("pt-BR");
    if (keep.has(key)) return true;
    if (drop.has(key)) return false;
    return true;
  });
}

/**
 * Sanitiza e normaliza um item de acessório / opcional:
 * Trunca em palavra inteira sem cortar no meio da palavra,
 * corrige truncamentos conhecidos e fecha parênteses abertos.
 */
export function sanitizeAccessory(raw: string, maxLen = Infinity): string {
  if (typeof raw !== "string") return "";
  let text = raw.trim().replace(/\s+/g, " ");
  if (!text) return "";

  // Corrige truncamento conhecido de palavra
  text = text
    .replace(/\bcombustíve\b/gi, "combustível")
    .replace(/\bcombustive\b/gi, "combustível")
    .replace(/\bGPS\s+integ\b/gi, "GPS integrado")
    .replace(/\binteg$/gi, "integrado");

  maxLen = Math.max(0, maxLen);
  if (text.length > maxLen) {
    const lastSpace = text.lastIndexOf(" ", maxLen);
    text = lastSpace < 0 ? "" : text.slice(0, lastSpace);
  }

  for (;;) {
    // Remove pontuações finais pendentes deixadas por corte
    text = text.replace(/[,;:\-\s]+$/, "");
    // Fecha parênteses abertos desbalanceados
    const missing = Math.max(0, (text.match(/\(/g) || []).length - (text.match(/\)/g) || []).length);
    if (text.length + missing <= maxLen) return text + ")".repeat(missing);
    text = text.replace(/\s*\S+$/, "");
  }
}

/** Limpa, corta e remove duplicatas (case-insensitive), preservando a ordem. */
export function normalizeAccessories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = sanitizeAccessory(item, 100);
    if (!value) continue;
    const key = value.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result.slice(0, 60);
}

const ACCESSORY_CANONICAL_GROUPS: ReadonlyArray<{
  canonical: string;
  variants: readonly string[];
}> = [
  {
    canonical: "6 airbags",
    variants: [
      "6 airbags",
      "6 air bags",
      "6 airbags (frontais, laterais e de cortina)",
      "seis airbags",
    ],
  },
  {
    canonical: "4 airbags",
    variants: [
      "4 airbags",
      "4 air bags",
      "4 airbags (frontais e laterais)",
      "quatro airbags",
    ],
  },
  {
    canonical: "Airbag duplo",
    variants: [
      "airbag duplo",
      "air bag duplo",
      "airbags frontais duplos",
      "airbag duplo frontal",
      "duplo airbag",
    ],
  },
  {
    canonical: "Alarme",
    variants: [
      "alarme",
      "alarme antifurto",
      "alarme perimétrico",
      "alarme perimetrico",
      "alarme antifurto perimétrico",
      "alarme antifurto perimetrico",
    ],
  },
  {
    canonical: "Piloto automático",
    variants: [
      "piloto automático",
      "piloto automatico",
      "piloto automático (cruise control)",
      "piloto automatico (cruise control)",
      "cruise control",
    ],
  },
  {
    canonical: "Sensor de pressão dos pneus (TPMS)",
    variants: [
      "sensor de pressão dos pneus (tpms)",
      "sensor de pressao dos pneus (tpms)",
      "monitoramento de pressão dos pneus (tpms)",
      "monitoramento de pressao dos pneus (tpms)",
      "monitoramento de pressão dos pneus",
      "alerta de pressão dos pneus (itpms)",
      "alerta de pressao dos pneus (itpms)",
      "itpms",
      "tpms",
    ],
  },
  {
    canonical: "Apple CarPlay / Android Auto",
    variants: [
      "apple carplay / android auto",
      "apple carplay e android auto",
      "carplay e android auto",
      "carplay / android auto",
      "espelhamento de celular (apple carplay e android auto)",
    ],
  },
];

function stripGroupPrefix(value: string): string {
  return value.replace(/^(?:Conforto|Segurança|Facilidades|Outros opcionais):\s*/i, "").trim();
}

/**
 * Unifica variações redundantes de acessórios nos filtros do estoque
 * (ex.: "6 Air Bags" e "6 airbags (frontais, laterais e de cortina)" -> "6 airbags"),
 * mantendo intactos os demais rótulos.
 */
export function canonicalStockAccessoryLabel(raw: string): string {
  const sanitized = sanitizeAccessory(raw, 100);
  if (!sanitized) return "";
  const bare = stripGroupPrefix(sanitized).toLocaleLowerCase("pt-BR");
  for (const group of ACCESSORY_CANONICAL_GROUPS) {
    if (group.variants.includes(bare)) {
      return group.canonical;
    }
  }
  return sanitized;
}

/**
 * Expande um rótulo de filtro de acessório para todas as variações equivalentes
 * que podem estar gravadas no banco (com ou sem prefixo de grupo da legenda).
 */
export function accessoryFilterVariants(label: string): string[] {
  const sanitized = sanitizeAccessory(label, 100);
  if (!sanitized) return [];
  const bare = stripGroupPrefix(sanitized);
  const bareKey = bare.toLocaleLowerCase("pt-BR");
  const prefixes = ["", "Conforto: ", "Segurança: ", "Outros opcionais: "];
  const matchedGroup = ACCESSORY_CANONICAL_GROUPS.find(
    (group) =>
      group.canonical.toLocaleLowerCase("pt-BR") === bareKey ||
      group.variants.includes(bareKey),
  );

  const baseForms = new Set<string>([sanitized, bare]);
  if (matchedGroup) {
    baseForms.add(matchedGroup.canonical);
    for (const variant of matchedGroup.variants) {
      baseForms.add(variant);
      baseForms.add(variant.charAt(0).toUpperCase() + variant.slice(1));
    }
    if (matchedGroup.canonical === "6 airbags") {
      baseForms.add("6 Air Bags");
      baseForms.add("6 airbags (frontais, laterais e de cortina)");
    } else if (matchedGroup.canonical === "4 airbags") {
      baseForms.add("4 Air Bags");
      baseForms.add("4 airbags (frontais e laterais)");
    } else if (matchedGroup.canonical === "Airbag duplo") {
      baseForms.add("Airbags frontais duplos");
      baseForms.add("Airbag duplo frontal");
    } else if (matchedGroup.canonical === "Alarme") {
      baseForms.add("Alarme antifurto");
      baseForms.add("Alarme perimétrico");
      baseForms.add("Alarme antifurto perimétrico");
    } else if (matchedGroup.canonical === "Piloto automático") {
      baseForms.add("Piloto automático (cruise control)");
      baseForms.add("Cruise control");
    } else if (matchedGroup.canonical === "Sensor de pressão dos pneus (TPMS)") {
      baseForms.add("Monitoramento de pressão dos pneus (TPMS)");
      baseForms.add("Monitoramento de pressão dos pneus");
      baseForms.add("Alerta de pressão dos pneus (iTPMS)");
      baseForms.add("iTPMS");
      baseForms.add("TPMS");
    } else if (matchedGroup.canonical === "Apple CarPlay / Android Auto") {
      baseForms.add("Apple CarPlay e Android Auto");
      baseForms.add("Espelhamento de celular (Apple CarPlay e Android Auto)");
    }
  }

  const expanded = new Set<string>();
  for (const form of baseForms) {
    const clean = stripGroupPrefix(form);
    for (const prefix of prefixes) {
      expanded.add(`${prefix}${clean}`);
    }
    expanded.add(form);
  }
  return Array.from(expanded);
}
