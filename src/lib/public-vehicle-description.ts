/** Na ficha vendida, omite linhas de preço sem alterar a descrição cadastrada. */
export function publicVehicleDescription(text: string | null, sold: boolean): string | null {
  if (!text || !sold) return text;
  const clean = text.split(/\r?\n/).filter(line => !/(?:R\s*\$|\bBRL\b|\b(?:pre[cç]o|valor)\s*[:–—-]\s*\d)/i.test(line)).join("\n").trim();
  return clean || null;
}
