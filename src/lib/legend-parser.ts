import {
  getAccessoryPresets,
  filterAccessoriesForCategory,
  normalizeAccessories,
  type VehicleCategory,
} from "./vehicle-accessories";

export type LegendParseResult = {
  matched: string[];
  unmatched: string[];
  fullText: string;
  description: string;
};

export const LEGEND_SYNONYMS: Record<string, string[]> = {
  "Multimídia": ["central multimídia"],
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
  "Rodas de liga leve": ["liga leve"],
  "Teto solar": ["teto panorâmico", "panorâmico"],
  "Faróis de LED": ["led"],
  "Apple CarPlay / Android Auto": ["carplay", "apple carplay", "android auto"],
  "Keyless (partida por botão)": ["keyless", "partida botão", "partida por botão"],
  "Farol de LED": ["led"],
  "LED diurno (DRL)": ["led diurno"],
  "Rodas de liga": ["liga leve"],
};

export const fold = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function tokens(text: string) {
  return Array.from(text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu), (match) => ({
    value: fold(match[0]),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export function parseLegend(text: string, category: VehicleCategory): LegendParseResult {
  const source = text
    .replace(/(?:https?:\/\/|www\.)[^\s]+/gi, " ")
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200D\uFE0F\u20E3]/gu, "")
    .split(/\r?\n|\r/)
    .map((line) => line.trim())
    .filter((line) => !/^[\s\p{P}]*(?:sua\s+)?garagem[\s\p{P}]*$/iu.test(line))
    .map((line) => line.replace(/\bsua\s+garagem\b/giu, "Garagem").replace(/^[\s•–—-]+/, "").trim())
    .filter(Boolean)
    .join("\n");
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
      remaining.fill("\0", words[i].start, words[i + candidate.words.length - 1].end);
    }
  }

  const seen = new Set<string>();
  const allowed = new Set(getAccessoryPresets(category).map(fold));
  const otherCategory = new Set(getAccessoryPresets(category === "moto" ? "carro" : "moto").map(fold));
  const unmatched = normalizeAccessories(remaining.join("")
    .replace(/[ \t]*(?:\be[ \t]+)?\0+(?:[ \t]+e\b)?[ \t]*/gi, " ")
    .split(/[\n\r,;•]+|\s+[\/–—-]\s+|\s+e\s+/i)
    .map((fragment) => fragment.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((fragment) => {
      const key = fold(fragment).replace(/\s+/g, " ").trim();
      if ((key.match(/\p{L}/gu)?.length ?? 0) < 3 || seen.has(key)) return false;
      if (otherCategory.has(key) && !allowed.has(key)) return false;
      seen.add(key);
      return true;
    })).slice(0, Math.max(0, 60 - matched.length));

  return { matched, unmatched, fullText: text, description: source };
}

/** Preserva os existentes; recusa acréscimos que ultrapassem o limite. */
export function mergeLegendAccessories(
  existing: string[],
  additions: string[],
  category: VehicleCategory,
  manual: string[] = [],
): string[] | null {
  const seen = new Set(existing.map((item) => fold(item).replace(/\s+/g, " ").trim()));
  const added = [...filterAccessoriesForCategory(additions, category), ...manual].flatMap((item) =>
    normalizeAccessories([item]),
  ).filter((item) => {
    const key = fold(item).replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (added.length && existing.length + added.length > 60) return null;
  return [...existing, ...added];
}
