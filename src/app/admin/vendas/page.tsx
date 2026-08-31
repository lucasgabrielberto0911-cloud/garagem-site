import { redirect } from "next/navigation";
import { SalesManager } from "@/components/admin/SalesManager";
import { AdminPageHeader, StatCard, adminStatGrid } from "@/components/admin/ui";
import { getAdminSalesPage, parseSalesPeriod } from "@/lib/admin-vehicles";
import { getSession } from "@/lib/auth";
import { formatCurrencyBRL } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { expectedMargin, hasCostBasis } from "@/lib/vehicle-ops";

export const dynamic = "force-dynamic";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default async function VendasPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const monthStart = startOfMonth();
  const period = parseSalesPeriod(searchParams.period);

  const [list, totals, monthTotals, profitRows] = await Promise.all([
    getAdminSalesPage({ page: 1, period }),
    prisma.sale.aggregate({ _sum: { salePrice: true }, _count: { _all: true } }),
    prisma.sale.aggregate({
      where: { saleDate: { gte: monthStart } },
      _sum: { salePrice: true },
      _count: { _all: true },
    }),
    prisma.sale.findMany({
      where: {
        OR: [
          { vehicle: { purchasePrice: { gt: 0 } } },
          { vehicle: { costs: { some: {} } } },
        ],
      },
      select: {
        salePrice: true,
        vehicle: {
          select: {
            purchasePrice: true,
            costs: { select: { amount: true } },
          },
        },
      },
    }),
  ]);

  const revenue = totals._sum.salePrice ?? 0;
  const count = totals._count._all;
  const knownProfitSales = profitRows.filter((sale) =>
    hasCostBasis(sale.vehicle.purchasePrice, sale.vehicle.costs),
  );
  const knownProfit = knownProfitSales.reduce(
    (sum, sale) =>
      sum +
      expectedMargin(
        sale.salePrice,
        sale.vehicle.purchasePrice,
        sale.vehicle.costs,
      ),
    0,
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Vendas"
        subtitle="Registre e edite vendas do estoque ou históricas. Cliente é opcional — basta carro, placa e valor nas históricas."
      />

      <section className={adminStatGrid}>
        <StatCard label="Vendas registradas" value={count} />
        <StatCard
          label="Faturamento total"
          value={formatCurrencyBRL(revenue)}
          hint={
            knownProfitSales.length > 0
              ? `Lucro ${formatCurrencyBRL(knownProfit)} em ${knownProfitSales.length} venda(s) com custo`
              : undefined
          }
          tone={revenue > 0 ? "success" : "default"}
        />
        <StatCard
          label="Ticket médio"
          value={count > 0 ? formatCurrencyBRL(revenue / count) : "—"}
        />
        <StatCard
          label="No mês atual"
          value={monthTotals._count._all}
          hint={
            monthTotals._count._all > 0
              ? formatCurrencyBRL(monthTotals._sum.salePrice ?? 0)
              : "Nenhuma venda ainda"
          }
        />
      </section>

      <SalesManager
        key={period}
        sales={list.sales}
        salesTotal={list.total}
        pageSize={list.pageSize}
        period={period}
      />
    </div>
  );
}
