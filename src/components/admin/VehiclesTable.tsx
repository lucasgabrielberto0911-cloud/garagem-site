"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { VehicleImage } from "@/components/VehicleImage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ActionSheet } from "@/components/admin/ActionSheet";
import { SheetActions } from "@/components/admin/vehicles-table/SheetActions";
import { VehiclePromoKitModal } from "@/components/admin/VehiclePromoKitModal";
import {
  IconImage,
  IconMore,
  IconPencil,
  IconPlus,
} from "@/components/admin/icons";
import { EmptyState, btn, inputClass } from "@/components/admin/ui";
import { formatCurrencyBRL } from "@/lib/format";
import {
  CONSIGNED_LABEL,
  expectedMargin,
  hasCostBasis,
} from "@/lib/vehicle-ops";
import type { AdminVehicleListItem, VehiclesTab } from "@/lib/admin-vehicles";
import {
  ADMIN_BULK_MAX,
  bulkActionsForTab,
  bulkConfirmDescription,
  bulkFeaturedLeavingHome,
  bulkNamePreview,
  bulkStatusLabel,
  bulkUndoStatus,
  canUndoBulkStatus,
  idsNeedingBulkStatus,
  type AdminBulkStatus,
} from "@/lib/admin-bulk";
import {
  DELETE_CONFIRM_PHRASE,
  adminCardMetaLine,
  adminCardShowsSoldAction,
  deleteRequiresTypedConfirm,
} from "@/lib/admin-list";
import { coverSrc } from "@/lib/stock-query";
import { MAX_HOME_FEATURED } from "@/lib/featured";
import type { StockPending } from "@/lib/admin-stock-pending";
import { publishMissingLine, stockListQuietNote } from "@/lib/stock-quality";
import { rotateLocalDraftOnDuplicate } from "@/lib/admin-duplicate-vehicle";
import {
  deleteVehicle,
  duplicateVehicle,
  setVehicleFeatured,
  setVehicleStatus,
  setVehiclesStatus,
} from "@/app/admin/veiculos/actions";

export type VehicleRow = AdminVehicleListItem;

export type { VehiclesTab };

function hydrateVehicle(row: VehicleRow): VehicleRow {
  return {
    ...row,
    locationCity: row.locationCity || "linhares",
    createdAt: new Date(row.createdAt),
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : row.createdAt,
    photoCount: row.photoCount ?? row.photos?.length ?? 0,
  };
}

const STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
};

const MARK_SOLD_BTN =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 border border-brand-orange/50 bg-transparent px-3 font-display text-xs font-semibold uppercase tracking-wide text-brand-orange transition touch-manipulation hover:border-brand-orange hover:bg-brand-orange/15";
const MARK_SOLD_SIMPLE_BTN =
  "inline-flex h-11 shrink-0 items-center justify-center border border-white/15 bg-transparent px-3 font-display text-xs font-semibold uppercase tracking-wide text-cream transition touch-manipulation hover:border-brand-orange hover:text-brand-orange disabled:opacity-50";

const FILTER_PILL =
  "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-xs font-semibold uppercase tracking-wide transition touch-manipulation";

const SORT_SELECT_OPTIONS = [
  { value: "recent:desc", label: "Recentes" },
  { value: "price:asc", label: "Menor preço" },
  { value: "price:desc", label: "Maior preço" },
  { value: "km:asc", label: "Menor km" },
  { value: "km:desc", label: "Maior km" },
  { value: "year:desc", label: "Mais novo" },
  { value: "year:asc", label: "Mais antigo" },
] as const;

const STATUS_DOT: Record<string, string> = {
  disponivel: "bg-emerald-400",
  reservado: "bg-brand-orange",
  vendido: "bg-white/35",
};

function vehicleFinance(vehicle: VehicleRow) {
  const costs = vehicle.costsTotal ?? 0;
  const options = { consigned: vehicle.consigned };
  if (!hasCostBasis(vehicle.purchasePrice, costs, options)) return null;
  const reference = vehicle.sale?.salePrice ?? vehicle.price;
  return {
    label: vehicle.sale ? "Lucro" : "Margem",
    value: expectedMargin(reference, vehicle.purchasePrice, costs, options),
  };
}

function ConsignedChip() {
  return (
    <span
      className="shrink-0 bg-sky-400/10 px-1.5 py-0.5 text-xs font-medium text-sky-200"
      data-testid="consigned-badge"
    >
      {CONSIGNED_LABEL}
    </span>
  );
}

type SortKey = "recent" | "year" | "km" | "price";

