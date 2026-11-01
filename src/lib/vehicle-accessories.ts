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
  text = text.replace(/\bcombustíve\b/gi, "combustível");
  text = text.replace(/\bGPS integ\b/gi, "GPS integrado");

  // Normalização de opcionais equivalentes / grafias
  text = text.replace(/\b6\s*air\s*bags\b/gi, "6 airbags");
  text = text.replace(/(^|:\s*)airbags?\s*fronta(?:l|is)\s*duplos?(?=\s*$)/gi, "$1Airbags frontais");
  text = text.replace(/(^|:\s*)airbag\s*duplo(?:\s*fronta(?:l|is))?(?=\s*$)/gi, "$1Airbags frontais");
  text = text.replace(/\balarme\s*perimétrico\b/gi, "Alarme antifurto");
  text = text.replace(/(^|:\s*)alarme(?=\s*$)/gi, "$1Alarme antifurto");
  text = text.replace(/(?<!Monitoramento de pressão dos pneus \()\b(?:iTPMS|TPMS)\b/g, "Monitoramento de pressão dos pneus (TPMS)");

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

/** Mapeia um opcional (sanitizado ou cru) para todas as grafias brutas correspondentes no banco. */
export function accessoryFilterVariants(name: string): string[] {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return [];

  // Remove prefixo de grupo se presente para achar a base
  const groupPrefixMatch = trimmed.match(/^(?:Conforto|Segurança|Facilidades|Outros opcionais):\s*/i);
  const prefix = groupPrefixMatch ? groupPrefixMatch[0] : "";
  const base = prefix ? trimmed.slice(prefix.length).trim() : trimmed;
  const baseLower = base.toLowerCase();

  const variantBases = new Set<string>([base]);

  if (/^6\s*air\s*bags?$/i.test(baseLower)) {
    variantBases.add("6 airbags");
    variantBases.add("6 Air Bags");
    variantBases.add("6 air bags");
    variantBases.add("6 Airbags");
  } else if (/^(?:airbag\s*duplo(?:\s*fronta(?:l|is))?|airbags?\s*fronta(?:l|is)\s*duplos?|airbags?\s*frontais)$/i.test(baseLower)) {
    variantBases.add("Airbags frontais");
    variantBases.add("Airbag duplo");
    variantBases.add("Airbags frontais duplos");
    variantBases.add("Airbag duplo frontal");
    variantBases.add("Airbag frontal duplo");
  } else if (/^(?:alarme\s*antifurto|alarme\s*perimétrico|alarme)$/i.test(baseLower)) {
    variantBases.add("Alarme antifurto");
    variantBases.add("Alarme perimétrico");
    variantBases.add("Alarme");
  } else if (/^(?:monitoramento de pressão dos pneus \(tpms\)|itpms|tpms)$/i.test(baseLower)) {
    variantBases.add("Monitoramento de pressão dos pneus (TPMS)");
    variantBases.add("iTPMS");
    variantBases.add("TPMS");
  } else if (/^(?:gps integrado|gps integ)$/i.test(baseLower)) {
    variantBases.add("GPS integrado");
    variantBases.add("GPS integ");
  }

  // Gera variantes com e sem prefixos de grupos conhecidos
  const results = new Set<string>();
  for (const v of variantBases) {
    results.add(v);
    results.add(`Segurança: ${v}`);
    results.add(`Conforto: ${v}`);
    results.add(`Outros opcionais: ${v}`);
  }
  results.add(trimmed);

  return Array.from(results);
}
