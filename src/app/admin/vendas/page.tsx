import { redirect } from "next/navigation";
import { SalesManager } from "@/components/admin/SalesManager";
import { AdminPageHeader, StatCard, adminStatGrid } from "@/components/admin/ui";
import { getAdminSalesPage, parseSalesPeriod } from "@/lib/admin-vehicles";
import { getSession } from "@/lib/auth";
import { formatCurrencyBRL } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { expectedMargin } from "@/lib/vehicle-ops";

export const dynamic = "force-dynamic";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const monthStart = startOfMonth();
  const { period: periodParam } = await searchParams;
  const period = parseSalesPeriod(periodParam);

  // Lucro somado no banco: só vendas de carro próprio com compra ou custo.
  // Consignado fica fora (lucro N/A), mas a venda conta no faturamento.
  const withCostBasis = {
    sale: { isNot: null },
    consigned: false,
    OR: [
      { purchasePrice: { gt: 0 } },
      { costs: { some: { amount: { gt: 0 } } } },
    ],
  };

  const [list, totals, monthTotals, profitSales, profitPurchases, profitCosts] =
    await Promise.all([
      getAdminSalesPage({ page: 1, period }),
      prisma.sale.aggregate({ _sum: { salePrice: true }, _count: { _all: true } }),
      prisma.sale.aggregate({
        where: { saleDate: { gte: monthStart } },
        _sum: { salePrice: true },
        _count: { _all: true },
      }),
      prisma.sale.aggregate({
        where: { vehicle: withCostBasis },
        _sum: { salePrice: true },
        _count: { _all: true },
      }),
      prisma.vehicle.aggregate({
        where: withCostBasis,
        _sum: { purchasePrice: true },
      }),
      prisma.vehicleCost.aggregate({
        where: { vehicle: withCostBasis },
        _sum: { amount: true },
      }),
    ]);

  const revenue = totals._sum.salePrice ?? 0;
  const count = totals._count._all;
  const knownProfitCount = profitSales._count._all;
  const knownProfit = expectedMargin(
    profitSales._sum.salePrice ?? 0,
    profitPurchases._sum.purchasePrice,
    profitCosts._sum.amount ?? 0,
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
            knownProfitCount > 0
              ? `Lucro ${formatCurrencyBRL(knownProfit)} em ${knownProfitCount} venda(s) com custo`
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
