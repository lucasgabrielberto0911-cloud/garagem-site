/**
 * Opções prontas de acessórios/itens do veículo (estilo LM Veículos).
 * No admin o usuário marca as desejadas e ainda pode escrever pontos manuais.
 */
export const VEHICLE_ACCESSORY_PRESETS = [
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

export type VehicleAccessoryPreset =
  (typeof VEHICLE_ACCESSORY_PRESETS)[number];

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
