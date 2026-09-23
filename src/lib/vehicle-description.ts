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
