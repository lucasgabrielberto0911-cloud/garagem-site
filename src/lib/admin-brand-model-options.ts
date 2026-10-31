import { unstable_cache } from "next/cache";
import { ADMIN_DATA_TAG } from "@/lib/admin-cache";
import { prisma } from "@/lib/prisma";

export type BrandModelOptions = { brands: string[]; models: string[] };

/** Junta valores repetidos ignorando caixa e espaços; mantém a grafia mais usada. */
export function uniqueOptions(values: string[]) {
  const seen = new Map<string, { label: string; count: number }>();
  for (const raw of values) {
    const label = raw.replace(/\s+/g, " ").trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase("pt-BR");
    const current = seen.get(key);
    if (current) current.count += 1;
    else seen.set(key, { label, count: 1 });
  }
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"))
    .map((item) => item.label);
}

/** Sugestões do formulário: marcas e modelos que já existem no estoque. Cache curto do admin. */
export const getAdminBrandModelOptions = unstable_cache(
  async (): Promise<BrandModelOptions> => {
    try {
      const rows = await prisma.vehicle.findMany({
        select: { brand: true, model: true },
        distinct: ["brand", "model"],
        take: 500,
      });
      return {
        brands: uniqueOptions(rows.map((row) => row.brand)),
        models: uniqueOptions(rows.map((row) => row.model)),
      };
    } catch {
      return { brands: [], models: [] };
    }
  },
  ["admin-brand-model-options-v1"],
  { revalidate: 300, tags: [ADMIN_DATA_TAG] },
);
