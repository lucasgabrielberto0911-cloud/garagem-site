import Link from "next/link";
import { redirect } from "next/navigation";
import { VehiclesTable } from "@/components/admin/VehiclesTable";
import { IconPlus } from "@/components/admin/icons";
import { AdminPageHeader, btn } from "@/components/admin/ui";
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
  if (raw === "vendidos") return "vendidos";
  if (raw === "destaques") return "destaques";
  return "estoque";
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

  // As abas e os chips de status já mostram as contagens; aqui só o que
  // não aparece em outro lugar: o valor do estoque.
  const stockSummary = (
    <>
      Estoque {formatCurrencyBRL(stats.stockValue)}
      {stats.ownedAvailable > 0
        ? ` · média ${formatCurrencyBRL(stats.stockValue / stats.ownedAvailable)}`
        : ""}
      {stats.consignedAvailable > 0 ? (
        <span className="hidden sm:inline">
          {` · ${stats.consignedAvailable} consignado(s) fora`}
        </span>
      ) : null}
      {stats.withCostBasis > 0 ? (
        <span className="hidden sm:inline">
          {` · investido ${formatCurrencyBRL(stats.invested)}`}
        </span>
      ) : null}
    </>
  );

  return (
    <div className="space-y-3 sm:space-y-5">
      <AdminPageHeader
        title="Veículos"
        mobileActions="inline"
        subtitle={
          tab === "vendidos"
            ? `${list.total} vendido(s) na visualização atual`
            : tab === "destaques"
              ? `${list.total} destaque(s) na home (máx. 8)`
              : stockSummary
        }
        actions={
          <Link href="/admin/veiculos/novo" className={btn.primary}>
            <IconPlus className="h-4 w-4" />
            <span className="sm:hidden">Novo</span>
            <span className="hidden sm:inline">Novo veículo</span>
          </Link>
        }
      />

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
        featuredCount={stats.featured}
        availableCount={stats.available}
        reservedCount={stats.reserved}
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
