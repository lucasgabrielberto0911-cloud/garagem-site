import type { Prisma } from "@prisma/client";

/** Mesma base usada pelo lucro: custos extras zerados não são uma pendência. */
export const MISSING_SALE_COST_WHERE = {
  vehicle: {
    consigned: false,
    OR: [{ purchasePrice: null }, { purchasePrice: { lte: 0 } }],
  },
} satisfies Prisma.SaleWhereInput;

export const COST_WARNINGS_PAGE_SIZE = 10;
export function costWarningsPage(raw?: string | null) {
  const number = Number(raw);
  return Number.isFinite(number) ? Math.max(1, Math.trunc(number)) : 1;
}

export type CostWarningItem = {
  id: string;
  vehicle: { id: string; brand: string; model: string; yearModel: number; plate: string | null };
};
export type CostWarningsResult = {
  items: CostWarningItem[];
  total: number;
  page: number;
  pages: number;
};
