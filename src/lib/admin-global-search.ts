import type { Prisma } from "@prisma/client";

export const SEARCH_LIMIT = 5;
export function normalizeAdminSearch(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
}
function literal(value: string) {
  return { contains: value.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const };
}
export function vehicleGlobalWhere(query: string): Prisma.VehicleWhereInput {
  return { AND: query.split(" ").map((word) => ({ OR: [
    { brand: literal(word) }, { model: literal(word) }, { version: literal(word) },
    ...(word.replace(/[^a-z0-9]/gi, "") ? [{ plate: literal(word.replace(/[^a-z0-9]/gi, "")) }] : []),
  ] })) };
}
export function customerGlobalWhere(query: string): Prisma.CustomerWhereInput {
  return { AND: query.split(" ").map((word) => ({ OR: [
    { name: literal(word) }, { email: literal(word) },
    ...(/^[\d().+ -]+$/.test(word) && word.replace(/\D/g, "") ? [{ phone: literal(word.replace(/\D/g, "")) }] : []),
  ] })) };
}
export function leadGlobalWhere(query: string): Prisma.LeadVendaWhereInput {
  return { AND: query.split(" ").map((word) => ({ OR: [
    { name: literal(word) }, { vehicleInfo: literal(word) },
    ...(word.replace(/[^a-z0-9]/gi, "") ? [{ plate: literal(word.replace(/[^a-z0-9]/gi, "")) }] : []),
    ...(/^[\d().+ -]+$/.test(word) && word.replace(/\D/g, "") ? [{ phone: literal(word.replace(/\D/g, "")) }] : []),
  ] })) };
}
export type AdminSearchGroup = {
  kind: "veiculos" | "vendas" | "clientes" | "contatos";
  label: string;
  more: boolean;
  href: string;
  items: { id: string; title: string; detail: string; href: string }[];
};
export type AdminSearchResult = { query: string; groups: AdminSearchGroup[] };
