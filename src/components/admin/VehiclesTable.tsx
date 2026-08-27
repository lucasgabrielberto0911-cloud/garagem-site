"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { VehicleImage } from "@/components/VehicleImage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  IconClipboard,
  IconCopy,
  IconExternal,
  IconImage,
  IconPencil,
  IconPlus,
  IconStar,
  IconTrash,
} from "@/components/admin/icons";
import {
  EmptyState,
  btn,
  inputClass,
  listActionCell,
} from "@/components/admin/ui";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { expectedMargin, hasCostBasis } from "@/lib/vehicle-ops";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";
import { vehiclePath } from "@/lib/vehicle-slug";
import type { AdminVehicleListItem, VehiclesTab } from "@/lib/admin-vehicles";
import { daysInStock, isStaleListing } from "@/lib/stock-quality";
import {
  deleteVehicle,
  duplicateVehicle,
  markVehicleAsSold,
  setVehicleFeatured,
  setVehicleStatus,
} from "@/app/admin/veiculos/actions";

export type VehicleRow = AdminVehicleListItem;

export type { VehiclesTab };

function hydrateVehicle(row: VehicleRow): VehicleRow {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
  };
}

const STATUS_OPTIONS = [
  { value: "disponivel", label: "Disponível" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
] as const;

const MARK_SOLD_BTN =
  "inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 border border-brand-orange/50 bg-transparent px-3 font-display text-xs font-semibold uppercase tracking-wide text-brand-orange transition hover:bg-brand-orange/15 hover:border-brand-orange lg:min-w-[10.75rem] lg:flex-none lg:px-4";

const CHIP_SCROLL =
  "flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function vehicleQualityAlerts(vehicle: VehicleRow) {
  if (vehicle.status === "vendido") return [];
  const alerts: string[] = [];
  if (vehicle.photos.length === 0) alerts.push("Sem foto");
  if (!vehicle.hasVideo) alerts.push("Sem vídeo");
  if (isStaleListing(vehicle.createdAt, vehicle.status)) {
    alerts.push(`Parado há ${daysInStock(vehicle.createdAt)} dias`);
  }
  return alerts;
}

function canMarkAsSold(status: string) {
  return status === "disponivel" || status === "reservado";
}

function vehicleOpsMeta(vehicle: VehicleRow) {
  const costs = vehicle.costs ?? [];
  const tags = [
    vehicle.inStoreName ? "Loja" : null,
    vehicle.hasSpareKey ? "Chave reserva" : null,
    vehicle.hasManual ? "Manual" : null,
  ].filter((item): item is string => Boolean(item));

  if (!hasCostBasis(vehicle.purchasePrice, costs)) {
    return { tags, finance: null as { label: string; value: number } | null };
  }

  const reference = vehicle.sale?.salePrice ?? vehicle.price;
  return {
    tags,
    finance: {
      label: vehicle.sale ? "Lucro" : "Margem",
      value: expectedMargin(reference, vehicle.purchasePrice, costs),
    },
  };
}

type SortKey = "recent" | "year" | "km" | "price";

