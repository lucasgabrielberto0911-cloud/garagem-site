import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNewLeadsBadgeCount } from "@/lib/admin-stats";
import { prisma } from "@/lib/prisma";
import { MISSING_SALE_COST_WHERE } from "@/lib/admin-cost-warnings";
export async function GET() {
  if (!(await getSession())) return NextResponse.json({}, { status: 401 });
  const [count, costWarnings] = await Promise.all([
    getNewLeadsBadgeCount(),
    prisma.sale.count({ where: MISSING_SALE_COST_WHERE }).catch(() => null),
  ]);
  return NextResponse.json(
    { count, costWarnings },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
