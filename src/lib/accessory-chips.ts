/**
 * Itens e acessórios da ficha em chips: escolhe o ícone pelo nome do item
 * e calcula o span do último chip para não sobrar card sozinho na linha.
 */

export type AccessoryIconKey =
  | "screen"
  | "phone"
  | "speaker"
  | "gps"
  | "bluetooth"
  | "usb"
  | "plug"
  | "snow"
  | "rain"
  | "twilight"
  | "sunroof"
  | "camera"
  | "sensor"
  | "mirror"
  | "fog"
  | "light"
  | "window"
  | "windshield"
  | "hill"
  | "key"
  | "alarm"
  | "lock"
  | "isofix"
  | "airbag"
  | "cruise"
  | "stability"
  | "brake"
  | "steering"
  | "handlebar"
  | "leather"
  | "seat"
  | "wheel"
  | "tire"
  | "dash"
  | "bag"
  | "spring"
  | "engine"
  | "shield"
  | "swap"
  | "card"
  | "check";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Ordem importa: a primeira regra que casar vence. Regras específicas vêm
 * antes das genéricas ("central multimídia com CarPlay" é tela, não celular;
 * "bancos de couro" é couro, não banco). O `check` só sai quando nenhuma casa.
 */
const ICON_RULES: ReadonlyArray<readonly [RegExp, AccessoryIconKey]> = [
  [/bluetooth/, "bluetooth"],
  [/multimidia|media\s*nav|\btela\b|display|touch/, "screen"],
  [/carplay|android auto|espelhamento|mirrorlink|smartphone|celular/, "phone"],
  [/\bgps\b|navegad|navegacao/, "gps"],
  [/\bsom\b|\bradio\b|alto[- ]?falante|subwoofer|amplificador/, "speaker"],
  [/\busb\b/, "usb"],
  [/tomada|carregador|inducao/, "plug"],
  [/ar[- ]condicionado|\bar digital|climatiz|ar quente|ventilad/, "snow"],
  [/chuva|limpador|lavador/, "rain"],
  [/crepuscular|farol automatico|luz automatica/, "twilight"],
  [/teto|sunroof|quebra-sol/, "sunroof"],
  [/camera/, "camera"],
  [/tpms|pressao/, "tire"],
  [/sensor/, "sensor"],
  [/^vidros?\b/, "window"],
  [/retrovisor|espelho/, "mirror"],
  [/neblina|milha/, "fog"],
  [/farol|\bled\b|\bdrl\b|lanterna|luz diurna|xenon|lampada/, "light"],
  [/vidro/, "window"],
  [/para-?brisa|bolha/, "windshield"],
  [/rampa|\bhill\b/, "hill"],
  [/keyless|chave|partida/, "key"],
  [/alarme/, "alarm"],
  [/trava|imobilizador/, "lock"],
  [/isofix|latch|cadeirinha/, "isofix"],
  [/air\s*bags?/, "airbag"],
  [/piloto automatico|cruise|controle de velocidade|limitador de velocidade/, "cruise"],
  [/estabilidade|controle de tracao|\btcs\b|\besp\b/, "stability"],
  [/\babs\b|\bebd\b|freio|disco|frenagem/, "brake"],
  [/direcao|volante|paddle|borboleta/, "steering"],
  [/guidao|manete|empunhadura|punho/, "handlebar"],
  [/couro/, "leather"],
  [/banco|encosto|apoio de (cabeca|braco)/, "seat"],
  [/roda|\baro\b|liga leve/, "wheel"],
  [/pneu|estepe/, "tire"],
  [/painel|instrumentos|\btft\b|computador|relogio|conta-giros|velocimetro|hodometro/, "dash"],
  [/bauleto|bolsa|porta-?malas|bagageiro|\brack\b|maleta|alforje/, "bag"],
  [/amortecedor|suspensao|\bmola/, "spring"],
  [/motor|injecao|escape|turbo|cavalete|cambio|transmissao|tracao|4x4|\bawd\b/, "engine"],
  [/assistente|alerta|monitoramento|ponto cego|faixa|protetor|protecao|estribo|garantia|blindag|antifurto/, "shield"],
  [/troca|aceitamos/, "swap"],
  [/financ|cartao|\b\d+x\b/, "card"],
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
