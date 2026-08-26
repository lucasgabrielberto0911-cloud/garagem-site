"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import type { VehicleCardRecord } from "@/lib/vehicles";

type StockQuery = Record<string, string | undefined>;

function buildEstoqueUrl(query: StockQuery, page: number, pageSize: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return `/api/estoque?${params.toString()}`;
}

export function StockInfiniteList({
  initialVehicles,
  total,
  pageSize,
  query,
  returnTo,
  empty,
}: {
  initialVehicles: VehicleCardRecord[];
  total: number;
  pageSize: number;
  query: StockQuery;
  returnTo: string;
  empty: ReactNode;
}) {
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadingRef = useRef(false);

  const hasMore = vehicles.length < total;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setFailed(false);

    const nextPage = page + 1;
    try {
      const response = await fetch(
        buildEstoqueUrl(query, nextPage, pageSize),
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("Falha ao carregar o estoque");
      const data = (await response.json()) as {
        vehicles?: VehicleCardRecord[];
      };
      const incoming = data.vehicles ?? [];
      setVehicles((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...incoming.filter((item) => !seen.has(item.id))];
      });
      setPage(nextPage);
    } catch {
      setFailed(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hasMore, page, pageSize, query]);

  if (initialVehicles.length === 0) return <>{empty}</>;

  return (
    <>
      <VehicleGrid
        vehicles={vehicles}
        returnTo={returnTo}
        priorityCount={2}
      />

      {hasMore ? (
        <InfiniteSentinel
          onVisible={loadMore}
          disabled={loading || failed}
          rootMargin="400px 0px"
        >
          {loading ? (
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-r-transparent"
                aria-hidden="true"
              />
              Carregando mais veículos…
            </p>
          ) : failed ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="min-h-[48px] border border-white/15 px-4 text-xs uppercase tracking-wider text-cream transition hover:border-brand touch-manipulation"
            >
              Tentar de novo
            </button>
          ) : (
            <p className="text-xs uppercase tracking-wider text-muted">
              Role para ver o restante do estoque
            </p>
          )}
        </InfiniteSentinel>
      ) : vehicles.length > 0 ? (
        <p className="mt-6 text-center text-xs uppercase tracking-wider text-muted">
          {total === 1
            ? "1 veículo neste filtro"
            : `Você viu os ${total} veículos`}
        </p>
      ) : null}
    </>
  );
}
