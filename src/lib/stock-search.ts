import type { Prisma } from "@prisma/client";
import { transmissionWhere } from "./vehicle-display";

export type SearchCatalogRow = { brand: string; model: string; version?: string | null };
const compact = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const compactY = (value: string) => compact(value).replace(/y/g, "i");
const isYear = (value: string) => /^(19|20)\d{2}$/.test(value);
const searchTokens = (query: string) => query.replace(/([A-Za-zÀ-ÿ])[-/]?((?:19|20)\d{2})(?=\s|$)/g, "$1 $2").trim().split(/\s+/).filter(Boolean);
const phonetic = (word: string) => word.replace(/y/g, "i").replace(/qu/g, "k").replace(/ck/g, "k").replace(/c(?=[eiy])/g, "s").replace(/c/g, "k").replace(/ke$/, "k");
const BRAND_ALIASES: Record<string, string> = { vw: "volkswagen", gm: "chevrolet", chevy: "chevrolet" };

function parsePriceAmount(rawNumber: string, unit?: string): number | null {
  const cleaned = rawNumber.replace(/\./g, "").replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (unit && /^(mil|k)$/i.test(unit)) {
    return Math.round(num * 1000);
  }
  return num < 1000 ? Math.round(num * 1000) : Math.round(num);
}

/**
 * Extrai intenções em linguagem natural ("automático até 60 mil", "moto",
 * "acima de 80 mil") em filtros estruturados sem afetar buscas por modelo/ano.
 */
