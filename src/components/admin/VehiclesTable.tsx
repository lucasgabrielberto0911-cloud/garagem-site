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
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";
import { vehiclePath } from "@/lib/vehicle-slug";
import {
  deleteVehicle,
  duplicateVehicle,
  markVehicleAsSold,
  setVehicleFeatured,
  setVehicleStatus,
} from "@/app/admin/veiculos/actions";

export type VehicleRow = Vehicle & { photos: Photo[] };

export type VehiclesTab = "estoque" | "vendidos";

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

const MARK_SOLD_BTN =
  "inline-flex min-h-[32px] items-center border border-brand-orange/50 bg-transparent px-2.5 py-1.5 font-display text-[10px] font-semibold uppercase tracking-wide text-brand-orange transition hover:bg-brand-orange/15 hover:border-brand-orange";

function canMarkAsSold(status: string) {
  return status === "disponivel" || status === "reservado";
}

const PAGE_SIZE = 10;

type SortKey = "recent" | "year" | "km" | "price";

export function VehiclesTable({
  vehicles,
  q,
  tab,
  estoqueCount,
  vendidosCount,
}: {
  vehicles: VehicleRow[];
  q: string;
  tab: VehiclesTab;
  estoqueCount: number;
  vendidosCount: number;
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
  const [soldTarget, setSoldTarget] = useState<VehicleRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [markingSold, setMarkingSold] = useState(false);
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
    (params: { q?: string; tab?: VehiclesTab }) => {
      const search = new URLSearchParams();
      const nextQ = params.q ?? q;
      const nextTab = params.tab ?? tab;
      if (nextQ) search.set("q", nextQ);
      if (nextTab === "vendidos") search.set("tab", "vendidos");
      startTransition(() => {
        router.push(search.toString() ? `${pathname}?${search}` : pathname);
      });
      setPage(1);
    },
    [q, tab, router, pathname],
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

  async function confirmMarkSold() {
    if (!soldTarget) return;
    setMarkingSold(true);
    try {
      await markVehicleAsSold(soldTarget.id);
      toast.success("Veículo movido para a aba Vendidos. A página permanece no site.");
      router.refresh();
    } catch {
      toast.error("Erro ao marcar como vendido.");
    } finally {
      setMarkingSold(false);
      setSoldTarget(null);
    }
  }

  function sortIcon(key: Exclude<SortKey, "recent">) {
    if (sort.key !== key) return "↕";
    return sort.dir === "asc" ? "↑" : "↓";
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Separar estoque e vendidos"
        className="flex flex-wrap gap-2 border-b border-white/10 pb-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "estoque"}
          onClick={() => applyFilters({ tab: "estoque" })}
          className={`inline-flex min-h-[40px] items-center gap-2 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wide transition ${
            tab === "estoque"
              ? "border-b-2 border-brand text-cream"
              : "text-muted hover:text-cream"
          }`}
        >
          Em estoque
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              tab === "estoque" ? "bg-brand/20 text-brand" : "bg-white/10 text-muted"
            }`}
          >
            {estoqueCount}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "vendidos"}
          onClick={() => applyFilters({ tab: "vendidos" })}
          className={`inline-flex min-h-[40px] items-center gap-2 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wide transition ${
            tab === "vendidos"
              ? "border-b-2 border-brand text-cream"
              : "text-muted hover:text-cream"
          }`}
        >
          Vendidos
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              tab === "vendidos" ? "bg-brand/20 text-brand" : "bg-white/10 text-muted"
            }`}
          >
            {vendidosCount}
          </span>
        </button>
      </div>

      <div className="border border-white/10 bg-ink/50 p-3 sm:p-4">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            applyFilters({
              q: (form.elements.namedItem("q") as HTMLInputElement).value,
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
          <button type="submit" disabled={isPending} className={btn.outline}>
            {isPending ? "Buscando..." : "Buscar"}
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
          {q ? (
            <button
              type="button"
              onClick={() => applyFilters({ q: "" })}
              className="ml-auto text-xs text-muted underline-offset-4 transition hover:text-cream hover:underline"
            >
              Limpar busca
            </button>
          ) : null}
        </div>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          icon={<IconImage className="h-12 w-12" />}
          title={
            q
              ? "Nenhum veículo encontrado"
              : tab === "vendidos"
                ? "Nenhum veículo vendido ainda"
                : "Nenhum veículo em estoque"
          }
          description={
            q
              ? "Tente ajustar a busca nesta aba."
              : tab === "vendidos"
                ? "Quando marcar um carro como vendido, ele aparece aqui — fora do estoque ativo."
                : "Cadastre o primeiro veículo do estoque para começar."
          }
          action={
            tab === "estoque" ? (
              <Link href="/admin/veiculos/novo" className={btn.primary}>
                <IconPlus className="h-4 w-4" />
                {q ? "Cadastrar veículo" : "Cadastrar o primeiro"}
              </Link>
            ) : undefined
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
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone="neutral">
                          {vehicleCategoryLabel(vehicle.category)}
                        </Badge>
                        <Badge tone={STATUS_TONE[vehicle.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                          {STATUS_OPTIONS.find((s) => s.value === vehicle.status)
                            ?.label ?? vehicle.status}
                        </Badge>
                      </div>
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
                    href={vehiclePath(vehicle)}
                    target="_blank"
                    className="p-2 text-muted transition hover:text-cream"
                    aria-label="Ver no site"
                  >
                    <IconExternal className="h-4 w-4" />
                  </Link>
                  {canMarkAsSold(vehicle.status) ? (
                    <button
                      type="button"
                      onClick={() => setSoldTarget(vehicle)}
                      className={MARK_SOLD_BTN}
                      aria-label="Marcar como vendido"
                      title="Marcar como vendido — sai do estoque; a página permanece no site"
                    >
                      Marcar vendido
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(vehicle)}
                    className="p-2 text-brand transition hover:text-cream"
                    aria-label="Excluir definitivamente"
                    title="Apaga do banco (404) — só para duplicata/erro"
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
                          <p className="text-xs text-muted">
                            {vehicleCategoryLabel(vehicle.category)}
                            {vehicle.version ? ` · ${vehicle.version}` : ""}
                          </p>
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
                          href={vehiclePath(vehicle)}
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
                        {canMarkAsSold(vehicle.status) ? (
                          <button
                            type="button"
                            onClick={() => setSoldTarget(vehicle)}
                            className={MARK_SOLD_BTN}
                            aria-label="Marcar como vendido"
                            title="Marcar como vendido — sai do estoque; a página permanece no site"
                          >
                            Marcar vendido
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(vehicle)}
                          className="p-2 text-brand transition hover:text-cream"
                          aria-label="Excluir definitivamente"
                          title="Apaga do banco (404) — só para duplicata/erro"
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
        open={soldTarget !== null}
        title="Marcar como vendido"
        description={
          soldTarget
            ? `Confirmar venda de ${soldTarget.brand} ${soldTarget.model}? Sai da aba Em estoque e vai para Vendidos. A página pública continua no ar com aviso (sem 404).`
            : undefined
        }
        confirmLabel="Marcar como vendido"
        danger={false}
        loading={markingSold}
        onCancel={() => setSoldTarget(null)}
        onConfirm={confirmMarkSold}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir definitivamente"
        description={
          deleteTarget
            ? `Apagar ${deleteTarget.brand} ${deleteTarget.model} do banco? A página some (404) e isso prejudica o SEO. Prefira “Marcar como vendido” quando o carro foi vendido. Use exclusão só para cadastro duplicado ou erro.`
            : undefined
        }
        confirmLabel="Excluir definitivamente"
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
