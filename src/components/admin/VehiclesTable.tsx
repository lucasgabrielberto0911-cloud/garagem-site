"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Photo, Vehicle } from "@prisma/client";
import { VehicleImage } from "@/components/VehicleImage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  IconCopy,
  IconExternal,
  IconImage,
  IconPencil,
  IconPlus,
  IconStar,
  IconTrash,
} from "@/components/admin/icons";
import { Badge, EmptyState, btn, inputClass } from "@/components/admin/ui";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import {
  deleteVehicle,
  duplicateVehicle,
  setVehicleFeatured,
  setVehicleStatus,
} from "@/app/admin/veiculos/actions";

export type VehicleRow = Vehicle & { photos: Photo[] };

const STATUS_OPTIONS = [
  { value: "disponivel", label: "Disponível" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
] as const;

const STATUS_TONE = {
  disponivel: "brand",
  reservado: "warning",
  vendido: "neutral",
} as const;

const PAGE_SIZE = 10;

type SortKey = "recent" | "year" | "km" | "price";

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
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "recent",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<VehicleRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const items = [...vehicles];
    const factor = sort.dir === "asc" ? 1 : -1;

    items.sort((a, b) => {
      if (sort.key === "recent") {
        return (a.createdAt.getTime() - b.createdAt.getTime()) * factor;
      }
      const key = sort.key === "year" ? "yearModel" : sort.key;
      return ((a[key] as number) - (b[key] as number)) * factor;
    });

    return items;
  }, [vehicles, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const applyFilters = useCallback(
    (params: { q?: string; status?: string }) => {
      const search = new URLSearchParams();
      const nextQ = params.q ?? q;
      const nextStatus = params.status ?? status;
      if (nextQ) search.set("q", nextQ);
      if (nextStatus) search.set("status", nextStatus);
      startTransition(() => {
        router.push(search.toString() ? `${pathname}?${search}` : pathname);
      });
      setPage(1);
    },
    [q, status, router, pathname],
  );

  function toggleSort(key: Exclude<SortKey, "recent">) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
    setPage(1);
  }

  function runQuickAction(
    id: string,
    action: () => Promise<{ ok: boolean; message: string }>,
  ) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch {
        toast.error("Não foi possível concluir a ação.");
      } finally {
        setBusyId(null);
      }
    });
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

  function sortIcon(key: Exclude<SortKey, "recent">) {
    if (sort.key !== key) return "↕";
    return sort.dir === "asc" ? "↑" : "↓";
  }

  return (
    <div className="space-y-4">
      <div className="border border-white/10 bg-ink/50 p-3 sm:p-4">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            applyFilters({
              q: (form.elements.namedItem("q") as HTMLInputElement).value,
              status: (form.elements.namedItem("status") as HTMLSelectElement)
                .value,
            });
          }}
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar marca, modelo, versão, cor..."
            className={`${inputClass} flex-1`}
          />
          <select name="status" defaultValue={status} className={`${inputClass} sm:w-48`}>
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={isPending} className={btn.outline}>
            {isPending ? "Buscando..." : "Filtrar"}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            Ordenar:
          </span>
          {(
            [
              { key: "recent", label: "Mais recentes" },
              { key: "price", label: "Preço" },
              { key: "km", label: "KM" },
              { key: "year", label: "Ano" },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() =>
                option.key === "recent"
                  ? setSort({ key: "recent", dir: "desc" })
                  : toggleSort(option.key)
              }
              className={`px-2.5 py-1.5 text-xs transition ${
                sort.key === option.key
                  ? "bg-brand/15 text-brand"
                  : "border border-white/10 text-muted hover:text-cream"
              }`}
            >
              {option.label}
              {sort.key === option.key && option.key !== "recent"
                ? ` ${sortIcon(option.key)}`
                : ""}
            </button>
          ))}
          {q || status ? (
            <button
              type="button"
              onClick={() => applyFilters({ q: "", status: "" })}
              className="ml-auto text-xs text-muted underline-offset-4 transition hover:text-cream hover:underline"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          icon={<IconImage className="h-12 w-12" />}
          title={
            q || status
              ? "Nenhum veículo encontrado"
              : "Nenhum veículo cadastrado ainda"
          }
          description={
            q || status
              ? "Tente ajustar a busca ou o filtro de status."
              : "Cadastre o primeiro veículo do estoque para começar."
          }
          action={
            <Link href="/admin/veiculos/novo" className={btn.primary}>
              <IconPlus className="h-4 w-4" />
              {q || status ? "Cadastrar veículo" : "Cadastrar o primeiro"}
            </Link>
          }
        />
      ) : (
        <>
          {/* Mobile: cards, porque tabela larga não cabe na tela. */}
          <ul className="space-y-3 lg:hidden">
            {pageItems.map((vehicle) => (
              <li
                key={vehicle.id}
                className="border border-white/10 bg-ink/50 p-3"
              >
                <div className="flex gap-3">
                  <Link
                    href={`/admin/veiculos/${vehicle.id}`}
                    className="relative h-20 w-28 shrink-0 overflow-hidden bg-asphalt"
                  >
                    <VehicleImage
                      src={vehicle.photos[0]?.url}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/veiculos/${vehicle.id}`}
                        className="font-display text-sm font-semibold text-cream"
                      >
                        {vehicle.brand} {vehicle.model}
                      </Link>
                      <Badge tone={STATUS_TONE[vehicle.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                        {STATUS_OPTIONS.find((s) => s.value === vehicle.status)
                          ?.label ?? vehicle.status}
                      </Badge>
                    </div>
                    {vehicle.version ? (
                      <p className="truncate text-xs text-muted">
                        {vehicle.version}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted">
                      {vehicle.year}/{vehicle.yearModel} ·{" "}
                      {formatNumberBR(vehicle.km)} km
                    </p>
                    <p className="mt-1 font-display text-base font-bold text-cream">
                      {formatCurrencyBRL(vehicle.price)}
                    </p>
                    {vehicle.photos.length === 0 ? (
                      <p className="mt-1 text-xs text-brand">Sem fotos</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                  <FeaturedButton
                    featured={vehicle.featured}
                    busy={busyId === vehicle.id}
                    onClick={() =>
                      runQuickAction(vehicle.id, () =>
                        setVehicleFeatured(vehicle.id, !vehicle.featured),
                      )
                    }
                  />
                  <select
                    value={vehicle.status}
                    disabled={busyId === vehicle.id}
                    onChange={(event) =>
                      runQuickAction(vehicle.id, () =>
                        setVehicleStatus(vehicle.id, event.target.value),
                      )
                    }
                    className="border border-white/10 bg-ink px-2 py-1.5 text-xs text-cream outline-none focus:border-brand"
                    aria-label="Alterar status"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Link
                    href={`/admin/veiculos/${vehicle.id}`}
                    className="ml-auto p-2 text-muted transition hover:text-cream"
                    aria-label="Editar"
                  >
                    <IconPencil className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/estoque/${vehicle.id}`}
                    target="_blank"
                    className="p-2 text-muted transition hover:text-cream"
                    aria-label="Ver no site"
                  >
                    <IconExternal className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(vehicle)}
                    className="p-2 text-brand transition hover:text-cream"
                    aria-label="Excluir"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela completa. */}
          <div className="hidden overflow-x-auto border border-white/10 lg:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-ink text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Veículo</th>
                  <SortableHeader
                    label="Ano"
                    onClick={() => toggleSort("year")}
                    icon={sortIcon("year")}
                  />
                  <SortableHeader
                    label="KM"
                    onClick={() => toggleSort("km")}
                    icon={sortIcon("km")}
                  />
                  <SortableHeader
                    label="Preço"
                    onClick={() => toggleSort("price")}
                    icon={sortIcon("price")}
                  />
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Destaque</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    className="border-t border-white/10 transition hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/veiculos/${vehicle.id}`}
                          className="relative h-12 w-16 shrink-0 overflow-hidden bg-asphalt"
                        >
                          <VehicleImage
                            src={vehicle.photos[0]?.url}
                            alt={`${vehicle.brand} ${vehicle.model}`}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </Link>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/veiculos/${vehicle.id}`}
                            className="font-medium text-cream transition hover:text-brand"
                          >
                            {vehicle.brand} {vehicle.model}
                          </Link>
                          {vehicle.version ? (
                            <p className="truncate text-xs text-muted">
                              {vehicle.version}
                            </p>
                          ) : null}
                          <p className="text-xs text-muted">
                            {vehicle.photos.length === 0 ? (
                              <span className="text-brand">Sem fotos</span>
                            ) : (
                              `${vehicle.photos.length} foto(s)`
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {vehicle.year}/{vehicle.yearModel}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatNumberBR(vehicle.km)} km
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrencyBRL(vehicle.price)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={vehicle.status}
                        disabled={busyId === vehicle.id}
                        onChange={(event) =>
                          runQuickAction(vehicle.id, () =>
                            setVehicleStatus(vehicle.id, event.target.value),
                          )
                        }
                        className="border border-white/10 bg-ink px-2 py-1.5 text-xs text-cream outline-none focus:border-brand"
                        aria-label="Alterar status"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <FeaturedButton
                        iconOnly
                        featured={vehicle.featured}
                        busy={busyId === vehicle.id}
                        onClick={() =>
                          runQuickAction(vehicle.id, () =>
                            setVehicleFeatured(vehicle.id, !vehicle.featured),
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/veiculos/${vehicle.id}`}
                          className="p-2 text-muted transition hover:text-cream"
                          aria-label="Editar"
                          title="Editar"
                        >
                          <IconPencil className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/estoque/${vehicle.id}`}
                          target="_blank"
                          className="p-2 text-muted transition hover:text-cream"
                          aria-label="Ver no site"
                          title="Ver no site"
                        >
                          <IconExternal className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          disabled={busyId === vehicle.id}
                          onClick={() =>
                            runQuickAction(vehicle.id, () =>
                              duplicateVehicle(vehicle.id),
                            )
                          }
                          className="p-2 text-muted transition hover:text-cream disabled:opacity-50"
                          aria-label="Duplicar"
                          title="Duplicar anúncio"
                        >
                          <IconCopy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(vehicle)}
                          className="p-2 text-brand transition hover:text-cream"
                          aria-label="Excluir"
                          title="Excluir"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted sm:flex-row">
            <span>
              Mostrando {pageItems.length} de {vehicles.length} veículo(s)
              {totalPages > 1 ? ` · página ${currentPage} de ${totalPages}` : ""}
            </span>
            {totalPages > 1 ? (
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
            ) : null}
          </div>
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

function FeaturedButton({
  featured,
  busy,
  onClick,
  iconOnly = false,
}: {
  featured: boolean;
  busy: boolean;
  onClick: () => void;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={featured ? "Remover destaque" : "Colocar em destaque"}
      aria-pressed={featured}
      className={`inline-flex items-center gap-1.5 px-2 py-1.5 text-xs transition disabled:opacity-50 ${
        featured
          ? "text-brand-yellow hover:text-cream"
          : "text-muted hover:text-cream"
      }`}
    >
      <IconStar className="h-4 w-4" filled={featured} />
      {iconOnly ? (
        <span className="sr-only">
          {featured ? "Em destaque" : "Sem destaque"}
        </span>
      ) : (
        <span>{featured ? "Em destaque" : "Destacar"}</span>
      )}
    </button>
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
