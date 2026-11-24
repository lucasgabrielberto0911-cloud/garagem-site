const SOLD_PRICE_LINE = /(?:R\s*\$|\bBRL\b|\b(?:pre[cç]o|valor)\s*[:–—-]\s*\d)/i;
const PUBLIC_PLATE_LINE = /\b(?:final\s+(?:d[aeo]\s+)?placa|placa\s+final|placa)\b|\b[A-Z]{3}[-\s]?(?:\d{4}|\d[A-Z]\d{2})\b/i;

/** Na ficha pública, omite linhas de placa (e preço quando vendido) sem alterar a descrição cadastrada. */
export function publicVehicleDescription(text: string | null, sold: boolean): string | null {
  if (!text) return text;
  const clean = text
    .split(/\r?\n/)
    .filter((line) => !PUBLIC_PLATE_LINE.test(line) && (!sold || !SOLD_PRICE_LINE.test(line)))
    .join("\n")
    .trim();
  return clean || null;
}
