import Link from "next/link";
import { redirect } from "next/navigation";
import { VehiclesTable } from "@/components/admin/VehiclesTable";
import { IconPlus } from "@/components/admin/icons";
import { AdminPageHeader, StatCard, btn } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { formatCurrencyBRL } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { hasCostBasis, investedTotal } from "@/lib/vehicle-ops";

export const dynamic = "force-dynamic";

type VehiclesTab = "estoque" | "vendidos";

function resolveTab(raw?: string): VehiclesTab {
  return raw === "vendidos" ? "vendidos" : "estoque";
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: { q?: string; tab?: string; status?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const q = (searchParams.q || "").trim();
  // Compat: ?status=vendido antigo abre a aba Vendidos.
  const tab = resolveTab(
    searchParams.tab ||
      (searchParams.status === "vendido" ? "vendidos" : undefined),
  );

  const statusFilter =
    tab === "vendidos"
      ? { status: "vendido" }
      : { status: { in: ["disponivel", "reservado"] } };

  const [vehicles, groups, stockValue] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        AND: [
          { historical: false },
          statusFilter,
          q
            ? {
                OR: [
                  { brand: { contains: q, mode: "insensitive" } },
                  { model: { contains: q, mode: "insensitive" } },
                  { version: { contains: q, mode: "insensitive" } },
                  { color: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
        ],
      },
      include: {
        photos: { orderBy: { order: "asc" }, take: 1 },
        costs: { select: { amount: true } },
        sale: { select: { salePrice: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vehicle.groupBy({
      by: ["status"],
      where: { historical: false },
      _count: { _all: true },
    }),
    prisma.vehicle.aggregate({
      where: { status: "disponivel", historical: false },
      _sum: { price: true },
    }),
  ]);

  const count = (value: string) =>
    groups.find((group) => group.status === value)?._count._all ?? 0;

  const estoqueCount = count("disponivel") + count("reservado");
  const vendidosCount = count("vendido");
  const available = vehicles.filter((item) => item.status === "disponivel");
  const invested = available.reduce(
    (sum, item) => sum + investedTotal(item.purchasePrice, item.costs),
    0,
  );
  const withCostBasis = available.filter((item) =>
    hasCostBasis(item.purchasePrice, item.costs),
  ).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Veículos"
        subtitle={
          tab === "vendidos"
            ? `${vehicles.length} vendido(s) na visualização atual`
            : `${vehicles.length} veículo(s) em estoque na visualização atual`
        }
        actions={
          <Link href="/admin/veiculos/novo" className={btn.primary}>
            <IconPlus className="h-4 w-4" />
            Novo veículo
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Disponíveis" value={count("disponivel")} />
        <StatCard label="Reservados" value={count("reservado")} tone="warning" />
        <StatCard label="Vendidos" value={vendidosCount} />
        <StatCard
          label="Valor do estoque"
          value={formatCurrencyBRL(stockValue._sum.price ?? 0)}
          hint={
            count("disponivel") > 0
              ? tab === "estoque" && withCostBasis > 0
                ? `Média ${formatCurrencyBRL((stockValue._sum.price ?? 0) / count("disponivel"))} · investido ${formatCurrencyBRL(invested)}`
                : `Média ${formatCurrencyBRL((stockValue._sum.price ?? 0) / count("disponivel"))}`
              : "Somente disponíveis"
          }
        />
      </section>

      <VehiclesTable
        vehicles={vehicles}
        q={q}
        tab={tab}
        estoqueCount={estoqueCount}
        vendidosCount={vendidosCount}
      />
    </div>
  );
}
