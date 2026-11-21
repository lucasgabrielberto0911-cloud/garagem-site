import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  COST_WARNINGS_PAGE_SIZE,
  MISSING_SALE_COST_WHERE,
  costWarningsPage,
} from "@/lib/admin-cost-warnings";
import { reservationDeadline } from "@/lib/admin-date";
import { parseNoticeKind } from "@/lib/admin-notifications";
import {
  getAdminNoticeSnapshot,
  missingCarNoticeWhere,
  reservationDueCutoff,
} from "@/lib/admin-notice-store";

export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({}, { status: 401 });
  try {
    const kind = parseNoticeKind(request.nextUrl.searchParams.get("tipo"));
    const now = new Date();
    const { counts } = await getAdminNoticeSnapshot(now);
    const total = counts[kind];
    const pages = Math.max(1, Math.ceil(total / COST_WARNINGS_PAGE_SIZE));
    const page = Math.min(pages, costWarningsPage(request.nextUrl.searchParams.get("page")));
    const pagination = {
      skip: (page - 1) * COST_WARNINGS_PAGE_SIZE,
      take: COST_WARNINGS_PAGE_SIZE,
    };

    const items =
      kind === "vendas"
        ? (
            await prisma.sale.findMany({
              where: MISSING_SALE_COST_WHERE,
              ...pagination,
              orderBy: [{ saleDate: "desc" }, { id: "asc" }],
              select: {
                id: true,
                vehicle: {
                  select: {
                    id: true,
                    brand: true,
                    model: true,
                    yearModel: true,
                    plate: true,
                  },
                },
              },
            })
          ).map(({ id, vehicle }) => ({
            id,
            title: `${vehicle.brand} ${vehicle.model} · ${vehicle.yearModel}`,
            detail: [vehicle.plate, "Preço de compra não informado"]
              .filter(Boolean)
              .join(" · "),
            href: `/admin/veiculos/${encodeURIComponent(vehicle.id)}?view=operacao`,
          }))
        : (
            await prisma.vehicle.findMany({
              where: missingCarNoticeWhere(reservationDueCutoff(now)),
              ...pagination,
              orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
              select: {
                id: true,
                brand: true,
                model: true,
                yearModel: true,
                price: true,
                status: true,
                _count: { select: { photos: true } },
                reservations: {
                  where: { status: "ativa" },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { expiresAt: true },
                },
              },
            })
          ).map((vehicle) => {
            const deadline =
              vehicle.status === "reservado"
                ? reservationDeadline(
                    vehicle.reservations[0]?.expiresAt?.toISOString() ?? null,
                  )
                : null;
            return {
              id: vehicle.id,
              title: `${vehicle.brand} ${vehicle.model} · ${vehicle.yearModel}`,
              detail:
                [
                  deadline,
                  vehicle._count.photos === 0 ? "Sem fotos" : null,
                  !(vehicle.price > 0) ? "Sem preço" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Revisar anúncio",
              href: `/admin/veiculos/${encodeURIComponent(vehicle.id)}`,
            };
          });

    return NextResponse.json(
      { kind, counts, items, total, page, pages },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[admin/avisos] falha ao consultar:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar os avisos. Tente novamente." },
      { status: 500 },
    );
  }
}
