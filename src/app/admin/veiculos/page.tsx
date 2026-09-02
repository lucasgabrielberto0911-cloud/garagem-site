import Link from "next/link";
import { redirect } from "next/navigation";
import { VehiclesTable } from "@/components/admin/VehiclesTable";
import { IconPlus } from "@/components/admin/icons";
import { AdminPageHeader, StatCard, adminStatGrid, btn } from "@/components/admin/ui";
import {
  getAdminVehicleStats,
  getAdminVehiclesPage,
  type VehiclesTab,
} from "@/lib/admin-vehicles";
import { STALE_DAYS } from "@/lib/stock-quality";
import { getSession } from "@/lib/auth";
import { formatCurrencyBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

function resolveTab(raw?: string): VehiclesTab {
  return raw === "vendidos" ? "vendidos" : "estoque";
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const query = await searchParams;
  const q = (query.q || "").trim();
  const status =
    query.status === "disponivel" || query.status === "reservado"
      ? query.status
      : undefined;
  const tab = resolveTab(
    query.tab ||
      (query.status === "vendido" ? "vendidos" : undefined),
  );

  const [stats, list] = await Promise.all([
    getAdminVehicleStats(),
    getAdminVehiclesPage({ q, tab, status, page: 1 }),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Veículos"
        subtitle={
          tab === "vendidos"
            ? `${list.total} vendido(s) na visualização atual`
            : `${list.total} veículo(s) em estoque na visualização atual`
        }
        actions={
          <Link href="/admin/veiculos/novo" className={btn.primary}>
            <IconPlus className="h-4 w-4" />
            Novo veículo
          </Link>
        }
      />

      <section className={adminStatGrid}>
        <StatCard label="Disponíveis" value={stats.available} />
        <StatCard label="Reservados" value={stats.reserved} tone="warning" />
        <StatCard label="Vendidos" value={stats.vendidosCount} />
        <StatCard
          label="Valor do estoque"
          value={formatCurrencyBRL(stats.stockValue)}
          hint={
            stats.available > 0
              ? tab === "estoque" && stats.withCostBasis > 0
                ? `Média ${formatCurrencyBRL(stats.stockValue / stats.available)} · investido ${formatCurrencyBRL(stats.invested)}`
                : `Média ${formatCurrencyBRL(stats.stockValue / stats.available)}`
              : "Somente disponíveis"
          }
        />
      </section>

      <VehiclesTable
        key={`${tab}:${q}:${status ?? ""}`}
        vehicles={list.vehicles}
        initialTotal={list.total}
        pageSize={list.pageSize}
        q={q}
        tab={tab}
        status={status}
        estoqueCount={stats.estoqueCount}
        vendidosCount={stats.vendidosCount}
        quality={{
          withoutPhotos: stats.withoutPhotos,
          withoutVideo: stats.withoutVideo,
          stale: stats.stale,
          staleDays: STALE_DAYS,
        }}
      />
    </div>
  );
}
