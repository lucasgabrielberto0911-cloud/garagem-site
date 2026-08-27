"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteErrorNotice } from "@/components/site/SiteErrorNotice";
import { StockBrowseShell } from "@/components/site/StockPending";
import { StockFilters, type Facets } from "@/components/site/StockFilters";
import { StockInfiniteList } from "@/components/site/StockInfiniteList";
import { VehicleCardSkeletonGrid } from "@/components/site/VehicleCardSkeleton";
import { WhatsAppButton } from "@/components/site/ui";
import { WHATSAPP_MESSAGES } from "@/lib/site";
import {
  parseStockFilters,
  STOCK_PAGE_SIZE,
  type StockPageResult,
} from "@/lib/stock-query";

export type EstoqueSearchParams = {
  q?: string;
  category?: string;
  brand?: string;
  transmission?: string;
  fuel?: string;
  color?: string;
  accessory?: string;
  laudo?: string;
  minPrice?: string;
  maxPrice?: string;
  minYear?: string;
  maxYear?: string;
  maxKm?: string;
  sort?: string;
  page?: string;
};

const FILTER_KEYS = [
  "q",
  "category",
  "brand",
  "transmission",
  "fuel",
  "color",
  "accessory",
  "laudo",
  "minPrice",
  "maxPrice",
  "minYear",
  "maxYear",
  "maxKm",
] as const;

function paramsToRecord(params: URLSearchParams): EstoqueSearchParams {
  const record: EstoqueSearchParams = {};
  for (const key of [...FILTER_KEYS, "sort"] as const) {
    const value = params.get(key);
    if (value) record[key] = value;
  }
  return record;
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
    brand: params.brand,
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
  return FILTER_KEYS.some((key) => Boolean(params[key]));
}

export function EstoqueBrowseFallback() {
  return (
    <div className="mt-8 lg:grid lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="h-28 border border-white/10 bg-ink lg:h-[70vh]" />
      <div>
        <div className="skeleton mx-auto mt-5 h-3 w-40 lg:mx-0 lg:mt-0" />
        <div className="mt-4">
          <VehicleCardSkeletonGrid count={6} />
        </div>
      </div>
    </div>
  );
}

/**
 * `/estoque` sem query é ISR. Com filtros, o cliente busca `/api/estoque`
 * (já cacheada) e preserva a URL.
 */
export function EstoqueBrowse({
  initialStock,
  facets,
}: {
  initialStock: StockPageResult;
  facets: Facets;
}) {
  const searchParams = useSearchParams();
  const params = useMemo(
    () => paramsToRecord(searchParams),
    [searchParams],
  );
  const filtered = hasActiveFilters(params);
  const filterKey = JSON.stringify(stockQuery(params));
  const [stock, setStock] = useState<StockPageResult>(initialStock);
  const [loading, setLoading] = useState(filtered);
  const requestId = useRef(0);

  useEffect(() => {
    if (!filtered) {
      setStock(initialStock);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    const controller = new AbortController();
    setLoading(true);

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(stockQuery(params))) {
      if (value) query.set(key, value);
    }
    query.set("page", "1");
    query.set("pageSize", String(STOCK_PAGE_SIZE));

    fetch(`/api/estoque?${query.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as Partial<StockPageResult> & {
          vehicles?: StockPageResult["vehicles"];
          error?: string;
        };
        if (id !== requestId.current) return;
        setStock({
          vehicles: data.vehicles ?? [],
          total: data.total ?? 0,
          page: data.page ?? 1,
          pageSize: data.pageSize ?? STOCK_PAGE_SIZE,
          totalPages: data.totalPages ?? 1,
          error: data.error,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || id !== requestId.current) return;
        console.error("[estoque] falha ao filtrar:", error);
        setStock({
          vehicles: [],
          total: 0,
          page: 1,
          pageSize: STOCK_PAGE_SIZE,
          totalPages: 1,
          error: "Não foi possível carregar o estoque.",
        });
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });

    return () => controller.abort();
  }, [filterKey, filtered, initialStock, params]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("garagem:estoque-scroll");
      if (!saved) return;
      sessionStorage.removeItem("garagem:estoque-scroll");
      const top = Number(saved);
      if (Number.isFinite(top) && top > 0) {
        window.requestAnimationFrame(() => window.scrollTo(0, top));
      }
    } catch {
      // private mode
    }
  }, []);

  const returnTo = buildReturnTo(params);
  const filters = parseStockFilters(params, { page: 1 });

  return (
    <>
      {stock.error ? (
        <div className="mt-6">
          <SiteErrorNotice message="O estoque pode estar incompleto por uma falha temporária de conexão. Atualize a página em instantes." />
        </div>
      ) : null}

      <StockBrowseShell
        filters={<StockFilters facets={facets} />}
        results={
          <>
            <p className="mt-5 text-center text-xs uppercase tracking-wider text-muted lg:mt-0 lg:text-left">
              {loading
                ? "Atualizando o estoque…"
                : filtered
                  ? `${stock.total} ${stock.total === 1 ? "veículo encontrado" : "veículos encontrados"}`
                  : `${stock.total} ${stock.total === 1 ? "veículo no estoque" : "veículos no estoque"} · sem filtros`}
              {!loading && stock.total > stock.vehicles.length
                ? " · role para ver todos"
                : ""}
            </p>

            <div className="mt-4" aria-live="polite">
              {loading ? (
                <VehicleCardSkeletonGrid count={6} />
              ) : (
                <StockInfiniteList
                  key={filterKey}
                  initialVehicles={stock.vehicles}
                  total={stock.total}
                  pageSize={stock.pageSize ?? filters.pageSize ?? STOCK_PAGE_SIZE}
                  query={stockQuery(params)}
                  returnTo={returnTo}
                  empty={
                    <div className="mx-auto max-w-2xl border border-dashed border-white/15 bg-ink/40 px-6 py-12 text-center">
                      <p className="font-display text-lg font-semibold text-cream">
                        {stock.error
                          ? "Não foi possível carregar o estoque"
                          : filtered
                            ? "Nenhum veículo com esses filtros"
                            : "Estoque sendo montado"}
                      </p>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                        {stock.error
                          ? "Tente novamente em alguns instantes. Se preferir, fale conosco no WhatsApp."
                          : filtered
                            ? "Tente ampliar a busca. Se você já sabe o que quer, a gente procura o veículo para você."
                            : "Estamos selecionando os próximos veículos. Diga o que você procura que buscamos para você."}
                      </p>
                      <WhatsAppButton className="mt-5" message={WHATSAPP_MESSAGES.general}>
                        Quero avisar o que procuro
                      </WhatsAppButton>
                    </div>
                  }
                />
              )}
            </div>
          </>
        }
      />
    </>
  );
}
