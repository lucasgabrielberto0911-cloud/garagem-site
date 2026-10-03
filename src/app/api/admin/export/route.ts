import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { csvDocument, csvMoney } from "@/lib/admin-csv";
import { adminDate } from "@/lib/admin-date";
import {
  parseSalesPeriod,
  salesPeriodWhere,
  ADMIN_SALE_LIST_INCLUDE,
} from "@/lib/admin-vehicles";
import { expectedMargin, hasCostBasis } from "@/lib/vehicle-ops";
import { leadSearchWhere } from "@/lib/admin-lead-search";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  if (!(await getSession()))
    return NextResponse.json(
      { error: "Sessão expirada." },
      { status: 401, headers },
    );
  const params = new URL(request.url).searchParams;
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        if (params.get("type") === "sales") {
          const where = salesPeriodWhere(
            parseSalesPeriod(params.get("period")),
          );
          const count = await tx.sale.count({ where });
          if (count > 10000) throw new Error("LIMIT");
          const rows: unknown[][] = [
            [
              "Data",
              "Veículo",
              "Ano",
              "Placa",
              "Cliente",
              "Telefone",
              "Pagamento",
              "Valor (R$)",
              "Lucro (R$)",
              "Tipo",
              "Observações",
            ],
          ];
          for (let skip = 0; skip < count; skip += 500) {
            const batch = await tx.sale.findMany({
              where,
              orderBy: [{ saleDate: "desc" }, { id: "asc" }],
              skip,
              take: 500,
              include: ADMIN_SALE_LIST_INCLUDE,
            });
            for (const s of batch)
              rows.push([
                adminDate(s.saleDate),
                `${s.vehicle.brand} ${s.vehicle.model}`,
                s.vehicle.yearModel,
                s.vehicle.plate,
                s.customer?.name,
                s.customer?.phone,
                s.paymentMethod,
                csvMoney(s.salePrice),
                hasCostBasis(s.vehicle.purchasePrice, s.vehicle.costs, {
                  consigned: s.vehicle.consigned,
                })
                  ? csvMoney(
                      expectedMargin(
                        s.salePrice,
                        s.vehicle.purchasePrice,
                        s.vehicle.costs,
                      ),
                    )
                  : "Base incompleta / N/A",
                s.vehicle.historical ? "Histórica" : "Estoque",
                s.notes,
              ]);
          }
          return { csv: csvDocument(rows), count };
        }
        if (params.get("type") !== "leads") throw new Error("TYPE");
        const where = params.get("lead")
          ? { id: params.get("lead")! }
          : leadSearchWhere({
              status: params.get("status"),
              q: params.get("q"),
              origem: params.get("origem"),
            });
        const count = await tx.leadVenda.count({ where });
        if (count > 10000) throw new Error("LIMIT");
        const rows: unknown[][] = [
          [
            "Nome",
            "Telefone",
            "Veículo",
            "Placa",
            "KM",
            "Status",
            "Origem",
            "Observações",
            "Recebido",
            "Próxima ação",
            "Data da próxima ação",
          ],
        ];
        for (let skip = 0; skip < count; skip += 500) {
          const batch = await tx.leadVenda.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            skip,
            take: 500,
          });
          for (const lead of batch)
            rows.push([
              lead.name,
              lead.phone,
              lead.vehicleInfo,
              lead.plate,
              lead.km,
              lead.status,
              lead.source,
              lead.notes,
              adminDate(lead.createdAt),
              lead.nextAction,
              lead.nextActionAt ? adminDate(lead.nextActionAt) : "",
            ]);
        }
        return { csv: csvDocument(rows), count };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 30000,
      },
    );
    return new Response(result.csv, {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="garagem-export.csv"',
        "X-Record-Count": String(result.count),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "LIMIT"
            ? "O filtro tem mais de 10.000 registros. Reduza o período ou a busca para exportar tudo com segurança."
            : "Não foi possível exportar. Nenhum arquivo parcial foi gerado.",
      },
      { status: 500, headers },
    );
  }
}