export function VehiclesTable({
  vehicles,
  initialTotal,
  pageSize,
  q,
  tab,
  status,
  pending = "",
  estoqueCount: estoqueCountProp,
  vendidosCount: vendidosCountProp,
  featuredCount: featuredCountProp,
  availableCount: availableCountProp,
  reservedCount: reservedCountProp,
  quality,
  adminId,
}: {
  vehicles: VehicleRow[];
  initialTotal: number;
  pageSize: number;
  q: string;
  tab: VehiclesTab;
  status?: string;
  pending?: StockPending;
  estoqueCount: number;
  vendidosCount: number;
  featuredCount: number;
  availableCount: number;
  reservedCount: number;
  quality?: {
    withoutPhotos: number;
    stale: number;
    staleDays: number;
  };
  adminId?: string;
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
  const [featuredCount, setFeaturedCount] = useState(featuredCountProp);
  const [availableCount, setAvailableCount] = useState(availableCountProp);
  const [reservedCount, setReservedCount] = useState(reservedCountProp);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [loadingSort, setLoadingSort] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadingRef = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<VehicleRow | null>(null);
  const [duplicateConfirmTarget, setDuplicateConfirmTarget] = useState<VehicleRow | null>(null);
  const [soldTarget, setSoldTarget] = useState<VehicleRow | null>(null);
  const [simpleSoldTarget, setSimpleSoldTarget] = useState<VehicleRow | null>(null);
  const [promoTarget, setPromoTarget] = useState<VehicleRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<AdminBulkStatus | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [undoBanner, setUndoBanner] = useState<{ ids: string[] } | null>(null);
  const [actionsTarget, setActionsTarget] = useState<VehicleRow | null>(null);

  const hasMore = items.length < total;
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selected.includes(item.id));
  const someVisibleSelected = selected.length > 0 && !allVisibleSelected;
  const selectMode = selecting || selected.length > 0;
  const statusFilterActive = tab === "estoque" && Boolean(status);
  const pendingFilterActive = tab === "estoque" && Boolean(pending);
  const activeFilterCount =
    (q ? 1 : 0) + (statusFilterActive ? 1 : 0) + (pendingFilterActive ? 1 : 0);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        (event.key !== "/" && event.key !== "?") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((event.target as HTMLElement | null)?.isContentEditable) return;
      event.preventDefault();
      if (event.key === "?") setShortcutsOpen(true);
      else searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (
        bulkTarget ||
        soldTarget ||
        simpleSoldTarget ||
        deleteTarget ||
        actionsTarget ||
        duplicateConfirmTarget ||
        shortcutsOpen
      )
        return;
      if (selected.length === 0 && !undoBanner && !selecting) return;
      event.preventDefault();
      setSelected([]);
      setSelecting(false);
      setUndoBanner(null);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [
    bulkTarget,
    soldTarget,
    simpleSoldTarget,
    deleteTarget,
    actionsTarget,
    duplicateConfirmTarget,
    shortcutsOpen,
    selecting,
    selected.length,
    undoBanner,
  ]);

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
        if (tab === "destaques") search.set("tab", "destaques");
        if (status && tab === "estoque") search.set("status", status);
        if (pending && tab === "estoque") search.set("pendencia", pending);
        search.set("sort", nextSort.key);
        search.set("dir", nextSort.dir);
        search.set("page", String(nextPage));
        search.set("pageSize", String(pageSize));
        const response = await fetch(
          `/api/admin/veiculos?${search.toString()}`,
        );
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
    [pageSize, q, tab, status, pending],
  );

  const applyFilters = useCallback(
    (params: { q?: string; tab?: VehiclesTab; status?: string | null; pending?: StockPending }) => {
      const search = new URLSearchParams();
      const nextQ = params.q ?? q;
      const nextTab = params.tab ?? tab;
      if (nextQ) search.set("q", nextQ);
      if (nextTab === "vendidos") search.set("tab", "vendidos");
      if (nextTab === "destaques") search.set("tab", "destaques");
      const nextStatus = params.status === undefined ? status : params.status;
      if (nextStatus && nextTab === "estoque") {
        search.set("status", nextStatus);
      }
      const nextPending = params.pending ?? pending;
      if (nextPending && nextTab === "estoque") search.set("pendencia", nextPending);
      startTransition(() => {
        router.push(search.toString() ? `${pathname}?${search}` : pathname);
      });
    },
    [q, tab, status, pending, router, pathname],
  );

  function changeSort(next: { key: SortKey; dir: "asc" | "desc" }) {
    setSort(next);
    void fetchPage(1, next, true);
  }

  function removeFromList(id: string, fromTab: VehiclesTab) {
    setItems((current) => current.filter((item) => item.id !== id));
    setTotal((current) => Math.max(0, current - 1));
    if (fromTab === "estoque") {
      setEstoqueCount((current) => Math.max(0, current - 1));
    } else if (fromTab === "vendidos") {
      setVendidosCount((current) => Math.max(0, current - 1));
    }
  }

  function applyLocalStatus(id: string, nextStatus: string, featured = false) {
    const current = items.find((item) => item.id === id);
    const previous = current?.status;
    if (previous === "disponivel" && nextStatus !== "disponivel") {
      setAvailableCount((count) => Math.max(0, count - 1));
    } else if (previous !== "disponivel" && nextStatus === "disponivel") {
      setAvailableCount((count) => count + 1);
    }
    if (previous === "reservado" && nextStatus !== "reservado") {
      setReservedCount((count) => Math.max(0, count - 1));
    } else if (previous !== "reservado" && nextStatus === "reservado") {
      setReservedCount((count) => count + 1);
    }

    if (
      (tab === "estoque" || tab === "destaques") &&
      nextStatus === "vendido"
    ) {
      if (featured) {
        setFeaturedCount((count) => Math.max(0, count - 1));
      }
      removeFromList(id, tab);
      setVendidosCount((count) => count + 1);
      if (tab === "destaques") {
        setEstoqueCount((count) => Math.max(0, count - 1));
      }
      return;
    }
    if (tab === "vendidos" && nextStatus !== "vendido") {
      removeFromList(id, "vendidos");
      setEstoqueCount((count) => count + 1);
      return;
    }
    setItems((rows) =>
      rows.map((item) =>
        item.id === id ? { ...item, status: nextStatus } : item,
      ),
    );
  }

  function runQuickAction<
    T extends {
      ok: boolean;
      message: string;
      redirectUrl?: string;
    },
  >(
    id: string,
    action: () => Promise<T>,
    onOk?: (result: T) => void,
    options?: { refresh?: boolean },
    onError?: (result: T) => void,
  ) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message);
          onOk?.(result);
          if (result.redirectUrl) {
            router.push(result.redirectUrl);
            return;
          }
          // Destaque só muda a estrela e o contador local. Recarregar a página
          // aqui repetia a lista e os números sem alterar o que está na tela.
          if (options?.refresh !== false) router.refresh();
        } else {
          if (onError) {
            onError(result);
          } else {
            toast.error(result.message);
          }
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
      const result = await deleteVehicle(deleteTarget.id);
        if (result && !result.ok) { toast.error(result.message); return; }
      toast.success("Veículo excluído.");
      if (deleteTarget.featured) {
        setFeaturedCount((count) => Math.max(0, count - 1));
      }
      removeFromList(deleteTarget.id, tab);
      router.refresh();
    } catch {
      toast.error("Erro ao excluir o veículo.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function confirmMarkSold() {
    if (!soldTarget) return;
    const targetId = soldTarget.id;
    setSoldTarget(null);
    router.push(`/admin/vendas/nova?veiculo=${targetId}`);
  }

  async function confirmSimpleSold() {
    if (!simpleSoldTarget) return;
    const target = simpleSoldTarget;
    setBusyId(target.id);
    try {
      const response = await fetch(
        `/api/admin/vehicles/${encodeURIComponent(target.id)}/sell`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      const result = (await response.json()) as { ok?: boolean; message?: string; nextUrl?: string };
      if (!response.ok || !result.ok) {
        if (result.nextUrl?.startsWith("/admin/vendas/nova")) {
          toast.error(result.message ?? "Conclua a venda pelo assistente.");
          router.push(result.nextUrl);
          return;
        }
        toast.error(result.message ?? "Não foi possível marcar o veículo como vendido.");
        return;
      }
      applyLocalStatus(target.id, "vendido", target.featured);
      toast.success(result.message ?? "Veículo marcado como vendido.");
      router.refresh();
    } catch {
      toast.error("Não foi possível marcar o veículo como vendido.");
    } finally {
      setBusyId(null);
      setSimpleSoldTarget(null);
    }
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= ADMIN_BULK_MAX) {
        toast.error(`Selecione no máximo ${ADMIN_BULK_MAX} veículos por vez.`);
        return current;
      }
      return [...current, id];
    });
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      const visible = new Set(items.map((item) => item.id));
      setSelected((current) => current.filter((id) => !visible.has(id)));
      return;
    }
    const next: string[] = [];
    const seen = new Set<string>();
    for (const id of selected) {
      seen.add(id);
      next.push(id);
    }
    for (const item of items) {
      if (seen.has(item.id)) continue;
      if (next.length >= ADMIN_BULK_MAX) {
        toast.error(`Selecione no máximo ${ADMIN_BULK_MAX} veículos por vez.`);
        break;
      }
      seen.add(item.id);
      next.push(item.id);
    }
    setSelected(next);
  }

  async function confirmBulkStatus() {
    if (!bulkTarget || selected.length === 0) return;
    setBulkBusy(true);
    try {
      const pendingIds = idsNeedingBulkStatus(items, selected, bulkTarget);
      const result = await setVehiclesStatus(pendingIds, bulkTarget);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const applied = bulkTarget;
      const appliedIds = result.appliedIds ?? pendingIds;
      toast.success(result.message, {
        duration: canUndoBulkStatus(applied) ? 12_000 : 4000,
        action: canUndoBulkStatus(applied)
          ? {
              label: "Desfazer",
              onClick: () => void undoBulkSold(appliedIds),
            }
          : undefined,
      });
      if (canUndoBulkStatus(applied)) {
        setUndoBanner({ ids: appliedIds });
      } else {
        setUndoBanner(null);
      }
      const featuredById = new Map(
        items.map((item) => [item.id, item.featured]),
      );
      for (const id of appliedIds) {
        applyLocalStatus(id, applied, featuredById.get(id) ?? false);
      }
      setSelected([]);
      router.refresh();
    } catch {
      toast.error("Não foi possível atualizar o lote.");
    } finally {
      setBulkBusy(false);
      setBulkTarget(null);
    }
  }

  async function bulkFeature(next: boolean) {
    const targets = items.filter(
      (item) =>
        selected.includes(item.id) &&
        item.featured !== next &&
        (!next || item.status === "disponivel"),
    );
    if (targets.length === 0) {
      toast.error(
        next
          ? "Só anúncio disponível entra na home."
          : "Nenhum dos selecionados está na home.",
      );
      return;
    }
    setBulkBusy(true);
    let done = 0;
    let lastError = "";
    try {
      for (const vehicle of targets) {
        const result = await setVehicleFeatured(vehicle.id, next);
        if (!result.ok) {
          lastError = result.message;
          break;
        }
        done += 1;
        setFeaturedCount((count) => Math.max(0, count + (next ? 1 : -1)));
        if (tab === "destaques" && !next) {
          removeFromList(vehicle.id, "destaques");
          continue;
        }
        setItems((current) =>
          current.map((item) =>
            item.id === vehicle.id ? { ...item, featured: next } : item,
          ),
        );
      }
      if (done > 0) {
        toast.success(
          next
            ? `${done} na home (destaque).`
            : `${done} tirado(s) da home.`,
        );
        router.refresh();
      }
      if (lastError) toast.error(lastError);
    } catch {
      toast.error("Não foi possível atualizar os destaques.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function undoBulkSold(ids: string[]) {
    const revert = bulkUndoStatus("vendido");
    if (!revert) return;
    try {
      const result = await setVehiclesStatus(ids, revert);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        ids.length === 1
          ? "Venda desfeita. O veículo voltou para disponível."
          : `${ids.length} veículos voltaram para disponível.`,
      );
      setUndoBanner(null);
      void fetchPage(1, sort, true);
      router.refresh();
    } catch {
      toast.error("Não foi possível desfazer o lote.");
    }
  }

  function changeStatus(vehicle: VehicleRow, status: string) {
    if (status === "reservado") {
      router.push(`/admin/veiculos/${vehicle.id}?view=operacao`);
      return;
    }
    runQuickAction(
      vehicle.id,
      () => setVehicleStatus(vehicle.id, status),
      () => applyLocalStatus(vehicle.id, status, vehicle.featured),
    );
  }

  function toggleFeatured(vehicle: VehicleRow) {
    runQuickAction(
      vehicle.id,
      () => setVehicleFeatured(vehicle.id, !vehicle.featured),
      () => {
        const nextFeatured = !vehicle.featured;
        setFeaturedCount((count) =>
          Math.max(0, count + (nextFeatured ? 1 : -1)),
        );
        if (tab === "destaques" && !nextFeatured) {
          removeFromList(vehicle.id, "destaques");
          return;
        }
        setItems((current) =>
          current.map((item) =>
            item.id === vehicle.id ? { ...item, featured: nextFeatured } : item,
          ),
        );
      },
      { refresh: false },
    );
  }

  function duplicate(
    vehicle: VehicleRow,
    options?: { replaceDraft?: boolean },
  ) {
    runQuickAction(
      vehicle.id,
      () => duplicateVehicle(vehicle.id, options),
      (result) => {
        if (!result.ok) return;
        const currentAdminId = result.adminId ?? adminId;
        if (currentAdminId) {
          try {
            rotateLocalDraftOnDuplicate(
              [window.sessionStorage, window.localStorage],
              currentAdminId,
              window.sessionStorage,
            );
          } catch {}
        }
        if (!result.redirectUrl) {
          void fetchPage(1, sort, true);
        }
      },
      undefined,
      (result) => {
        if ("hasExistingDraft" in result && result.hasExistingDraft) {
          setDuplicateConfirmTarget(vehicle);
          return;
        }
        toast.error(result.message);
      },
    );
  }

  const selectAll = (
    <>
      <label className="inline-flex min-h-[44px] shrink-0 items-center gap-2 text-sm text-cream">
        <input
          type="checkbox"
          checked={allVisibleSelected}
          aria-checked={
            allVisibleSelected ? true : someVisibleSelected ? "mixed" : false
          }
          ref={(element) => {
            if (element) element.indeterminate = someVisibleSelected;
          }}
          onChange={toggleSelectAllVisible}
          disabled={items.length === 0}
          className="h-5 w-5 accent-brand"
        />
        <span>Selecionar todos</span>
      </label>
      <p className="shrink-0 text-xs text-muted">
        {selected.length > 0
          ? `${selected.length} selecionado(s)`
          : `${items.length} de ${total}`}
      </p>
    </>
  );

  const stockNote =
    tab === "estoque" && quality
      ? stockListQuietNote({
          withoutPhotos: quality.withoutPhotos,
          stale: quality.stale,
          staleDays: quality.staleDays,
        })
      : null;

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Separar estoque e vendidos"
        className="grid grid-cols-3 border-b border-white/10 lg:flex lg:flex-wrap"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "estoque"}
          onClick={() => applyFilters({ tab: "estoque", status: null, pending: "" })}
          className={`inline-flex min-h-[48px] items-center justify-center gap-2 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide transition touch-manipulation lg:justify-start lg:px-4 ${
            tab === "estoque"
              ? "border-b-2 border-brand text-cream"
              : "border-b-2 border-transparent text-muted hover:text-cream"
          }`}
        >
          Em estoque
          <span
            className={`px-1.5 py-0.5 text-xs ${
              tab === "estoque"
                ? "bg-brand/25 text-cream"
                : "bg-white/10 text-muted"
            }`}
          >
            {estoqueCount}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "destaques"}
          onClick={() => applyFilters({ tab: "destaques", status: null })}
          className={`inline-flex min-h-[48px] items-center justify-center gap-2 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide transition touch-manipulation lg:justify-start lg:px-4 ${
            tab === "destaques"
              ? "border-b-2 border-brand text-cream"
              : "border-b-2 border-transparent text-muted hover:text-cream"
          }`}
        >
          Destaques
          <span
            className={`px-1.5 py-0.5 text-xs ${
              tab === "destaques"
                ? "bg-brand/25 text-cream"
                : "bg-white/10 text-muted"
            }`}
          >
            {featuredCount}/{MAX_HOME_FEATURED}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "vendidos"}
          onClick={() => applyFilters({ tab: "vendidos", status: null })}
          className={`inline-flex min-h-[48px] items-center justify-center gap-2 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide transition touch-manipulation lg:justify-start lg:px-4 ${
            tab === "vendidos"
              ? "border-b-2 border-brand text-cream"
              : "border-b-2 border-transparent text-muted hover:text-cream"
          }`}
        >
          Vendidos
          <span
            className={`px-1.5 py-0.5 text-xs ${
              tab === "vendidos"
                ? "bg-brand/25 text-cream"
                : "bg-white/10 text-muted"
            }`}
          >
            {vendidosCount}
          </span>
        </button>
      </div>

      {stockNote ? (
        <p className="text-xs leading-relaxed text-muted">{stockNote}</p>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-stretch gap-2">
          <form
            className="flex min-w-0 flex-1 items-stretch gap-2"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              applyFilters({
                q: (form.elements.namedItem("q") as HTMLInputElement).value,
              });
            }}
          >
            <input
              ref={searchRef}
              type="search"
              name="q"
              enterKeyHint="search"
              defaultValue={q}
              placeholder="Marca, modelo ou placa"
              aria-label="Buscar marca, modelo ou placa"
              className={`${inputClass} min-w-0 flex-1`}
            />
            <button
              type="submit"
              disabled={isPending}
              className={`${btn.outline} hidden shrink-0 px-4 sm:inline-flex`}
            >
              {isPending ? "..." : "Buscar"}
            </button>
          </form>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="vehicles-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className={`${btn.outline} shrink-0 px-3`}
          >
            Filtros
            {activeFilterCount > 0 ? (
              <span className="ml-1.5 text-xs tabular-nums text-brand-orange">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            aria-pressed={selectMode}
            onClick={() => {
              if (selectMode) {
                setSelecting(false);
                setSelected([]);
              } else {
                setSelecting(true);
              }
            }}
            className="min-h-11 shrink-0 px-2 text-xs font-semibold uppercase tracking-wide text-muted transition touch-manipulation hover:text-cream"
          >
            {selectMode ? "Concluir" : "Selecionar"}
          </button>
        </div>

        {filtersOpen ? (
          <div
            id="vehicles-filters"
            className="space-y-3 border border-white/10 bg-ink/50 p-3"
          >
            {tab === "estoque" ? (
              <>
                <div>
                  <p className="mb-1.5 text-xs text-muted">Status</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
                    {(
                      [
                        { value: null, label: "Todos", count: estoqueCount },
                        { value: "disponivel", label: "Disponível", count: availableCount },
                        { value: "reservado", label: "Reservado", count: reservedCount },
                      ] as const
                    ).map((option) => {
                      const active =
                        option.value === null ? !status : status === option.value;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            applyFilters({
                              status: option.value,
                              ...(option.value === "reservado" && pending === "antigos"
                                ? { pending: "" as const }
                                : {}),
                            })
                          }
                          className={`${FILTER_PILL} ${
                            active
                              ? "bg-brand/25 text-cream"
                              : "text-muted hover:bg-white/5 hover:text-cream"
                          }`}
                        >
                          {option.label}
                          <span className="ml-1.5 text-xs tabular-nums opacity-70">
                            {option.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-muted">Precisa de atenção</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Pendências do estoque">
                    {(
                      [
                        { value: "", label: "Nenhuma" },
                        { value: "sem-fotos", label: "Sem foto" },
                        { value: "sem-preco", label: "Sem preço" },
                        { value: "antigos", label: "60+ dias" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={pending === option.value}
                        disabled={isPending}
                        onClick={() =>
                          applyFilters({
                            pending: option.value,
                            ...(option.value === "antigos" ? { status: null } : {}),
                          })
                        }
                        className={`${FILTER_PILL} ${
                          pending === option.value
                            ? "bg-brand/25 text-cream"
                            : "text-muted hover:bg-white/5 hover:text-cream"
                        } disabled:opacity-60`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted" htmlFor="vehicles-sort">
                Ordenar
              </label>
              <select
                id="vehicles-sort"
                value={`${sort.key}:${sort.dir}`}
                onChange={(event) => {
                  const [key, dir] = event.target.value.split(":") as [
                    SortKey,
                    "asc" | "desc",
                  ];
                  changeSort({ key, dir });
                }}
                className="h-11 min-w-0 flex-1 border border-white/10 bg-transparent px-2 text-sm text-cream outline-none focus:border-brand sm:max-w-[14rem]"
              >
                {SORT_SELECT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {activeFilterCount > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ativos">
            {q ? (
              <ActiveChip label={`Busca: ${q}`} onClear={() => applyFilters({ q: "" })} />
            ) : null}
            {statusFilterActive ? (
              <ActiveChip
                label={STATUS_LABEL[status ?? ""] ?? String(status)}
                onClear={() => applyFilters({ status: null })}
              />
            ) : null}
            {pendingFilterActive ? (
              <ActiveChip
                label={
                  pending === "sem-fotos"
                    ? "Sem foto"
                    : pending === "sem-preco"
                      ? "Sem preço"
                      : "60+ dias"
                }
                onClear={() => applyFilters({ pending: "" })}
              />
            ) : null}
            <button
              type="button"
              onClick={() => applyFilters({ q: "", status: null, pending: "" })}
              className="min-h-8 px-1.5 text-xs text-muted underline-offset-4 hover:text-cream hover:underline"
            >
              Limpar
            </button>
          </div>
        ) : null}

        {selectMode ? (
          <div className="flex items-center gap-3 border-b border-white/10 pb-2">
            {selectAll}
          </div>
        ) : null}
        {pending && tab === "estoque" ? (
          <p role="status" className="text-xs leading-relaxed text-muted">
            {total} veículo(s){" "}
            {pending === "sem-fotos"
              ? "sem fotos"
              : pending === "sem-preco"
                ? "sem preço"
                : "disponível(is) há mais de 60 dias"}
            . Abra Editar para revisar o anúncio.
          </p>
        ) : null}
      </div>

      {tab === "destaques" ? (
        <div className="border border-white/10 bg-ink/40 px-4 py-3 text-sm">
          <p className="font-display text-xs font-semibold uppercase tracking-wider text-cream">
            Home · {featuredCount}/{MAX_HOME_FEATURED} destaques
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Só o que está marcado aparece na vitrine. Ordem: cadastro mais
            recente primeiro. Teto de {MAX_HOME_FEATURED} para não bagunçar a
            home.{" "}
            <Link
              prefetch={false}
              href="/"
              target="_blank"
              className="font-medium text-red-400 underline-offset-4 hover:underline"
            >
              Ver a home
            </Link>
          </p>
        </div>
      ) : null}

      {loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-brand-orange/40 bg-brand-orange/10 px-4 py-3 text-sm text-cream">
          <p>Não deu para carregar o restante da lista.</p>
          <button
            type="button"
            onClick={() => void fetchPage(page + 1, sort, items.length === 0)}
            className={btn.outline}
          >
            Tentar de novo
          </button>
        </div>
      ) : null}

      {undoBanner ? (
        <div
          role="status"
          className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex flex-col gap-3 border border-brand-orange/40 bg-ink/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:top-0"
        >
          <p className="text-sm text-cream">
            {undoBanner.ids.length === 1
              ? "1 veículo marcado como vendido."
              : `${undoBanner.ids.length} veículos marcados como vendidos.`}
            <span className="text-muted"> Pode desfazer se foi engano.</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void undoBulkSold(undoBanner.ids)}
              className={btn.outline}
            >
              Desfazer
            </button>
            <button
              type="button"
              onClick={() => setUndoBanner(null)}
              className="min-h-11 px-3 text-xs uppercase tracking-wider text-muted hover:text-cream"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}

      {selected.length > 0 ? (
        <div className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex flex-col gap-3 border border-brand/40 bg-ink/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:top-0">
          <p className="text-sm text-cream">
            {selected.length} selecionado(s)
            <span className="text-muted">
              {" "}
              · máx. {ADMIN_BULK_MAX} · Esc cancela
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {bulkActionsForTab(tab).includes("disponivel") &&
            idsNeedingBulkStatus(items, selected, "disponivel").length > 0 ? (
              <button
                type="button"
                onClick={() => setBulkTarget("disponivel")}
                className={btn.outline}
              >
                Marcar disponível
              </button>
            ) : null}
            {tab !== "vendidos" ? (
              <>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void bulkFeature(true)}
                  className={btn.outline}
                >
                  Destacar
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void bulkFeature(false)}
                  className={btn.outline}
                >
                  Tirar da home
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setSelected([])}
              className="min-h-11 px-3 text-xs uppercase tracking-wider text-muted hover:text-cream"
            >
              Limpar
            </button>
          </div>
        </div>
      ) : null}

      {items.length === 0 && !loadingSort ? (
        <EmptyState
          icon={<IconImage className="h-12 w-12" />}
          title={
            q
              ? "Nenhum veículo encontrado"
              : tab === "vendidos"
                ? "Nenhum veículo vendido ainda"
                : tab === "destaques"
                  ? "Nenhum destaque na home"
                  : "Nenhum veículo em estoque"
          }
          description={
            q
              ? "Tente ajustar a busca nesta aba."
              : tab === "vendidos"
                ? "Quando marcar um carro como vendido, ele aparece aqui — fora do estoque ativo."
                : tab === "destaques"
                  ? "Marque até 8 anúncios disponíveis com a estrela. A home não escolhe carro sozinha."
                  : "Cadastre o primeiro veículo do estoque para começar."
          }
          action={
            tab === "estoque" ? (
              <Link prefetch={false} href="/admin/veiculos/novo" className={btn.primary}>
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
            <ul className="space-y-2">
              {items.map((vehicle) => (
                <VehicleAdminCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  busy={busyId === vehicle.id}
                  selectable={selectMode}
                  selected={selected.includes(vehicle.id)}
                  onToggleSelect={() => toggleSelected(vehicle.id)}
                  onMarkSold={() => setSoldTarget(vehicle)}
                  onMarkSoldSimple={() => setSimpleSoldTarget(vehicle)}
                  onMore={() => setActionsTarget(vehicle)}
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

      <ActionSheet
        open={shortcutsOpen}
        title="Atalhos do teclado"
        onClose={() => setShortcutsOpen(false)}
      >
        <dl className="space-y-2 px-4 py-3 text-sm text-cream">
          {[
            ["/", "Buscar"],
            ["?", "Mostrar esta lista"],
            ["Esc", "Cancelar a seleção"],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <dt className="text-muted">{label}</dt>
              <dd>
                <kbd className="border border-white/20 px-2 py-0.5 text-xs">{key}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </ActionSheet>

      <ActionSheet
        open={actionsTarget !== null}
        title={
          actionsTarget
            ? `${actionsTarget.brand} ${actionsTarget.model}`
            : "Veículo"
        }
        subtitle={
          actionsTarget
            ? `${STATUS_LABEL[actionsTarget.status] ?? actionsTarget.status} · ${formatCurrencyBRL(actionsTarget.price)}`
            : undefined
        }
        media={
          actionsTarget ? (
            <span className="relative block h-12 w-16 shrink-0 overflow-hidden bg-asphalt">
              <VehicleImage
                src={coverSrc(actionsTarget.photos)}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </span>
          ) : null
        }
        onClose={() => setActionsTarget(null)}
      >
        {actionsTarget ? (
          <SheetActions
            vehicle={actionsTarget}
            busy={busyId === actionsTarget.id}
            close={() => setActionsTarget(null)}
            onStatus={(status) => changeStatus(actionsTarget, status)}
            onFeatured={() => toggleFeatured(actionsTarget)}
            onDuplicate={() => duplicate(actionsTarget)}
            onMarkSold={() => setSoldTarget(actionsTarget)}
            onMarkSoldSimple={() => setSimpleSoldTarget(actionsTarget)}
            onDelete={() => setDeleteTarget(actionsTarget)}
            onPromo={() => setPromoTarget(actionsTarget)}
          />
        ) : null}
      </ActionSheet>

      <ConfirmDialog
        open={duplicateConfirmTarget !== null}
        title="Substituir rascunho em andamento?"
        description={
          duplicateConfirmTarget
            ? `Já existe um rascunho de novo veículo em andamento. Deseja substituí-lo pelos dados de ${duplicateConfirmTarget.brand} ${duplicateConfirmTarget.model}? O rascunho anterior será preservado como cópia de segurança.`
            : undefined
        }
        confirmLabel="Substituir rascunho"
        danger
        loading={busyId === duplicateConfirmTarget?.id}
        onCancel={() => setDuplicateConfirmTarget(null)}
        onConfirm={() => {
          const target = duplicateConfirmTarget;
          setDuplicateConfirmTarget(null);
          if (target) {
            duplicate(target, { replaceDraft: true });
          }
        }}
      />

      <ConfirmDialog
        open={soldTarget !== null}
        title="Registrar venda completa"
        description={
          soldTarget
            ? `Registrar a venda completa de ${soldTarget.brand} ${soldTarget.model}? O formulário atual continuará incluindo os dados do comprador e da negociação.`
            : undefined
        }
        confirmLabel="Registrar venda completa"
        danger={false}
        onCancel={() => setSoldTarget(null)}
        onConfirm={confirmMarkSold}
      />

      <ConfirmDialog
        open={simpleSoldTarget !== null}
        title="Marcar como vendida (simples)"
        description={
          simpleSoldTarget
            ? `Marcar ${simpleSoldTarget.brand} ${simpleSoldTarget.model} como vendido sem registrar comprador, preço ou faturamento?`
            : undefined
        }
        confirmLabel="Marcar como vendida (simples)"
        danger
        loading={busyId === simpleSoldTarget?.id}
        onCancel={() => setSimpleSoldTarget(null)}
        onConfirm={() => void confirmSimpleSold()}
      />

      <VehiclePromoKitModal
        vehicle={promoTarget}
        open={promoTarget !== null}
        onClose={() => setPromoTarget(null)}
      />

      <ConfirmDialog
        open={bulkTarget !== null}
        title={
          bulkTarget
            ? bulkStatusLabel(
                bulkTarget,
                idsNeedingBulkStatus(items, selected, bulkTarget).length,
              )
            : "Atualizar lote"
        }
        description={
          bulkTarget
            ? bulkConfirmDescription({
                status: bulkTarget,
                count: idsNeedingBulkStatus(items, selected, bulkTarget).length,
                names: bulkNamePreview(
                  items,
                  idsNeedingBulkStatus(items, selected, bulkTarget),
                ),
                featuredLeaving: bulkFeaturedLeavingHome(
                  items,
                  idsNeedingBulkStatus(items, selected, bulkTarget),
                  bulkTarget,
                ),
              })
            : "Atualizar lote"
        }
        confirmLabel={
          bulkTarget === "vendido"
            ? "Marcar como vendidos"
            : "Marcar disponíveis"
        }
        danger={bulkTarget === "vendido"}
        loading={bulkBusy}
        onCancel={() => setBulkTarget(null)}
        onConfirm={() => void confirmBulkStatus()}
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
        typedPhrase={
          deleteTarget &&
          deleteRequiresTypedConfirm({
            photoCount: deleteTarget.photoCount,
            status: deleteTarget.status,
          })
            ? DELETE_CONFIRM_PHRASE
            : undefined
        }
        typedLabel="Digite EXCLUIR para confirmar"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/10 py-0.5 pl-2.5 pr-1 text-xs text-cream">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remover filtro ${label}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-cream"
      >
        ×
      </button>
    </span>
  );
}

function VehicleAdminCard({
  vehicle,
  busy,
  selectable,
  selected,
  onToggleSelect,
  onMarkSold,
  onMarkSoldSimple,
  onMore,
}: {
  vehicle: VehicleRow;
  busy: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onMarkSold: () => void;
  onMarkSoldSimple: () => void;
  onMore: () => void;
}) {
  const finance = vehicleFinance(vehicle);
  const title = `${vehicle.brand} ${vehicle.model}`;
  const missingPrice = !(vehicle.price > 0);
  const meta = adminCardMetaLine(vehicle);
  const missing = publishMissingLine(vehicle);
  const showSold = adminCardShowsSoldAction(vehicle.status);

  return (
    <li className="overflow-hidden border border-white/10 bg-ink/50">
      <div className="flex gap-3 p-3 lg:gap-4">
        {selectable ? <label className="-my-3 -ml-3 flex w-11 shrink-0 cursor-pointer items-start justify-center self-stretch pt-4 touch-manipulation lg:-ml-1 lg:w-9">
          <span className="sr-only">Selecionar {title}</span>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-5 w-5 accent-brand"
          />
        </label> : null}
        <Link
          prefetch={false}
          href={`/admin/veiculos/${vehicle.id}`}
          className="flex min-w-0 flex-1 gap-3 outline-none focus-visible:ring-2 focus-visible:ring-brand lg:gap-4"
        >
          <span className="relative h-[72px] w-[96px] shrink-0 overflow-hidden bg-asphalt lg:h-[96px] lg:w-[136px]">
            <VehicleImage
              src={coverSrc(vehicle.photos)}
              alt=""
              fill
              sizes="(min-width: 1024px) 136px, 96px"
              className="object-cover"
            />
            {vehicle.featured ? (
              <span className="absolute left-1 top-1 bg-brand px-1.5 py-0.5 font-display text-xs font-bold uppercase text-white">
                Destaque
              </span>
            ) : null}
            <span className="absolute bottom-1 right-1 bg-black/55 px-1.5 py-0.5 text-xs tabular-nums text-cream/70">
              {vehicle.photoCount > 0
                ? `${vehicle.photoCount} foto${vehicle.photoCount === 1 ? "" : "s"}`
                : "Sem foto"}
            </span>
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <span className="min-w-0">
              <span className="block font-display text-base font-semibold leading-tight text-cream">
                {title}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[vehicle.status] ?? "bg-white/35"}`}
                    aria-hidden="true"
                  />
                  {STATUS_LABEL[vehicle.status] ?? vehicle.status}
                </span>
                {vehicle.consigned ? <ConsignedChip /> : null}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                {meta}
              </span>
              {missing ? <span className="mt-1 block text-xs text-brand-orange">{missing}</span> : null}
            </span>
            <span className="shrink-0 sm:text-right">
              {missingPrice ? (
                <span className="text-sm font-medium text-muted">
                  Sem preço
                </span>
              ) : (
                <span className="block font-display text-lg font-bold leading-none text-cream sm:text-xl">
                  {formatCurrencyBRL(vehicle.price)}
                </span>
              )}
              {finance ? (
                <span
                  className={`mt-1 block text-xs ${
                    finance.value >= 0 ? "text-emerald-300" : "text-red-400"
                  }`}
                >
                  {finance.label} {formatCurrencyBRL(finance.value)}
                </span>
              ) : null}
            </span>
          </span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-white/10 px-1.5 py-1">
        <Link
          prefetch={false}
          href={`/admin/veiculos/${vehicle.id}`}
          className="inline-flex h-11 items-center gap-1.5 px-3 font-display text-xs font-semibold uppercase tracking-wide text-cream transition touch-manipulation hover:bg-white/5"
        >
          <IconPencil className="h-4 w-4" />
          Editar
        </Link>
        {showSold ? (
          <>
            <button
              type="button"
              onClick={onMarkSoldSimple}
              disabled={busy}
              className={MARK_SOLD_SIMPLE_BTN}
              aria-label="Marcar como vendida (simples)"
            >
              Marcar como vendida (simples)
            </button>
            <button
              type="button"
              onClick={onMarkSold}
              disabled={busy}
              className={MARK_SOLD_BTN}
              aria-label="Registrar venda completa"
            >
              Registrar venda completa
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={onMore}
          disabled={busy}
          aria-label={`Mais ações: ${title}`}
          aria-haspopup="dialog"
          className="ml-auto inline-flex h-11 w-11 items-center justify-center text-muted transition touch-manipulation hover:bg-white/5 hover:text-cream disabled:opacity-50"
        >
          <IconMore className="h-5 w-5" />
        </button>
      </div>
    </li>
  );
}
