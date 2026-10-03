import { formatAdminMoney as formatCurrencyBRL } from "@/lib/admin-money";
import { redirect } from "next/navigation";
import { SalesManager } from "@/components/admin/SalesManager";
import {
  AdminPageHeader,
  StatCard,
  adminStatGrid,
} from "@/components/admin/ui";
import {
  getAdminSalesPage,
  getAdminSalesTotals,
  parseSalesPeriod,
} from "@/lib/admin-vehicles";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SELLABLE_VEHICLE_SELECT } from "@/lib/admin-vehicles";

export const dynamic = "force-dynamic";

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; vehicle?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const { period: periodParam, vehicle: vehicleId } = await searchParams;
  const period = parseSalesPeriod(periodParam);

  const [list, totals] = await Promise.all([
    getAdminSalesPage({ page: 1, period }),
    getAdminSalesTotals(period),
  ]);
  const initialVehicle = vehicleId
    ? await prisma.vehicle.findFirst({
        where: { id: vehicleId, sale: null, historical: false },
        select: SELLABLE_VEHICLE_SELECT,
      })
    : null;
  const revenue = totals.revenue;
  const count = totals.count;
  const knownProfit = totals.profit;
  const knownProfitCount = totals.profitCount;
  const label =
    period === "all"
      ? "Todo o período"
      : period === "month"
        ? "Mês atual"
        : period === "year"
          ? "Ano atual"
          : `Últimos ${period} dias`;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Vendas"
        subtitle="Registre e edite vendas do estoque ou históricas. Cliente é opcional — basta carro, placa e valor nas históricas."
      />

      <p className="text-sm text-muted">
        Indicadores e lista: {label}. Consignados contam no faturamento, sem
        apuração de lucro.
      </p>
      <section className={adminStatGrid}>
        <StatCard label="Vendas registradas" value={count} />
        <StatCard
          label="Faturamento no período"
          value={formatCurrencyBRL(revenue)}
          hint={
            knownProfitCount > 0
              ? `Lucro ${formatCurrencyBRL(knownProfit)} em ${knownProfitCount} venda(s) com compra informada`
              : undefined
          }
          tone={revenue > 0 ? "success" : "default"}
        />
        <StatCard
          label="Ticket médio"
          value={count > 0 ? formatCurrencyBRL(revenue / count) : "—"}
        />
        <StatCard
          label="Lucro apurado"
          value={knownProfitCount ? formatCurrencyBRL(knownProfit) : "—"}
          hint={`${knownProfitCount} venda(s) com base completa · ${totals.incomplete} sem compra informada`}
        />
      </section>

      {totals.reviewCount > 0 ? (
        <p
          role="status"
          className="border border-brand-orange/30 bg-brand-orange/10 p-4 text-sm"
        >
          {totals.reviewCount} venda(s) abaixo de R$ 1.000 neste período.
          Confira os lançamentos; nenhum valor foi alterado automaticamente.
        </p>
      ) : null}
      <SalesManager
        key={period}
        sales={list.sales}
        salesTotal={list.total}
        pageSize={list.pageSize}
        period={period}
        periodRevenue={revenue}
        initialVehicle={initialVehicle}
      />
    </div>
  );
}
