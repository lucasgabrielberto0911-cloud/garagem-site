import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COST_WARNINGS_PAGE_SIZE, MISSING_SALE_COST_WHERE, costWarningsPage } from "@/lib/admin-cost-warnings";

export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({}, { status: 401 });
  try {
    const total = await prisma.sale.count({ where: MISSING_SALE_COST_WHERE });
    const pages = Math.max(1, Math.ceil(total / COST_WARNINGS_PAGE_SIZE));
    const page = Math.min(pages, costWarningsPage(request.nextUrl.searchParams.get("page")));
    const items = await prisma.sale.findMany({
      where: MISSING_SALE_COST_WHERE,
      orderBy: [{ saleDate: "desc" }, { id: "asc" }],
      skip: (page - 1) * COST_WARNINGS_PAGE_SIZE,
      take: COST_WARNINGS_PAGE_SIZE,
      select: { id: true, vehicle: { select: { id: true, brand: true, model: true, yearModel: true, plate: true } } },
    });
    return NextResponse.json({ items, total, page, pages }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[admin/avisos] falha ao consultar:", error);
    return NextResponse.json({ error: "Não foi possível carregar os avisos. Tente novamente." }, { status: 500 });
  }
}
