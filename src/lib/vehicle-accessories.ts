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

/** Limpa, corta e remove duplicatas (case-insensitive), preservando a ordem. */
export function normalizeAccessories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = item.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!value) continue;
    const key = value.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result.slice(0, 60);
}
