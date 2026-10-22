import {
  getAccessoryPresets,
  normalizeAccessories,
  type VehicleCategory,
} from "./vehicle-accessories";

export type LegendParseResult = {
  matched: string[];
  unmatched: string[];
  fullText: string;
};

export const LEGEND_SYNONYMS: Record<string, string[]> = {
  "Multimídia": ["central", "central multimídia"],
  "Ar-condicionado": ["ar condicionado gelado", "ar gelado"],
  "Ar digital": ["ar condicionado digital"],
  "Direção hidráulica": ["dir hidráulica"],
  "Direção elétrica": ["dir elétrica", "direção eletr"],
  "Vidros elétricos": ["vidro elétrico"],
  "Travas elétricas": ["trava elétrica", "trava elétrico", "travas elétrico"],
  "Sensor de estacionamento": ["sensor de ré", "sensor ré"],
  "Câmera de ré": ["cam de ré", "câmera ré"],
  "Bancos de couro": ["couro", "banco de couro"],
  "Airbag duplo": ["airbag", "airbags"],
  "Piloto automático": ["cruise", "cruise control"],
  "Rodas de liga leve": ["liga leve", "rodas de liga"],
  "Teto solar": ["teto panorâmico", "panorâmico"],
  "Faróis de LED": ["farol de led", "led"],
  "Apple CarPlay / Android Auto": ["carplay", "apple carplay", "android auto"],
  "Keyless (partida por botão)": ["keyless", "partida botão", "partida por botão"],
  "Farol de LED": ["led", "faróis de led"],
  "Rodas de liga": ["liga leve", "rodas de liga leve"],
};

const fold = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function tokens(text: string) {
  return Array.from(text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu), (match) => ({
    value: fold(match[0]),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export function parseLegend(text: string, category: VehicleCategory): LegendParseResult {
  const source = text.replace(/(?:https?:\/\/|www\.)[^\s]+/gi, " ");
  const words = tokens(source);
  const used = new Set<number>();
  const matched: string[] = [];
  const remaining = source.split("");
  const candidates = getAccessoryPresets(category).flatMap((preset) =>
    [preset, ...(LEGEND_SYNONYMS[preset] ?? [])].map((alias) => ({
      preset,
      words: tokens(alias).map((word) => word.value),
      length: fold(alias).length,
    })),
  ).sort((a, b) => b.words.length - a.words.length || b.length - a.length);

  for (const candidate of candidates) {
    for (let i = 0; i <= words.length - candidate.words.length; i++) {
      if (!candidate.words.every((word, offset) =>
        !used.has(i + offset) && words[i + offset].value === word &&
        (offset === 0 || /^[\s()/–—-]*$/.test(
          source.slice(words[i + offset - 1].end, words[i + offset].start),
        )),
      )) continue;
      if (!matched.includes(candidate.preset)) matched.push(candidate.preset);
      candidate.words.forEach((_, offset) => used.add(i + offset));
      remaining.fill(" ", words[i].start, words[i + candidate.words.length - 1].end);
    }
  }

  const seen = new Set<string>();
  const unmatched = normalizeAccessories(remaining.join("")
    .split(/[\n\r,;•/–—-]+/)
    .map((fragment) => fragment.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((fragment) => {
      const key = fold(fragment).replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })).slice(0, 60 - matched.length);

  return { matched, unmatched, fullText: text };
}
