import { redirect } from "next/navigation";
import { SalesManager } from "@/components/admin/SalesManager";
import { AdminPageHeader, StatCard } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { formatCurrencyBRL } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default async function VendasPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const monthStart = startOfMonth();

  const [sales, vehicles, customers, totals, monthTotals] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { saleDate: "desc" },
      include: {
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            yearModel: true,
            plate: true,
            historical: true,
          },
        },
        customer: { select: { id: true, name: true, phone: true } },
      },
    }),
    prisma.vehicle.findMany({
      where: { sale: null, historical: false },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        brand: true,
        model: true,
        version: true,
        yearModel: true,
        price: true,
        status: true,
      },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
    prisma.sale.aggregate({ _sum: { salePrice: true }, _count: { _all: true } }),
    prisma.sale.aggregate({
      where: { saleDate: { gte: monthStart } },
      _sum: { salePrice: true },
      _count: { _all: true },
    }),
  ]);

  const revenue = totals._sum.salePrice ?? 0;
  const count = totals._count._all;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Vendas"
        subtitle="Registre vendas do estoque ou históricas (antes do site). Cliente é opcional — basta carro, placa e valor nas históricas."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vendas registradas" value={count} />
        <StatCard
          label="Faturamento total"
          value={formatCurrencyBRL(revenue)}
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

      <SalesManager sales={sales} vehicles={vehicles} customers={customers} />
    </div>
  );
}
