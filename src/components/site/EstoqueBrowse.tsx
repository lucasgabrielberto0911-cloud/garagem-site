"use client";

import { StockSortSelect } from "@/components/site/StockSortSelect";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { requestJson } from "@/lib/request-json";
import { StockInfiniteList } from "@/components/site/StockInfiniteList";
import { StockReturnCapture } from "@/components/site/StockReturnCapture";
import { VehicleCardSkeletonGrid } from "@/components/site/VehicleCardSkeleton";
import { HideStockCardInterest } from "@/components/site/HideStockCardInterest";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { StockSearchPixel } from "@/lib/funnel-events";
import { formatStockWaitlistQuery, stockEmptyWhatsAppCta } from "@/lib/stock-waitlist";
import {
  parseStockFilters,
  STOCK_FILTER_KEYS,
  STOCK_PAGE_SIZE,
  stockSortLabel,
  stockViewNeedsFetch,
  type StockPageResult,
} from "@/lib/stock-query";
import { stockSearchString } from "@/lib/meta-pixel";
import {
  WANTED_VEHICLE_BUTTON_LABEL,
  WANTED_VEHICLE_PATH,
  wantedVehicleHref,
} from "@/lib/wanted-vehicle-page";

export type EstoqueSearchParams = Partial<
  Record<(typeof STOCK_FILTER_KEYS)[number] | "sort" | "page", string>
>;

const LazyStockEmptyState = lazy(() =>
  import("@/components/site/StockEmptyState").then((module) => ({
    default: module.StockEmptyState,
  })),
);

function paramsToRecord(params: URLSearchParams): EstoqueSearchParams {
  const record: EstoqueSearchParams = {};
  for (const key of [...STOCK_FILTER_KEYS, "sort"] as const) {
    const value = params.get(key);
    if (value) record[key] = value;
  }
  return record;
}

/** Keep URL-dependent hydration away from the server-rendered first photos. */
function StockQueryObserver({ onChange }: { onChange: (search: string) => void }) {
  const params = useSearchParams();
  const search = params.toString();
  useEffect(() => { onChange(search); }, [search, onChange]);
  return null;
}

