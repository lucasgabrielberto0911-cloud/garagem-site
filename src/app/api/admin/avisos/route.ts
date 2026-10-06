import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COST_WARNINGS_PAGE_SIZE, MISSING_SALE_COST_WHERE, costWarningsPage } from "@/lib/admin-cost-warnings";
import { agendaWhere } from "@/lib/admin-agenda";
import { parseNoticeKind } from "@/lib/admin-notifications";
import { getWantedStockMatches } from "@/lib/wanted-stock-match-store";

export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({}, { status: 401 });
  try {
    const kind = parseNoticeKind(request.nextUrl.searchParams.get("tipo"));
    const now = new Date();
    const [hoje, atrasados, vendas, matches] = await Promise.all([
      prisma.leadVenda.count({ where: agendaWhere("hoje", now) }),
      prisma.leadVenda.count({ where: agendaWhere("atrasados", now) }),
      prisma.sale.count({ where: MISSING_SALE_COST_WHERE }),
      getWantedStockMatches(),
    ]);
    const counts = { hoje, atrasados, vendas, pedidos: matches.length };
    const total = counts[kind];
    const pages = Math.max(1, Math.ceil(total / COST_WARNINGS_PAGE_SIZE));
    const page = Math.min(pages, costWarningsPage(request.nextUrl.searchParams.get("page")));
    const pagination = { skip: (page - 1) * COST_WARNINGS_PAGE_SIZE, take: COST_WARNINGS_PAGE_SIZE };
    const items = kind === "pedidos" ? matches.slice(pagination.skip, pagination.skip + pagination.take) : kind === "vendas"
      ? (await prisma.sale.findMany({
          where: MISSING_SALE_COST_WHERE, ...pagination,
          orderBy: [{ saleDate: "desc" }, { id: "asc" }],
          select: { id: true, vehicle: { select: { id: true, brand: true, model: true, yearModel: true, plate: true } } },
        })).map(({ id, vehicle }) => ({
          id, title: `${vehicle.brand} ${vehicle.model} · ${vehicle.yearModel}`,
          detail: [vehicle.plate, "Preço de compra não informado"].filter(Boolean).join(" · "),
          href: `/admin/veiculos/${encodeURIComponent(vehicle.id)}?view=operacao`,
        }))
      : (await prisma.leadVenda.findMany({
          where: agendaWhere(kind, now), ...pagination,
          orderBy: [{ nextActionAt: "asc" }, { id: "asc" }],
          select: { id: true, name: true, vehicleInfo: true, nextAction: true, nextActionAt: true },
        })).map((lead) => ({
          id: lead.id, title: lead.name,
          detail: [lead.nextAction, lead.vehicleInfo].filter(Boolean).join(" · "),
          at: lead.nextActionAt?.toISOString(),
          href: `/admin/leads?lead=${encodeURIComponent(lead.id)}`,
        }));
    return NextResponse.json({ kind, counts, items, total, page, pages }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[admin/avisos] falha ao consultar:", error);
    return NextResponse.json({ error: "Não foi possível carregar os avisos. Tente novamente." }, { status: 500 });
  }
}
