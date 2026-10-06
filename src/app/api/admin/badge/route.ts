import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNewLeadsBadgeCount } from "@/lib/admin-stats";
import { prisma } from "@/lib/prisma";
import { MISSING_SALE_COST_WHERE } from "@/lib/admin-cost-warnings";
import { agendaWhere } from "@/lib/admin-agenda";
import { getWantedStockMatches } from "@/lib/wanted-stock-match-store";
export async function GET() {
  if (!(await getSession())) return NextResponse.json({}, { status: 401 });
  const now = new Date();
  const [count, costWarnings, today, overdue, matches] = await Promise.all([
    getNewLeadsBadgeCount(),
    prisma.sale.count({ where: MISSING_SALE_COST_WHERE }).catch(() => null),
    prisma.leadVenda.count({ where: agendaWhere("hoje", now) }).catch(() => null),
    prisma.leadVenda.count({ where: agendaWhere("atrasados", now) }).catch(() => null),
    getWantedStockMatches().then(items => items.length).catch(() => null),
  ]);
  return NextResponse.json(
    { count, costWarnings, notifications: costWarnings === null || today === null || overdue === null || matches === null ? null : costWarnings + today + overdue + matches },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