export function extractNaturalStockClauses(query: string): {
  restQuery: string;
  clauses: Prisma.VehicleWhereInput[];
} {
  let rest = query;
  const clauses: Prisma.VehicleWhereInput[] = [];

  rest = rest.replace(
    /\b(?:at[eé]|abaixo\s+de|menos\s+de)\s*(?:r\$\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(mil|k)?\b/gi,
    (match, rawNum: string, unit?: string) => {
      // "até 1.0" / "até 1,6" sem "mil"/"k" é motorização, não preço.
      if (!unit && /^\d+[.,]\d{1,2}$/.test(rawNum)) return match;
      const amount = parsePriceAmount(rawNum, unit);
      if (amount && amount >= 5000) {
        clauses.push({ price: { lte: amount } });
        return " ";
      }
      return match;
    },
  );

  rest = rest.replace(
    /\b(?:acima\s+de|a\s+partir\s+de|mais\s+de)\s*(?:r\$\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(mil|k)?\b/gi,
    (match, rawNum: string, unit?: string) => {
      const amount = parsePriceAmount(rawNum, unit);
      if (amount && amount >= 5000) {
        clauses.push({ price: { gte: amount } });
        return " ";
      }
      return match;
    },
  );

  rest = rest.replace(
    /\b(?:c[aâ]mbio\s+)?autom[aá]tic[oa]s?\b/gi,
    () => {
      const gear = transmissionWhere("automatico");
      if (Object.keys(gear).length > 0) clauses.push(gear);
      return " ";
    },
  );

  rest = rest.replace(
    /\b(?:c[aâ]mbio\s+)?manua(?:l|is)\b/gi,
    () => {
      const gear = transmissionWhere("manual");
      if (Object.keys(gear).length > 0) clauses.push(gear);
      return " ";
    },
  );

  rest = rest.replace(/\bmotos?\b/gi, () => {
    clauses.push({ category: "moto" });
    return " ";
  });

  rest = rest.replace(/\bcarros?\b/gi, () => {
    clauses.push({ category: "carro" });
    return " ";
  });

  return { restQuery: rest.replace(/\s+/g, " ").trim(), clauses };
}

/** Expande apenas grafias equivalentes dos modelos que existem no estoque. */
export function stockSearchWhere(query: string, catalog: readonly SearchCatalogRow[]): Prisma.VehicleWhereInput[] {
  const { restQuery, clauses: naturalClauses } = extractNaturalStockClauses(query);
  const tokens = searchTokens(restQuery);
  const clauses: Prisma.VehicleWhereInput[] = [];
  for (let index = 0; index < tokens.length;) {
    const token = tokens[index];
    const yearPair = /^((?:19|20)\d{2})[/-]((?:19|20)\d{2})$/.exec(token);
    if (yearPair) {
      clauses.push({ AND: [{ year: Number(yearPair[1]) }, { yearModel: Number(yearPair[2]) }] });
      index++;
      continue;
    }
    if (isYear(token)) {
      const year = Number(token);
      clauses.push({ OR: [{ year }, { yearModel: year }] });
      index++;
      continue;
    }
    let count = 1;
    // "HR V" e "CG 160 Start" podem estar guardados com outra separação.
    for (let size = Math.min(3, tokens.length - index); size > 1; size--) {
      const parts = tokens.slice(index, index + size);
      if (parts.some(isYear)) continue;
      const folded = compact(parts.join(" "));
      const foldedY = compactY(parts.join(" "));
      if (folded.length >= 2 && catalog.some(row => compact(row.model).includes(folded) || (foldedY.length >= 3 && compactY(row.model).includes(foldedY)))) {
        count = size;
        break;
      }
    }
    const term = tokens.slice(index, index + count).join(" ");
    const folded = compact(term);
    const foldedY = compactY(term);
    const models = folded.length >= 2 ? [...new Set(catalog.filter(row => compact(row.model).includes(folded) || (foldedY.length >= 3 && compactY(row.model).includes(foldedY))).map(row => row.model))] : [];
    const brands = folded.length >= 2 ? [...new Set(catalog.filter(row => compact(row.brand).includes(folded) || (foldedY.length >= 3 && compactY(row.brand).includes(foldedY)) || compact(row.brand) === BRAND_ALIASES[folded]).map(row => row.brand))] : [];
    const versions = folded.length >= 2 ? [...new Set(catalog.filter(row => row.version && (compact(row.version).includes(folded) || (foldedY.length >= 3 && compactY(row.version).includes(foldedY)))).map(row => row.version!))] : [];
    // "hondacivic" / "honda-civic": equivalência de escrita, sem adivinhar outro carro.
    const joined = count === 1 ? catalog.filter(row => compact(`${row.brand}${row.model}`) === folded || (foldedY.length >= 4 && compactY(`${row.brand}${row.model}`) === foldedY)) : [];
    clauses.push({ OR: [
      { brand: { contains: term, mode: "insensitive" } },
      { model: { contains: term, mode: "insensitive" } },
      { version: { contains: term, mode: "insensitive" } },
      ...(models.length ? [{ model: { in: models, mode: "insensitive" as const } }] : []),
      ...(brands.length ? [{ brand: { in: brands, mode: "insensitive" as const } }] : []),
      ...(versions.length ? [{ version: { in: versions, mode: "insensitive" as const } }] : []),
      ...joined.map(row => ({ AND: [
        { brand: { equals: row.brand, mode: "insensitive" as const } },
        { model: { equals: row.model, mode: "insensitive" as const } },
      ] })),
    ] });
    index += count;
  }
  clauses.push(...naturalClauses);
  return clauses;
}

/** Distância de edição com transposição: "civci" está a uma troca de "civic". */
function editDistance(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
      rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

/** Sugere, nunca reescreve a consulta. Só vocabulário dos anúncios disponíveis. */
export function stockSearchSuggestions(query: string, catalog: readonly SearchCatalogRow[]): string[] {
  const tokens = searchTokens(query);
  if (!tokens.length || tokens.length > 12 || query.length > 120) return [];
  const vocabulary = [...new Set(catalog.flatMap(row => [
    row.brand, row.model, `${row.brand} ${row.model}`, row.version ?? "",
    ...`${row.brand} ${row.model} ${row.version ?? ""}`.split(/\s+/),
  ]).filter(Boolean))].map(text => ({ text, folded: compact(text) })).filter(word => word.folded.length >= 3);
  type Candidate = { words: string[]; cost: number; changed: boolean };
  const paths: Candidate[][] = Array.from({ length: tokens.length + 1 }, () => []);
  paths[0] = [{ words: [], cost: 0, changed: false }];
  for (let i = 0; i < tokens.length; i++) {
    const current = paths[i].sort((a, b) => a.cost - b.cost).slice(0, 12);
    for (const path of current) {
      paths[i + 1].push({ ...path, words: [...path.words, tokens[i]], cost: path.cost + 4 });
      for (let size = 1; size <= Math.min(4, tokens.length - i); size++) {
        const term = tokens.slice(i, i + size).join(" ");
        const folded = compact(term);
        if (folded.length < 3 || folded.length > 40) continue;
        for (const word of vocabulary) {
          const exact = folded === word.folded;
          // Ano, cilindrada e números de modelo não são corrigidos por aproximação.
          if (!exact && (/\d/.test(folded + word.folded) || Math.abs(folded.length - word.folded.length) > 3)) continue;
          const distance = exact ? 0 : editDistance(folded, word.folded);
          const sameSound = folded.length >= 4 && word.folded.length >= 4 && phonetic(folded) === phonetic(word.folded);
          const limit = folded.length <= 3 ? 1 : folded.length <= 8 ? 2 : 3;
          const similarityLimit = folded.length >= 4 && folded.slice(0, 2) === word.folded.slice(0, 2) ? 0.4 : 0.34;
          if (!sameSound && (distance > limit || distance / Math.max(folded.length, word.folded.length) > similarityLimit)) continue;
          paths[i + size].push({ words: [...path.words, exact ? term : word.text], cost: path.cost + (sameSound && !exact ? 1 : distance), changed: path.changed || !exact });
        }
      }
    }
    // Mantém o trabalho limitado mesmo com muitos modelos cadastrados.
    for (let end = i + 1; end <= Math.min(i + 4, tokens.length); end++) {
      paths[end] = paths[end].sort((a, b) => a.cost - b.cost).filter((item, index, all) => all.findIndex(other => other.words.join(" ").toLowerCase() === item.words.join(" ").toLowerCase()) === index).slice(0, 12);
    }
  }
  return [...new Set(paths[tokens.length].filter(path => path.changed).sort((a, b) => a.cost - b.cost).map(path => path.words.join(" ")))].slice(0, 3);
}
