import Link from "next/link";
import { redirect } from "next/navigation";
import { VehiclesTable } from "@/components/admin/VehiclesTable";
import { IconPlus } from "@/components/admin/icons";
import { AdminPageHeader, StatCard, btn } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { formatCurrencyBRL } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const q = (searchParams.q || "").trim();
  const status = (searchParams.status || "").trim();

  const [vehicles, groups, stockValue] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        AND: [
          status ? { status } : {},
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
      include: { photos: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.vehicle.aggregate({
      where: { status: "disponivel" },
      _sum: { price: true },
    }),
  ]);

  const count = (value: string) =>
    groups.find((group) => group.status === value)?._count._all ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Veículos"
        subtitle={`${vehicles.length} veículo(s) na visualização atual`}
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
        <StatCard label="Vendidos" value={count("vendido")} />
        <StatCard
          label="Valor do estoque"
          value={formatCurrencyBRL(stockValue._sum.price ?? 0)}
          hint="Somente disponíveis"
        />
      </section>

      <VehiclesTable vehicles={vehicles} q={q} status={status} />
    </div>
  );
}
