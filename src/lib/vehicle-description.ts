/**
 * Quebra a descrição do anúncio em blocos para a ficha.
 * Não inventa campo: só usa as quebras de linha que já estão no texto.
 */

export type DescriptionFact = {
  emoji: string;
  text: string;
};

export type DescriptionSegment =
  | { kind: "prose"; text: string }
  | { kind: "facts"; lines: DescriptionFact[] };

export type DescriptionSummaryFacts = {
  price: number;
  km: number;
  year: number;
  yearModel: number;
};

/** Omite somente fatos rotulados idênticos ao resumo; preserva prosa e ressalvas. */
export function withoutRepeatedDescriptionFacts(
  segments: DescriptionSegment[],
  summary?: DescriptionSummaryFacts,
): DescriptionSegment[] {
  if (!summary) return segments;
  const known = summary;
  function repeated(text: string) {
    const price = text.match(/^(?:valor|preço)\s*:\s*R\s*\$\s*(\d+(?:\.\d{3})*(?:,\d{2})?)\s*$/i);
    if (price) return Number(price[1].replaceAll(".", "").replace(",", ".")) === known.price;
    const km = text.match(/^(?:quilometragem|km)\s*:\s*(\d+(?:\.\d{3})*)\s*km\s*$/i);
    if (km) return Number(km[1].replaceAll(".", "")) === known.km;
    const year = text.match(/^ano\s*:\s*(\d{4})(?:\s*\/\s*(\d{4}))?\s*$/i);
    if (year) return year[2]
      ? Number(year[1]) === known.year && Number(year[2]) === known.yearModel
      : Number(year[1]) === known.yearModel;
    return false;
  }
  return segments.flatMap<DescriptionSegment>((segment) => {
    if (segment.kind === "prose") return [segment];
    const lines = segment.lines.filter((line) => !repeated(line.text));
    return lines.length ? [{ kind: "facts" as const, lines }] : [];
  });
}

const FACT_LINE =
  /^(\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)\s+(\S[\s\S]*)$/u;

export function splitFactLine(line: string): DescriptionFact | null {
  const match = line.trim().match(FACT_LINE);
  if (!match?.[1] || !match[2]) return null;
  return { emoji: match[1], text: match[2].trim() };
}

export function parseVehicleDescription(raw: string): DescriptionSegment[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const segments: DescriptionSegment[] = [];

  function pushFact(fact: DescriptionFact) {
    const last = segments[segments.length - 1];
    if (last?.kind === "facts") {
      last.lines.push(fact);
      return;
    }
    segments.push({ kind: "facts", lines: [fact] });
  }

  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const facts = lines.map(splitFactLine);
    if (lines.length > 0 && facts.every((fact) => fact)) {
      for (const fact of facts) {
        if (fact) pushFact(fact);
      }
      continue;
    }
    segments.push({ kind: "prose", text: paragraph });
  }

  return segments;
}