export function VehiclesTable({
  vehicles,
  initialTotal,
  pageSize,
  q,
  tab,
  status,
  estoqueCount: estoqueCountProp,
  vendidosCount: vendidosCountProp,
  quality,
}: {
  vehicles: VehicleRow[];
  initialTotal: number;
  pageSize: number;
  q: string;
  tab: VehiclesTab;
  status?: string;
  estoqueCount: number;
  vendidosCount: number;
  quality?: {
    withoutPhotos: number;
    withoutVideo: number;
    stale: number;
    staleDays: number;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "recent",
    dir: "desc",
  });
  const [items, setItems] = useState(vehicles);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [estoqueCount, setEstoqueCount] = useState(estoqueCountProp);
  const [vendidosCount, setVendidosCount] = useState(vendidosCountProp);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingSort, setLoadingSort] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadingRef = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<VehicleRow | null>(null);
  const [soldTarget, setSoldTarget] = useState<VehicleRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [markingSold, setMarkingSold] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const hasMore = items.length < total;

  const fetchPage = useCallback(
    async (
      nextPage: number,
      nextSort: { key: SortKey; dir: "asc" | "desc" },
      replace: boolean,
    ) => {
      if (loadingRef.current && !replace) return;
      loadingRef.current = true;
      if (replace) setLoadingSort(true);
      else setLoadingMore(true);
      setLoadError(false);
      try {
        const search = new URLSearchParams();
        if (q) search.set("q", q);
        if (tab === "vendidos") search.set("tab", "vendidos");
        if (status) search.set("status", status);
        search.set("sort", nextSort.key);
        search.set("dir", nextSort.dir);
        search.set("page", String(nextPage));
        search.set("pageSize", String(pageSize));
        const response = await fetch(`/api/admin/veiculos?${search.toString()}`);
        if (!response.ok) throw new Error("fetch");
        const data = (await response.json()) as {
          vehicles?: VehicleRow[];
          total?: number;
        };
        const incoming = (data.vehicles ?? []).map(hydrateVehicle);
        setTotal(data.total ?? 0);
        if (replace) {
          setItems(incoming);
          setPage(1);
        } else {
          setItems((current) => {
            const seen = new Set(current.map((item) => item.id));
            return [
              ...current,
              ...incoming.filter((item) => !seen.has(item.id)),
            ];
          });
          setPage(nextPage);
        }
      } catch {
        setLoadError(true);
        toast.error("Não foi possível carregar os veículos.");
      } finally {
        loadingRef.current = false;
        setLoadingMore(false);
        setLoadingSort(false);
      }
    },
    [pageSize, q, tab, status],
  );

  const applyFilters = useCallback(
    (params: { q?: string; tab?: VehiclesTab }) => {
      const search = new URLSearchParams();
      const nextQ = params.q ?? q;
      const nextTab = params.tab ?? tab;
      if (nextQ) search.set("q", nextQ);
      if (nextTab === "vendidos") search.set("tab", "vendidos");
      if (status && !params.tab && nextTab !== "vendidos") {
        search.set("status", status);
      }
      startTransition(() => {
        router.push(search.toString() ? `${pathname}?${search}` : pathname);
      });
    },
    [q, tab, status, router, pathname],
  );

  function changeSort(next: { key: SortKey; dir: "asc" | "desc" }) {
    setSort(next);
    void fetchPage(1, next, true);
  }

  function toggleSort(key: Exclude<SortKey, "recent">) {
    changeSort(
      sort.key === key
        ? { key, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function removeFromList(id: string, fromTab: VehiclesTab) {
    setItems((current) => current.filter((item) => item.id !== id));
    setTotal((current) => Math.max(0, current - 1));
    if (fromTab === "estoque") {
      setEstoqueCount((current) => Math.max(0, current - 1));
    } else {
      setVendidosCount((current) => Math.max(0, current - 1));
    }
  }

  function applyLocalStatus(id: string, status: string) {
    if (tab === "estoque" && status === "vendido") {
      removeFromList(id, "estoque");
      setVendidosCount((current) => current + 1);
      return;
    }
    if (tab === "vendidos" && status !== "vendido") {
      removeFromList(id, "vendidos");
      setEstoqueCount((current) => current + 1);
      return;
    }
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  }

  function runQuickAction(
    id: string,
    action: () => Promise<{ ok: boolean; message: string }>,
    onOk?: () => void,
  ) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message);
          onOk?.();
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
      removeFromList(deleteTarget.id, tab);
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
      applyLocalStatus(soldTarget.id, "vendido");
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
        className="grid grid-cols-2 border-b border-white/10 lg:flex lg:flex-wrap"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "estoque"}
          onClick={() => applyFilters({ tab: "estoque" })}
          className={`inline-flex min-h-[48px] items-center justify-center gap-2 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide transition touch-manipulation lg:justify-start lg:px-4 ${
            tab === "estoque"
              ? "border-b-2 border-brand text-cream"
              : "border-b-2 border-transparent text-muted hover:text-cream"
          }`}
        >
          Em estoque
          <span
            className={`px-1.5 py-0.5 text-[10px] ${
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
          className={`inline-flex min-h-[48px] items-center justify-center gap-2 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide transition touch-manipulation lg:justify-start lg:px-4 ${
            tab === "vendidos"
              ? "border-b-2 border-brand text-cream"
              : "border-b-2 border-transparent text-muted hover:text-cream"
          }`}
        >
          Vendidos
          <span
            className={`px-1.5 py-0.5 text-[10px] ${
              tab === "vendidos" ? "bg-brand/20 text-brand" : "bg-white/10 text-muted"
            }`}
          >
            {vendidosCount}
          </span>
        </button>
      </div>

      {tab === "estoque" && quality && quality.withoutPhotos + quality.withoutVideo + quality.stale > 0 ? (
        <div className="border border-brand-orange/40 bg-brand-orange/10 px-4 py-3 text-sm text-cream">
          <p className="font-display text-xs font-semibold uppercase tracking-wider text-brand-orange">
            Avisos do estoque
          </p>
          <p className="mt-1 text-sm leading-relaxed text-cream/90">
            {[
              quality.withoutPhotos > 0
                ? `${quality.withoutPhotos} sem foto`
                : null,
              quality.withoutVideo > 0
                ? `${quality.withoutVideo} sem vídeo`
                : null,
              quality.stale > 0
                ? `${quality.stale} parado${quality.stale === 1 ? "" : "s"} há mais de ${quality.staleDays} dias`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            . Marque o vídeo no cadastro quando já existir; anúncio sem foto some do interesse.
          </p>
        </div>
      ) : null}

      <div className="border border-white/10 bg-ink/50 p-3 sm:p-4">
        <form
          className="flex items-stretch gap-2"
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
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button
            type="submit"
            disabled={isPending}
            className={`${btn.outline} shrink-0 px-3 sm:px-4`}
          >
            {isPending ? "..." : "Buscar"}
          </button>
        </form>

        <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
          <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted">
            Ordenar
          </span>
          <div className={CHIP_SCROLL}>
            {(
              [
                { key: "recent", label: "Recentes" },
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
                    ? sort.key === "recent"
                      ? undefined
                      : changeSort({ key: "recent", dir: "desc" })
                    : toggleSort(option.key)
                }
                className={`min-h-[44px] shrink-0 px-3 text-xs font-semibold uppercase tracking-wide transition touch-manipulation ${
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
                className="min-h-[44px] shrink-0 px-3 text-xs text-muted underline-offset-4 transition touch-manipulation hover:text-cream hover:underline"
              >
                Limpar
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {items.length === 0 && !loadingSort ? (
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
          <div
            className={
              loadingSort
                ? "pointer-events-none opacity-50 transition-opacity"
                : "transition-opacity"
            }
          >
            {/* Cards iguais no celular e no desktop: hierarquia clara, ações rotuladas. */}
            <ul className="space-y-3">
            {items.map((vehicle) => (
              <VehicleAdminCard
                key={vehicle.id}
                vehicle={vehicle}
                busy={busyId === vehicle.id}
                onStatus={(status) =>
                  runQuickAction(
                    vehicle.id,
                    () => setVehicleStatus(vehicle.id, status),
                    () => applyLocalStatus(vehicle.id, status),
                  )
                }
                onFeatured={() =>
                  runQuickAction(
                    vehicle.id,
                    () => setVehicleFeatured(vehicle.id, !vehicle.featured),
                    () =>
                      setItems((current) =>
                        current.map((item) =>
                          item.id === vehicle.id
                            ? { ...item, featured: !item.featured }
                            : item,
                        ),
                      ),
                  )
                }
                onDuplicate={() =>
                  runQuickAction(
                    vehicle.id,
                    () => duplicateVehicle(vehicle.id),
                    () => {
                      void fetchPage(1, sort, true);
                    },
                  )
                }
                onMarkSold={() => setSoldTarget(vehicle)}
                onDelete={() => setDeleteTarget(vehicle)}
              />
            ))}
          </ul>
          </div>
          <div className="flex flex-col items-center gap-2 text-sm text-muted">
            <span>
              Mostrando {items.length} de {total} veículo(s)
            </span>
            {hasMore ? (
              <InfiniteSentinel
                onVisible={() => void fetchPage(page + 1, sort, false)}
                disabled={loadingMore || loadingSort || loadError}
              >
                {loadingMore ? (
                  <p className="flex items-center gap-2 text-xs uppercase tracking-wider">
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-r-transparent"
                      aria-hidden="true"
                    />
                    Carregando mais…
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void fetchPage(page + 1, sort, false)}
                    className="min-h-[44px] border border-white/15 px-4 text-xs uppercase tracking-wider text-cream transition hover:border-brand"
                  >
                    Carregar mais
                  </button>
                )}
              </InfiniteSentinel>
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

function VehicleAdminCard({
  vehicle,
  busy,
  onStatus,
  onFeatured,
  onDuplicate,
  onMarkSold,
  onDelete,
}: {
  vehicle: VehicleRow;
  busy: boolean;
  onStatus: (status: string) => void;
  onFeatured: () => void;
  onDuplicate: () => void;
  onMarkSold: () => void;
  onDelete: () => void;
}) {
  const ops = vehicleOpsMeta(vehicle);
  const title = `${vehicle.brand} ${vehicle.model}`;

  return (
    <li className="overflow-hidden border border-white/10 bg-ink/50">
      <div className="flex gap-3 p-3 lg:gap-4 lg:p-4">
        <Link
          href={`/admin/veiculos/${vehicle.id}`}
          className="relative h-[88px] w-[88px] shrink-0 overflow-hidden bg-asphalt lg:h-[104px] lg:w-[148px]"
        >
          <VehicleImage
            src={vehicle.photos[0]?.url}
            alt={title}
            fill
            sizes="(min-width: 1024px) 148px, 88px"
            className="object-cover"
          />
          {vehicle.featured ? (
            <span className="absolute left-1 top-1 bg-brand px-1.5 py-0.5 font-display text-[9px] font-bold uppercase text-cream">
              Destaque
            </span>
          ) : null}
        </Link>

        <div className="min-w-0 flex-1">
          <Link href={`/admin/veiculos/${vehicle.id}`} className="block min-w-0">
            <p className="truncate font-display text-[15px] font-semibold leading-tight text-cream lg:text-base">
              {title}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {vehicleCategoryLabel(vehicle.category)}
              {vehicle.version ? ` · ${vehicle.version}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {vehicle.year}/{vehicle.yearModel} · {formatNumberBR(vehicle.km)} km
            </p>
          </Link>

          {ops.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ops.tags.map((tag) => (
                <span
                  key={tag}
                  className="border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {ops.finance ? (
            <p
              className={`mt-2 text-xs lg:hidden ${
                ops.finance.value >= 0 ? "text-emerald-300" : "text-brand"
              }`}
            >
              {ops.finance.label} {formatCurrencyBRL(ops.finance.value)}
            </p>
          ) : null}

          {vehicleQualityAlerts(vehicle).length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {vehicleQualityAlerts(vehicle).map((alert) => (
                <span
                  key={alert}
                  className="border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-brand"
                >
                  {alert}
                </span>
              ))}
            </div>
          ) : null}

          <p className="mt-2 font-display text-lg font-bold leading-none text-cream lg:hidden">
            {formatCurrencyBRL(vehicle.price)}
          </p>
        </div>

        <div className="hidden w-[11.5rem] shrink-0 flex-col items-end gap-3 lg:flex">
          <p className="font-display text-xl font-bold leading-none text-cream">
            {formatCurrencyBRL(vehicle.price)}
          </p>
          {ops.finance ? (
            <p
              className={`text-xs ${
                ops.finance.value >= 0 ? "text-emerald-300" : "text-brand"
              }`}
            >
              {ops.finance.label} {formatCurrencyBRL(ops.finance.value)}
            </p>
          ) : null}
          <label className="sr-only" htmlFor={`status-d-${vehicle.id}`}>
            Status
          </label>
          <select
            id={`status-d-${vehicle.id}`}
            value={vehicle.status}
            disabled={busy}
            onChange={(event) => onStatus(event.target.value)}
            className={`${inputClass} h-11 disabled:opacity-60`}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-white/10 px-3 py-2 lg:hidden">
        <label className="sr-only" htmlFor={`status-m-${vehicle.id}`}>
          Status
        </label>
        <select
          id={`status-m-${vehicle.id}`}
          value={vehicle.status}
          disabled={busy}
          onChange={(event) => onStatus(event.target.value)}
          className={`${inputClass} disabled:opacity-60`}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-white/10 lg:flex lg:items-center lg:justify-between lg:gap-3 lg:px-2 lg:py-1.5">
        <div className="grid grid-cols-4 lg:flex lg:flex-1 lg:flex-wrap">
          <Link
            href={`/admin/veiculos/${vehicle.id}`}
            className={listActionCell}
            aria-label="Editar anúncio"
            title="Editar anúncio"
          >
            <IconPencil className="h-4 w-4" />
            Editar
          </Link>
          <Link
            href={`/admin/veiculos/${vehicle.id}?view=operacao`}
            className={`${listActionCell} border-l border-white/10`}
            aria-label="Operação"
            title="Custos e documentos"
          >
            <IconClipboard className="h-4 w-4" />
            Operação
          </Link>
          <Link
            href={vehiclePath(vehicle)}
            target="_blank"
            className={`${listActionCell} border-l border-white/10`}
            aria-label="Ver no site"
          >
            <IconExternal className="h-4 w-4" />
            Site
          </Link>
          <button
            type="button"
            onClick={onFeatured}
            disabled={busy}
            title={vehicle.featured ? "Remover destaque" : "Colocar em destaque"}
            aria-pressed={vehicle.featured}
            className={`${listActionCell} border-l border-white/10 disabled:opacity-50 ${
              vehicle.featured ? "text-brand hover:text-cream" : ""
            }`}
          >
            <IconStar className="h-4 w-4" filled={vehicle.featured} />
            Destacar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDuplicate}
            className={`${listActionCell} max-lg:hidden border-l border-white/10 disabled:opacity-50`}
            aria-label="Duplicar"
            title="Duplicar anúncio"
          >
            <IconCopy className="h-4 w-4" />
            Duplicar
          </button>
        </div>

        <div className="flex gap-2 border-t border-white/10 p-3 lg:border-t-0 lg:pr-4">
          {canMarkAsSold(vehicle.status) ? (
            <button
              type="button"
              onClick={onMarkSold}
              className={MARK_SOLD_BTN}
              aria-label="Marcar como vendido"
              title="Marcar como vendido — sai do estoque; a página permanece no site"
            >
              Marcar vendido
            </button>
          ) : (
            <Link
              href={`/admin/veiculos/${vehicle.id}`}
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center border border-white/15 px-3 text-sm font-semibold text-cream/80 lg:min-w-[9.5rem] lg:flex-none"
            >
              Abrir anúncio
            </Link>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-white/10 text-brand"
            aria-label="Excluir definitivamente"
            title="Apaga do banco (404) — só para duplicata/erro"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
