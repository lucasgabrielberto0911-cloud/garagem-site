/**
 * Consulta de veículo pela placa (uso exclusivo do admin).
 *
 * A API pública Parallelum/FIPE não busca por placa. Usamos a WDAPI
 * (apiplacas / wdapi2) quando `PLACA_API_TOKEN` estiver configurado.
 * Uma placa pode retornar várias versões FIPE — o lojista escolhe.
 */

import {
  fipeVehicleTypeFromCategory,
  parseFipePrice,
  resolveFipeDetailByCode,
  type FipeVehicleType,
} from "@/lib/fipe";
import { normalizePlate } from "@/lib/format";

export type PlateFipeVersion = {
  id: string;
  codeFipe: string;
  brand: string;
  model: string;
  modelYear: number | null;
  fuel: string | null;
  price: number | null;
  priceLabel: string | null;
  score: number | null;
  referenceMonth: string | null;
};

export type PlateLookupResult = {
  plate: string;
  brand: string | null;
  model: string | null;
  version: string | null;
  year: number | null;
  yearModel: number | null;
  color: string | null;
  fuel: string | null;
  versions: PlateFipeVersion[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return null;
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickString(
  record: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

function pickNumber(
  record: Record<string, unknown> | null,
  keys: string[],
): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function parseYearPair(raw: string | null): {
  year: number | null;
  yearModel: number | null;
} {
  if (!raw) return { year: null, yearModel: null };
  const parts = raw.split(/[\/\-]/).map((part) => Number(part.replace(/\D/g, "")));
  const year = Number.isFinite(parts[0]) ? parts[0] : null;
  const yearModel = Number.isFinite(parts[1]) ? parts[1] : year;
  return { year, yearModel };
}

function collectFipeArrays(payload: Record<string, unknown>): unknown[] {
  const bags: unknown[] = [];
  for (const key of ["fipe", "fipes", "FIPE", "Fipes", "lista_fipe"]) {
    const value = payload[key];
    if (Array.isArray(value)) bags.push(...value);
  }
  const extra = asRecord(payload.extra);
  if (extra) {
    for (const key of ["fipe", "fipes", "FIPE"]) {
      const value = extra[key];
      if (Array.isArray(value)) bags.push(...value);
    }
  }
  return bags;
}

function normalizeFipeItem(
  item: unknown,
  index: number,
  fallbackBrand: string | null,
  fallbackYear: number | null,
): PlateFipeVersion | null {
  const record = asRecord(item);
  if (!record) return null;

  const codeFipe =
    pickString(record, [
      "codigo_fipe",
      "codigoFipe",
      "codeFipe",
      "codigo",
      "code",
      "fipe",
    ]) ?? "";
  const model =
    pickString(record, [
      "texto_modelo",
      "modelo",
      "model",
      "marca_modelo",
      "modelo_versao",
      "texto",
    ]) ?? "";
  const brand =
    pickString(record, ["texto_marca", "marca", "brand"]) ?? fallbackBrand ?? "";

  if (!codeFipe && !model) return null;

  const modelYear =
    pickNumber(record, ["ano_modelo", "anoModelo", "modelYear", "ano"]) ??
    fallbackYear;

  const rawPrice =
    pickString(record, ["texto_valor", "valor", "price", "preco"]) ??
    (typeof record.valor === "number" ? String(record.valor) : null);
  const price =
    parseFipePrice(rawPrice ?? undefined) ??
    (typeof record.valor === "number" && record.valor > 0 ? record.valor : null);

  const score =
    pickNumber(record, ["score", "similaridade", "correspondencia"]) ?? null;

  return {
    id: `${codeFipe || "sem-codigo"}-${index}`,
    codeFipe: codeFipe || `versão-${index + 1}`,
    brand,
    model: model || codeFipe,
    modelYear,
    fuel: pickString(record, ["combustivel", "fuel", "Combustivel"]),
    price,
    priceLabel: rawPrice,
    score,
    referenceMonth: pickString(record, [
      "mes_referencia",
      "referenceMonth",
      "referencia",
    ]),
  };
}

async function enrichVersionsWithParallelum(
  versions: PlateFipeVersion[],
  vehicleType: FipeVehicleType,
): Promise<PlateFipeVersion[]> {
  const enriched: PlateFipeVersion[] = [];
  for (const version of versions.slice(0, 10)) {
    if (!version.codeFipe || version.codeFipe.startsWith("versão-")) {
      enriched.push(version);
      continue;
    }
    try {
      const detail = await resolveFipeDetailByCode(
        vehicleType,
        version.codeFipe,
        version.modelYear,
      );
      if (!detail) {
        enriched.push(version);
        continue;
      }
      const price = parseFipePrice(detail.price) ?? version.price;
      enriched.push({
        ...version,
        brand: detail.brand || version.brand,
        model: detail.model || version.model,
        modelYear: detail.modelYear || version.modelYear,
        fuel: detail.fuel || version.fuel,
        price,
        priceLabel: detail.price || version.priceLabel,
        referenceMonth: detail.referenceMonth || version.referenceMonth,
        codeFipe: detail.codeFipe || version.codeFipe,
      });
    } catch {
      enriched.push(version);
    }
  }
  return enriched;
}

function mapFuelHint(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.toLocaleLowerCase("pt-BR");
  if (value.includes("diesel")) return "Diesel";
  if (value.includes("híbrid") || value.includes("hibrid")) return "Híbrido";
  if (value.includes("elétr") || value.includes("eletr")) return "Elétrico";
  if (value.includes("álcool") || value.includes("alcool") || value.includes("etanol")) {
    if (value.includes("gasolina") || value.includes("flex")) return "Flex";
    return "Etanol";
  }
  if (value.includes("flex") || (value.includes("gasolina") && value.includes("álcool"))) {
    return "Flex";
  }
  if (value.includes("gasolina")) return "Gasolina";
  return null;
}

/**
 * Consulta WDAPI2. Exige `PLACA_API_TOKEN` no ambiente (Vercel / .env).
 */
export async function lookupVehicleByPlate(
  rawPlate: string,
  category: string | null | undefined,
): Promise<PlateLookupResult> {
  const plate = normalizePlate(rawPlate);
  if (plate.length < 7) {
    throw new Error("Informe uma placa válida (ABC1D23 ou ABC1234).");
  }

  const token = process.env.PLACA_API_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "Configure PLACA_API_TOKEN no Vercel (.env) para consultar por placa. Enquanto isso, use a busca FIPE por marca/modelo/ano ou preencha manualmente.",
    );
  }

  const base =
    process.env.PLACA_API_BASE?.trim().replace(/\/$/, "") ||
    "https://wdapi2.com.br/consulta";
  const url = `${base}/${encodeURIComponent(plate)}/${encodeURIComponent(token)}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payloadUnknown: unknown = await response.json().catch(() => null);
  const payload = asRecord(payloadUnknown);

  if (!response.ok) {
    const message =
      pickString(payload, ["message", "erro", "error", "msg"]) ||
      `Consulta por placa falhou (${response.status}).`;
    throw new Error(message);
  }

  if (!payload) {
    throw new Error("Resposta inválida da consulta por placa.");
  }

  const errorMessage = pickString(payload, ["erro", "error", "message"]);
  if (
    errorMessage &&
    /não encontrado|nao encontrado|inválid|invalid|não localiz/i.test(
      errorMessage,
    )
  ) {
    throw new Error(errorMessage);
  }

  const brand =
    pickString(payload, ["MARCA", "marca", "brand", "Marca"]) ??
    pickString(asRecord(payload.extra), ["marca", "MARCA"]);
  const modelRaw =
    pickString(payload, ["MODELO", "modelo", "model", "Modelo", "marcaModelo"]) ??
    pickString(asRecord(payload.extra), ["modelo", "MODELO"]);
  const color =
    pickString(payload, ["cor", "COR", "color", "Cor"]) ??
    pickString(asRecord(payload.extra), ["cor", "COR"]);

  const yearFabricacao =
    pickNumber(payload, ["ano", "anoFabricacao", "ano_fabricacao"]) ??
    pickNumber(asRecord(payload.extra), ["ano", "ano_fabricacao"]);
  const yearModelo =
    pickNumber(payload, ["anoModelo", "ano_modelo", "anoModelo"]) ??
    pickNumber(asRecord(payload.extra), ["ano_modelo", "anoModelo"]);

  const anoTexto = pickString(payload, ["ano", "anoModelo"]);
  const fromPair = parseYearPair(anoTexto);
  const year = yearFabricacao ?? fromPair.year;
  const yearModel = yearModelo ?? fromPair.yearModel ?? year;

  const fuelRaw =
    pickString(payload, ["combustivel", "combustível", "fuel"]) ??
    pickString(asRecord(payload.extra), ["combustivel", "combustível"]);

  const versionsRaw = collectFipeArrays(payload)
    .map((item, index) =>
      normalizeFipeItem(item, index, brand, yearModel ?? year),
    )
    .filter((item): item is PlateFipeVersion => Boolean(item));

  // Dedup por código FIPE
  const seen = new Set<string>();
  const uniqueVersions = versionsRaw.filter((item) => {
    const key = item.codeFipe.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Ordena pelo score (maior primeiro) quando disponível
  uniqueVersions.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const vehicleType = fipeVehicleTypeFromCategory(category);
  const versions = await enrichVersionsWithParallelum(
    uniqueVersions,
    vehicleType,
  );

  return {
    plate,
    brand,
    model: modelRaw,
    version: modelRaw,
    year,
    yearModel,
    color,
    fuel: mapFuelHint(fuelRaw),
    versions,
  };
}

/** Último dígito da placa para o campo público "final da placa". */
export function plateEndFromPlate(plate: string): string | null {
  const normalized = normalizePlate(plate);
  if (!normalized) return null;
  const last = normalized.slice(-1);
  return /\d/.test(last) ? last : null;
}
