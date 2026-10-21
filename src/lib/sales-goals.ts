/**
 * Regras de metas mensais e placar com comissões de vendas.
 * Totalmente testável e desacoplado de banco direto.
 */

export const DEFAULT_SALES_GOAL_UNITS = 10;
export const DEFAULT_SALES_GOAL_REVENUE = 500_000;
export const DEFAULT_COMMISSION_RATE = 1.5; // 1,5% sobre o valor da venda

export type SalesGoalConfig = {
  goalUnits: number;
  goalRevenue: number;
  defaultCommissionRate: number;
};

export type MonthlyGoalProgress = {
  goalUnits: number;
  goalRevenue: number;
  monthCount: number;
  monthRevenue: number;
  unitsPercent: number;
  revenuePercent: number;
  unitsRemaining: number;
  revenueRemaining: number;
  daysRemaining: number;
  paceNeededPerDay: number;
  isGoalReached: boolean;
};

export type SellerPerformance = {
  seller: string;
  count: number;
  revenue: number;
  commission: number;
};

export type SalesLeaderboard = {
  totalCommission: number;
  leaderboard: SellerPerformance[];
};

export type SaleRecordInput = {
  id: string;
  salePrice: number;
  sellerName?: string | null;
  commission?: number | null;
  notes?: string | null;
  saleDate?: Date | string;
};

export function getDaysRemainingInMonth(now = new Date()): number {
  const year = now.getFullYear();
  const month = now.getMonth();
  // Último dia do mês: dia 0 do mês seguinte
  const lastDay = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  return Math.max(0, lastDay - currentDay + 1);
}

export function computeMonthlySalesGoal(input: {
  now?: Date;
  salesCount: number;
  salesRevenue: number;
  goalUnits?: number | null;
  goalRevenue?: number | null;
}): MonthlyGoalProgress {
  const goalUnits =
    input.goalUnits && input.goalUnits > 0
      ? input.goalUnits
      : DEFAULT_SALES_GOAL_UNITS;
  const goalRevenue =
    input.goalRevenue && input.goalRevenue > 0
      ? input.goalRevenue
      : DEFAULT_SALES_GOAL_REVENUE;

  const monthCount = Math.max(0, input.salesCount);
  const monthRevenue = Math.max(0, input.salesRevenue);

  const unitsPercent = Math.min(
    100,
    Math.round((monthCount / goalUnits) * 100),
  );
  const revenuePercent = Math.min(
    100,
    Math.round((monthRevenue / goalRevenue) * 100),
  );

  const unitsRemaining = Math.max(0, goalUnits - monthCount);
  const revenueRemaining = Math.max(0, goalRevenue - monthRevenue);

  const daysRemaining = getDaysRemainingInMonth(input.now ?? new Date());
  const paceNeededPerDay =
    unitsRemaining > 0 && daysRemaining > 0
      ? Number((unitsRemaining / daysRemaining).toFixed(2))
      : 0;

  return {
    goalUnits,
    goalRevenue,
    monthCount,
    monthRevenue,
    unitsPercent,
    revenuePercent,
    unitsRemaining,
    revenueRemaining,
    daysRemaining,
    paceNeededPerDay,
    isGoalReached: monthCount >= goalUnits,
  };
}

const SELLER_NOTE_REGEX = /\[(?:vendedor:\s*([^\]|]+)(?:\|\s*comissao:\s*([^\]]+))?|comissao:\s*([^\]]+))\]/i;

export function extractSaleSeller(sale: {
  sellerName?: string | null;
  notes?: string | null;
}): string {
  if (sale.sellerName && sale.sellerName.trim()) {
    return sale.sellerName.trim();
  }
  if (sale.notes) {
    const match = sale.notes.match(SELLER_NOTE_REGEX);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return "Geral";
}

/** Só há comissão a mostrar quando a venda tem vendedor ou valor informado (sem o 1,5% "fantasma"). */
export function hasSaleCommission(sale: {
  commission?: number | null;
  notes?: string | null;
}): boolean {
  if (sale.commission != null) return true;
  const match = sale.notes?.match(SELLER_NOTE_REGEX);
  return Boolean(match);
}

export function extractSaleCommission(
  sale: {
    salePrice: number;
    commission?: number | null;
    notes?: string | null;
  },
  defaultRate = DEFAULT_COMMISSION_RATE,
): number {
  if (
    sale.commission != null &&
    Number.isFinite(sale.commission) &&
    sale.commission >= 0
  ) {
    return Math.round(sale.commission * 100) / 100;
  }
  if (sale.notes) {
    const match = sale.notes.match(SELLER_NOTE_REGEX);
    const rawComm = match?.[2] ?? match?.[3];
    if (rawComm) {
      const parsed = Number(rawComm.replace(/[^\d.,]/g, "").replace(",", "."));
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.round(parsed * 100) / 100;
      }
    }
  }
  const calc = sale.salePrice * (defaultRate / 100);
  return Math.round(calc * 100) / 100;
}

export function formatSaleNotes(
  cleanNotes: string | null | undefined,
  sellerName?: string | null,
  commission?: number | null,
): string | null {
  const base = (cleanNotes ?? "")
    .replace(SELLER_NOTE_REGEX, "")
    .trim();

  const seller = sellerName?.trim();
  const comm =
    commission != null && Number.isFinite(commission) ? commission : null;

  if (!seller && comm == null) {
    return base || null;
  }

  const metaParts: string[] = [];
  if (seller) metaParts.push(`vendedor: ${seller}`);
  if (comm != null) metaParts.push(`comissao: ${comm}`);

  const tag = `[${metaParts.join(" | ")}]`;
  return base ? `${base} ${tag}` : tag;
}

export function computeSalesLeaderboard(
  sales: SaleRecordInput[],
  defaultRate = DEFAULT_COMMISSION_RATE,
): SalesLeaderboard {
  const map = new Map<
    string,
    { count: number; revenue: number; commission: number }
  >();
  let totalCommission = 0;

  for (const sale of sales) {
    const seller = extractSaleSeller(sale);
    const comm = extractSaleCommission(sale, defaultRate);
    totalCommission += comm;

    const current = map.get(seller) ?? { count: 0, revenue: 0, commission: 0 };
    current.count += 1;
    current.revenue += sale.salePrice;
    current.commission += comm;
    map.set(seller, current);
  }

  const leaderboard: SellerPerformance[] = Array.from(map.entries())
    .map(([seller, data]) => ({
      seller,
      count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
      commission: Math.round(data.commission * 100) / 100,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.revenue - a.revenue;
    });

  return {
    totalCommission: Math.round(totalCommission * 100) / 100,
    leaderboard,
  };
}
