"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Photo, Vehicle } from "@prisma/client";
import { VehicleImage } from "@/components/VehicleImage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { deleteVehicle } from "@/app/admin/veiculos/actions";

export type VehicleRow = Vehicle & { photos: Photo[] };

const STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
};

const PAGE_SIZE = 10;

export function VehiclesTable({
  vehicles,
  q,
  status,
}: {
  vehicles: VehicleRow[];
  q: string;
  status: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [sort, setSort] = useState<{ key: "year" | "km" | "price"; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<VehicleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sorted = useMemo(() => {
    if (!sort) return vehicles;
    const key = sort.key === "year" ? "yearModel" : sort.key;
    return [...vehicles].sort((a, b) => {
      const av = a[key as keyof Vehicle] as number;
      const bv = b[key as keyof Vehicle] as number;
      return sort.dir === "asc" ? av - bv : bv - av;
    });
  }, [vehicles, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const applyFilters = useCallback(
    (params: Record<string, string>) => {
      const search = new URLSearchParams();
      if (params.q ?? q) search.set("q", params.q ?? q);
      if (params.status ?? status) search.set("status", params.status ?? status);
      startTransition(() => {
        router.push(`${pathname}?${search.toString()}`);
      });
      setPage(1);
    },
    [q, status, router, pathname],
  );

  function toggleSort(key: "year" | "km" | "price") {
    setSort((current) =>
      current?.key === key
        ? current.dir === "asc"
          ? { key, dir: "desc" }
          : null
        : { key, dir: "asc" },
    );
    setPage(1);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteVehicle(deleteTarget.id);
      toast.success("Veículo excluído.");
      router.refresh();
    } catch {
      toast.error("Erro ao excluir o veículo.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function sortIcon(key: "year" | "km" | "price") {
    if (sort?.key !== key) return "↕";
    return sort.dir === "asc" ? "↑" : "↓";
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const qVal = (form.elements.namedItem("q") as HTMLInputElement).value;
          const statusVal = (form.elements.namedItem("status") as HTMLSelectElement).value;
          applyFilters({ q: qVal, status: statusVal });
        }}
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar marca, modelo, versão..."
          className="flex-1 border border-white/10 bg-ink px-3 py-2.5 text-sm text-cream outline-none focus:border-brand"
        />
        <select
          name="status"
          defaultValue={status}
          className="border border-white/10 bg-ink px-3 py-2.5 text-sm text-cream outline-none focus:border-brand"
        >
          <option value="">Todos os status</option>
          <option value="disponivel">Disponível</option>
          <option value="reservado">Reservado</option>
          <option value="vendido">Vendido</option>
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="border border-white/15 px-4 py-2.5 text-sm text-cream transition hover:border-brand disabled:opacity-60"
        >
          {isPending ? "Buscando..." : "Filtrar"}
        </button>
      </form>

      {vehicles.length === 0 ? (
        <EmptyState hasFilter={Boolean(q || status)} />
      ) : (
        <>
          <div className="overflow-x-auto border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-ink text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Foto</th>
                  <th className="px-4 py-3 font-medium">Veículo</th>
                  <SortableHeader label="Ano" onClick={() => toggleSort("year")} icon={sortIcon("year")} />
                  <SortableHeader label="KM" onClick={() => toggleSort("km")} icon={sortIcon("km")} />
                  <SortableHeader label="Preço" onClick={() => toggleSort("price")} icon={sortIcon("price")} />
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((vehicle) => {
                  const thumb = vehicle.photos[0]?.url;
                  return (
                    <tr
                      key={vehicle.id}
                      className="border-t border-white/10 transition hover:bg-white/[0.04]"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/admin/veiculos/${vehicle.id}`}>
                          <div className="relative h-14 w-20 overflow-hidden bg-ink">
                            <VehicleImage
                              src={thumb}
                              alt={`${vehicle.brand} ${vehicle.model}`}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/veiculos/${vehicle.id}`}
                          className="font-medium text-cream hover:text-brand"
                        >
                          {vehicle.brand} {vehicle.model}
                        </Link>
                        {vehicle.version ? (
                          <p className="text-xs text-muted">{vehicle.version}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {vehicle.year}/{vehicle.yearModel}
                      </td>
                      <td className="px-4 py-3 text-muted">{formatNumberBR(vehicle.km)} km</td>
                      <td className="px-4 py-3 font-medium">{formatCurrencyBRL(vehicle.price)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 text-xs uppercase tracking-wide ${
                            vehicle.status === "disponivel"
                              ? "bg-brand/15 text-brand"
                              : vehicle.status === "vendido"
                                ? "bg-white/10 text-muted"
                                : "bg-brand-orange/15 text-brand-orange"
                          }`}
                        >
                          {STATUS_LABEL[vehicle.status] || vehicle.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <Link
                            href={`/admin/veiculos/${vehicle.id}`}
                            className="border border-white/15 px-3 py-1.5 text-xs text-muted transition hover:text-cream"
                          >
                            Editar
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(vehicle)}
                            className="border border-brand/40 px-3 py-1.5 text-xs text-brand transition hover:bg-brand/10"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Página {currentPage} de {totalPages} ({vehicles.length} itens)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="border border-white/15 px-3 py-1.5 transition hover:text-cream disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="border border-white/15 px-3 py-1.5 transition hover:text-cream disabled:opacity-40"
                >
                  Próximo
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir veículo"
        description={
          deleteTarget
            ? `Tem certeza que deseja excluir ${deleteTarget.brand} ${deleteTarget.model}? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        danger
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function SortableHeader({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: string;
}) {
  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-cream"
      >
        {label}
        <span className="text-muted">{icon}</span>
      </button>
    </th>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-white/15 px-6 py-16 text-center">
      <svg
        className="h-14 w-14 text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11m-14 0h14a2 2 0 012 2v3a1 1 0 01-1 1h-1m-14-6a2 2 0 00-2 2v3a1 1 0 001 1h1m0 0a2 2 0 104 0m-4 0h4m6 0a2 2 0 104 0m-4 0h4" />
      </svg>
      <h2 className="mt-4 font-display text-lg font-semibold text-cream">
        {hasFilter ? "Nenhum veículo encontrado" : "Nenhum veículo cadastrado ainda"}
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        {hasFilter
          ? "Tente ajustar a busca ou o filtro de status."
          : "Cadastre o primeiro veículo do estoque para começar."}
      </p>
      <Link
        href="/admin/veiculos/novo"
        className="mt-6 bg-brand px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418]"
      >
        Cadastrar o primeiro
      </Link>
    </div>
  );
}
