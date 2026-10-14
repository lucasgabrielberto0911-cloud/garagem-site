/**
 * Itens e acessórios da ficha em chips: escolhe o ícone pelo nome do item
 * e calcula o span do último chip para não sobrar card sozinho na linha.
 */

export type AccessoryIconKey =
  | "screen"
  | "bluetooth"
  | "snow"
  | "steering"
  | "window"
  | "lock"
  | "sensor"
  | "camera"
  | "seat"
  | "shield"
  | "gauge"
  | "wheel"
  | "sun"
  | "light"
  | "mirror"
  | "usb"
  | "key"
  | "rain"
  | "bag"
  | "engine"
  | "check";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Ordem importa: a primeira regra que casar vence. */
const ICON_RULES: ReadonlyArray<readonly [RegExp, AccessoryIconKey]> = [
  [/bluetooth/, "bluetooth"],
  [/carplay|android auto|multimidia|painel digital|\btft\b|computador|relogio/, "screen"],
  [/\busb\b/, "usb"],
  [/ar[- ]condicionado|ar digital|climatiz/, "snow"],
  [/chuva/, "rain"],
  [/crepuscular|teto solar/, "sun"],
  [/camera|\bre\b/, "camera"],
  [/sensor/, "sensor"],
  [/retrovisor/, "mirror"],
  [/farol|\bled\b|neblina|drl/, "light"],
  [/vidro/, "window"],
  [/keyless|partida/, "key"],
  [/trava|alarme|imobilizador/, "lock"],
  [/direcao|volante|guidao|manete|empunhadura/, "steering"],
  [/banco|couro/, "seat"],
  [/airbag|abs\b|estabilidade|freio|protetor de carenagem/, "shield"],
  [/piloto automatico|cruise/, "gauge"],
  [/roda|pneu/, "wheel"],
  [/bauleto|bolsa/, "bag"],
  [/motor|injecao|escape|amortecedor|suspensao|cavalete|para-brisa|bolha/, "engine"],
];

export function accessoryIconKey(item: string): AccessoryIconKey {
  const text = normalize(item);
  for (const [pattern, key] of ICON_RULES) {
    if (pattern.test(text)) return key;
  }
  return "check";
}

/**
 * Quantas colunas o chip `index` de `total` ocupa na grade de 2 colunas
 * (mobile/tablet) e na de 3 colunas (desktop). Só o último chip estica, para
 * fechar a linha sem esconder nem repetir item. As classes do Tailwind ficam
 * no componente (o Tailwind não varre `src/lib`).
 */
export function accessoryChipSpan(
  index: number,
  total: number,
): { base: 1 | 2; lg: 1 | 2 | 3 } {
  if (index !== total - 1) return { base: 1, lg: 1 };
  const rest = total % 3;
  return {
    base: total % 2 === 1 ? 2 : 1,
    lg: rest === 1 ? 3 : rest === 2 ? 2 : 1,
  };
}
