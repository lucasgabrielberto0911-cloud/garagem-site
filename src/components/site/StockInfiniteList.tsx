"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { StockReturnCapture } from "@/components/site/StockReturnCapture";
import type { VehicleCardRecord } from "@/lib/stock-query";

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

async function fetchStockVehicles(url: string, signal?: AbortSignal) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error("Falha ao carregar o estoque");
  const data = (await response.json()) as { vehicles?: VehicleCardRecord[] };
  return data.vehicles ?? [];
}

const MemoVehicleGrid = memo(VehicleGrid);

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
  const bufferRef = useRef<{ page: number; vehicles: VehicleCardRecord[] } | null>(
    null,
  );
  const inflightRef = useRef<Promise<VehicleCardRecord[]> | null>(null);
  const inflightPageRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  const hasMore = vehicles.length < total;

  const loadPage = useCallback(
    async (targetPage: number) => {
      const buffered = bufferRef.current;
      if (buffered?.page === targetPage) return buffered.vehicles;
      if (inflightRef.current && inflightPageRef.current === targetPage) {
        return inflightRef.current;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      inflightPageRef.current = targetPage;

      const request = fetchStockVehicles(
        buildEstoqueUrl(queryRef.current, targetPage, pageSize),
        controller.signal,
      )
        .then((rows) => {
          bufferRef.current = { page: targetPage, vehicles: rows };
          return rows;
        })
        .finally(() => {
          if (inflightRef.current === request) inflightRef.current = null;
        });

      inflightRef.current = request;
      return request;
    },
    [pageSize],
  );

  useEffect(() => {
    if (!hasMore) return;
    void loadPage(page + 1).catch(() => {
      /* o sentinel tenta de novo se a pré-carga falhar */
    });
  }, [hasMore, loadPage, page]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setFailed(false);

    const nextPage = page + 1;
    const buffered =
      bufferRef.current?.page === nextPage ? bufferRef.current.vehicles : null;

    try {
      let incoming = buffered;
      if (!incoming) {
        setLoading(true);
        incoming = await loadPage(nextPage);
      }
      bufferRef.current = null;
      setVehicles((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...incoming.filter((item) => !seen.has(item.id))];
      });
      setPage(nextPage);
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return;
      setFailed(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hasMore, loadPage, page]);

  if (initialVehicles.length === 0) return <>{empty}</>;

  return (
    <>
      <StockReturnCapture returnTo={returnTo}>
        <MemoVehicleGrid
          vehicles={vehicles}
          returnTo={returnTo}
          priorityCount={2}
        />
      </StockReturnCapture>

      {hasMore ? (
        <InfiniteSentinel
          onVisible={loadMore}
          disabled={loading || failed}
          rootMargin="320px 0px"
        >
          {loading ? (
            <p
              className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted"
              aria-live="polite"
            >
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