function buildReturnTo(params: EstoqueSearchParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || !value) continue;
    search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/estoque?${qs}` : "/estoque";
}

function stockQuery(params: EstoqueSearchParams) {
  return {
    q: params.q,
    category: params.category,
    body: params.body,
    brand: params.brand,
    model: params.model,
    transmission: params.transmission,
    fuel: params.fuel,
    color: params.color,
    accessory: params.accessory,
    laudo: params.laudo,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    minYear: params.minYear,
    maxYear: params.maxYear,
    maxKm: params.maxKm,
    sort: params.sort,
  };
}

function hasActiveFilters(params: EstoqueSearchParams) {
  return STOCK_FILTER_KEYS.some((key) => Boolean(params[key]));
}

function NextVehicleLink({ href }: { href: string }) {
  return (
    <div className="stock-next-vehicle">
      <Link
        href={href}
        className="inline-flex min-h-[52px] max-w-full items-center justify-center border border-white/20 bg-ink px-5 py-3 text-center font-display text-sm font-semibold leading-snug text-cream transition hover:border-brand hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {WANTED_VEHICLE_BUTTON_LABEL}
      </Link>
    </div>
  );
}

export function EstoqueBrowseFallback({
  stock,
}: {
  stock?: StockPageResult;
}) {
  const total = stock?.total ?? 0;
  const vehicles = stock?.vehicles ?? [];

  return (
    <>
      <p
        role="status"
        aria-atomic="true"
        className="stock-count mb-2 mt-3 text-left text-sm font-medium text-cream lg:mb-0 lg:mt-0 lg:text-xs lg:font-normal lg:uppercase lg:tracking-wider lg:text-cream/75"
      >
        {vehicles.length > 0
          ? `${total} ${total === 1 ? "veículo no estoque" : "veículos no estoque"}`
          : "Atualizando o estoque…"}
        {vehicles.length > 0 ? (
          <span className="hidden lg:inline">
            {` · ${stockSortLabel("destaques")}`}
            {total > vehicles.length ? " · role para ver todos" : ""}
          </span>
        ) : null}
      </p>
      <div className="mt-1 lg:mt-4">
        {vehicles.length > 0 ? (
          <StockReturnCapture returnTo="/estoque">
            <HideStockCardInterest>
              <VehicleGrid
                vehicles={vehicles}
                priorityCount={1}
                returnTo="/estoque"
                photoLayout="stock"
              />
            </HideStockCardInterest>
          </StockReturnCapture>
        ) : (
          <VehicleCardSkeletonGrid count={6} largePhoto />
        )}
      </div>
      <NextVehicleLink href={WANTED_VEHICLE_PATH} />
    </>
  );
}

/**
 * `/estoque` sem query é ISR. Com filtros, o cliente busca `/api/estoque`
 * (já cacheada) e preserva a URL.
 */
export function EstoqueBrowse({
  initialStock,
}: {
  initialStock: StockPageResult;
}) {
  const [search, setSearch] = useState<string | null>(null);
  useEffect(() => {
    const syncFromLocation = () => {
      setSearch(window.location.search.replace(/^\?/, ""));
    };
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);
  const params = useMemo(
    () => paramsToRecord(new URLSearchParams(search ?? "")),
    [search],
  );
  const filtered = hasActiveFilters(params);
  const remote = stockViewNeedsFetch(params);
  const filterKey = JSON.stringify(stockQuery(params));
  const [attempt, setAttempt] = useState(0);
  const needsFetch = remote || attempt > 0 || Boolean(initialStock.error);
  const initialKey = JSON.stringify(stockQuery({}));
  const [result, setResult] = useState({
    key: initialKey, stock: initialStock, params: {} as EstoqueSearchParams, version: 0,
  });
  const [request, setRequest] = useState({
    key: filterKey, attempt: 0, loading: needsFetch, error: "",
  });
  const loading = needsFetch && (
    request.key !== filterKey || request.attempt !== attempt || request.loading
  );
  const error = !loading && needsFetch && request.key === filterKey ? request.error : "";
  const shownResult = needsFetch ? result : {
    key: initialKey, stock: initialStock, params: {} as EstoqueSearchParams, version: 0,
  };
  const hasFetchedFilterResult = !needsFetch || shownResult.key === filterKey || shownResult.version > 0;
  const shown = shownResult.stock;
  const previousResults = (loading || Boolean(error)) && hasFetchedFilterResult && shown.vehicles.length > 0;
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    if (!needsFetch) {
      setResult(current => current.key === initialKey && current.stock === initialStock ? current : {
        key: initialKey, stock: initialStock, params: {}, version: 0,
      });
      return;
    }
    const controller = new AbortController();
    setRequest({ key: filterKey, attempt, loading: true, error: "" });

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(stockQuery(params))) {
      if (value) query.set(key, value);
    }
    query.set("page", "1");
    query.set("pageSize", String(STOCK_PAGE_SIZE));

    requestJson<StockPageResult>(`/api/estoque?${query.toString()}`, {
      headers: { Accept: "application/json" }, signal: controller.signal,
    })
      .then((data) => {
        if (data.error || !Array.isArray(data.vehicles) || !Number.isFinite(data.total)) {
          throw new Error("Resposta inválida do estoque");
        }
        if (controller.signal.aborted || id !== requestId.current) return;
        setResult(current => ({
          key: filterKey, params, version: current.version + 1,
          stock: {
            vehicles: data.vehicles, total: data.total, page: data.page ?? 1,
            pageSize: data.pageSize ?? STOCK_PAGE_SIZE, totalPages: data.totalPages ?? 1,
            suggestions: data.suggestions,
          },
        }));
        setRequest({ key: filterKey, attempt, loading: false, error: "" });
      })
      .catch(() => {
        if (controller.signal.aborted || id !== requestId.current) return;
        // Uma falha não apaga o último conjunto nem vira resultado vazio.
        setRequest({ key: filterKey, attempt, loading: false, error: "Não foi possível atualizar a busca." });
      });

    return () => controller.abort();
  }, [filterKey, needsFetch, attempt, params, initialKey, initialStock]);

  const shownQuery = useMemo(() => stockQuery(shownResult.params), [shownResult.params]);
  const filters = parseStockFilters(params, { page: 1 });
  const searchString = stockSearchString(params);
  const waitlistQuery = formatStockWaitlistQuery(params);
  const emptyWhatsApp = stockEmptyWhatsAppCta({
    filtered,
    waitlistQuery,
  });
  const resultIds = shown.vehicles.map((vehicle) => vehicle.id);

  return (
    <>
      <Suspense fallback={null}>
        <StockQueryObserver onChange={setSearch} />
      </Suspense>
      {!loading && !error && filtered && searchString ? (
        <StockSearchPixel
          active
          searchString={searchString}
          contentIds={resultIds}
        />
      ) : null}
      {error ? (
        <div className="mt-4 border border-brand-orange/40 bg-brand-orange/10 px-4 py-3" role="alert">
          <p className="text-sm text-cream">Não conseguimos atualizar sua busca agora. Seus filtros foram mantidos.</p>
          <button type="button" onClick={() => setAttempt(current => current + 1)}
            className="mt-3 min-h-11 border border-white/25 px-4 text-sm font-semibold text-cream transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            Tentar novamente
          </button>
        </div>
      ) : null}

      <div className="mb-2 mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:mb-0 lg:mt-0">
      <p
        role="status"
        aria-atomic="true"
        className="stock-count text-left text-sm font-medium text-cream lg:text-xs lg:font-normal lg:uppercase lg:tracking-wider lg:text-cream/75"
      >
        {loading
          ? "Atualizando o estoque…"
          : error
            ? "Não foi possível atualizar a busca"
            : filtered
              ? `${shown.total} ${shown.total === 1 ? "veículo encontrado" : "veículos encontrados"}`
              : `${shown.total} ${shown.total === 1 ? "veículo no estoque" : "veículos no estoque"}`}
        {!loading && !error ? (
          <span className="hidden lg:inline">
            {` · ${stockSortLabel(params.sort)}`}
            {shown.total > shown.vehicles.length ? " · role para ver todos" : ""}
          </span>
        ) : null}
      </p>
        <StockSortSelect value={params.sort} />
      </div>

      {previousResults ? (
        <p className="mb-3 text-xs leading-relaxed text-cream/80" data-stock-previous-results="">
          {loading ? "Você está vendo os anúncios já carregados enquanto a busca atualiza." : "Os anúncios abaixo são da última lista carregada. Tente novamente para aplicar sua busca."}
        </p>
      ) : null}
      <div className="mt-1 lg:mt-4" data-estoque-list="" aria-live="polite" aria-busy={loading}>
        {loading && (!hasFetchedFilterResult || shown.vehicles.length === 0) ? (
          <VehicleCardSkeletonGrid count={6} largePhoto />
        ) : (
          <StockInfiniteList
            key={`${shownResult.key}:${shownResult.version}`}
            initialVehicles={shown.vehicles}
            total={shown.total}
            pageSize={shown.pageSize ?? filters.pageSize ?? STOCK_PAGE_SIZE}
            query={shownQuery}
            returnTo={buildReturnTo(shownResult.params)}
            paused={search === null || loading || Boolean(error)}
            empty={
              <Suspense fallback={null}>
                <LazyStockEmptyState
                  error={error}
                  filtered={filtered}
                  loading={loading}
                  queryText={params.q}
                  suggestions={shown.suggestions}
                  clearQueryHref={buildReturnTo({ ...params, q: undefined })}
                  suggestionHref={(query) => buildReturnTo({ ...params, q: query })}
                  searchString={searchString}
                  emptyWhatsApp={emptyWhatsApp}
                />
              </Suspense>
            }
          />
        )}
      </div>

      <NextVehicleLink
        href={wantedVehicleHref(params, {
          empty: !loading && shown.vehicles.length === 0,
        })}
      />
    </>
  );
}
