import { parseMoneyBR } from "./admin-money";

export type FipeOption = { codigo: string; nome: string };
export type FipeQuery = {
  category: "carro" | "moto";
  brand?: string;
  model?: string;
  year?: string;
  exclude?: string;
};
export type FipeVehicle = {
  brand: string;
  model: string;
  version: string;
  yearModel: number;
  fuel: string;
  price: number;
  code: string;
  reference: string;
};
export type FipeQuote = {
  vehicle: FipeVehicle;
  stock: { count: number; min: number; max: number; average: number } | null;
};

export function parseFipeQuery(params: URLSearchParams): FipeQuery | null {
  if ([...params.keys()].some(key => !["category", "brand", "model", "year", "exclude"].includes(key))) return null;
  if ([...params.keys()].some(key => params.getAll(key).length !== 1)) return null;
  const category = params.get("category");
  const brand = params.get("brand") ?? undefined;
  const model = params.get("model") ?? undefined;
  const year = params.get("year") ?? undefined;
  const exclude = params.get("exclude") ?? undefined;
  if (category !== "carro" && category !== "moto") return null;
  if ((brand !== undefined && !/^\d{1,6}$/.test(brand)) || (model !== undefined && (!brand || !/^\d{1,6}$/.test(model)))) return null;
  if (year !== undefined && (!model || !/^(19|20)\d{2}-[1-9]$/.test(year))) return null;
  if (exclude !== undefined && !/^[a-zA-Z0-9-]{1,64}$/.test(exclude)) return null;
  return { category, brand, model, year, exclude };
}

export function fipePath(query: FipeQuery) {
  let path = `${query.category === "moto" ? "motos" : "carros"}/marcas`;
  if (query.brand) path += `/${query.brand}/modelos`;
  if (query.model) path += `/${query.model}/anos`;
  if (query.year) path += `/${query.year}`;
  return path;
}

export function parseFipeOptions(data: unknown): FipeOption[] {
  if (!Array.isArray(data)) throw new Error("Lista FIPE inválida.");
  return data.map(item => {
    if (!item || !["string", "number"].includes(typeof item.codigo) || typeof item.nome !== "string") throw new Error("Opção FIPE inválida.");
    return { codigo: String(item.codigo), nome: item.nome };
  }).filter(item => !item.codigo.startsWith("32000-"));
}

export function parseFipeVehicle(data: unknown): FipeVehicle {
  if (!data || typeof data !== "object") throw new Error("Resposta FIPE inválida.");
  const item = data as Record<string, unknown>;
  for (const field of ["Marca", "Modelo", "Combustivel", "CodigoFipe", "MesReferencia"]) {
    if (typeof item[field] !== "string" || !(item[field] as string).trim()) throw new Error("Dados FIPE incompletos.");
  }
  const price = parseMoneyBR(item.Valor);
  const year = item.AnoModelo;
  if (!price || price <= 0 || typeof year !== "number" || !Number.isInteger(year) || year < 1900 || year > 2099) throw new Error("Preço ou ano FIPE inválido.");
  const fullModel = (item.Modelo as string).trim();
  // A FIPE junta modelo e versão; se não houver motor explícito, preservamos o nome inteiro.
  const split = fullModel.search(/\s\d[.,]\d/);
  const brand = (item.Marca as string).trim();
  const aliases: Record<string, string> = { "VW - VolksWagen": "Volkswagen", "GM - Chevrolet": "Chevrolet" };
  return {
    brand: aliases[brand] ?? brand,
    model: split > 0 ? fullModel.slice(0, split) : fullModel,
    version: split > 0 ? fullModel.slice(split + 1) : "",
    yearModel: year,
    fuel: /flex|bi.?fuel|total.?flex/i.test(fullModel) ? "Flex" : item.Combustivel === "Álcool" ? "Etanol" : item.Combustivel as string,
    price,
    code: item.CodigoFipe as string,
    reference: (item.MesReferencia as string).trim(),
  };
}

export async function fetchFipe(query: FipeQuery, request: typeof fetch = fetch) {
  const response = await request(`https://parallelum.com.br/fipe/api/v1/${fipePath(query)}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(response.status === 429 ? "Limite da FIPE atingido. Tente mais tarde." : "FIPE indisponível. Tente novamente.");
  const data: unknown = await response.json();
  if (query.year) {
    const vehicle = parseFipeVehicle(data);
    if (vehicle.yearModel !== Number(query.year.split("-")[0])) throw new Error("Ano FIPE diferente do solicitado.");
    return vehicle;
  }
  return parseFipeOptions(query.brand && !query.model && data && typeof data === "object" ? (data as Record<string, unknown>).modelos : data);
}
