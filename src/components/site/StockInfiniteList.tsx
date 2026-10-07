"use client";

import { useSpeculativeLoading } from "./useSpeculativeLoading";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { VehicleCardSkeletonGrid } from "@/components/site/VehicleCardSkeleton";
import { HideStockCardInterest } from "@/components/site/HideStockCardInterest";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { StockReturnCapture } from "@/components/site/StockReturnCapture";
import { requestJson } from "@/lib/request-json";
import type { VehicleCardRecord } from "@/lib/stock-query";
import { clearStockPosition, readStockPosition, restoreStockPosition, type StockPosition } from "@/lib/stock-return";

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
  const data = await requestJson<{ vehicles?: VehicleCardRecord[]; error?: string }>(url, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (data.error || !Array.isArray(data.vehicles)) throw new Error("Resposta inválida do estoque");
  return data.vehicles;
}

const MemoVehicleGrid = memo(VehicleGrid);

export function StockInfiniteList({
  initialVehicles,
  total,
  pageSize,
  query,
  returnTo,
  empty,
  paused = false,
}: {
  initialVehicles: VehicleCardRecord[];
  total: number;
  pageSize: number;
  query: StockQuery;
  returnTo: string;
  empty: ReactNode;
  paused?: boolean;
}) {
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const speculativeLoading = useSpeculativeLoading();
  const [position, setPosition] = useState<StockPosition | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const bufferRef = useRef<{ page: number; vehicles: VehicleCardRecord[] } | null>(
    null,
  );
  const inflightRef = useRef<Promise<VehicleCardRecord[]> | null>(null);
  const inflightPageRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  const hasMore = vehicles.length < total;
  const returnPage = position ? Math.min(position.page, Math.max(1, Math.ceil(total / pageSize))) : 1;

  useEffect(() => {
    const saved = readStockPosition(returnTo);
    if (!saved) clearStockPosition();
    setPosition(saved);
    setLoading(false);
  }, [returnTo]);

  useEffect(() => {
    if (!position) return;
    const root = document.documentElement;
    const anchoring = root.style.overflowAnchor;
    root.style.overflowAnchor = "none";
    const cancel = () => {
      clearStockPosition(position);
      setPosition(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, a, [contenteditable]")) return;
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) cancel();
    };
    window.addEventListener("touchmove", cancel, { passive: true });
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflowAnchor = anchoring;
      window.removeEventListener("touchmove", cancel);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("keydown", onKey);
    };
  }, [position]);

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
    if (paused || !speculativeLoading || !hasMore || position) return;
    void loadPage(page + 1).catch(() => {
      /* o sentinel tenta de novo se a pré-carga falhar */
    });
  }, [paused, speculativeLoading, hasMore, loadPage, page, position]);

  useEffect(() => {
    return () => {
      requestGenerationRef.current += 1;
      abortRef.current?.abort();
      inflightRef.current = null;
      inflightPageRef.current = 0;
      loadingRef.current = false;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (paused || loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    const generation = requestGenerationRef.current;
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
      if (generation !== requestGenerationRef.current) return;
      bufferRef.current = null;
      setVehicles((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...incoming.filter((item) => !seen.has(item.id))];
      });
      setPage(nextPage);
    } catch (error) {
      if (generation !== requestGenerationRef.current || (error as { name?: string }).name === "AbortError") return;
      setFailed(true);
    } finally {
      if (generation === requestGenerationRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [paused, hasMore, loadPage, page]);

  useEffect(() => {
    if (position && page < returnPage && hasMore && !failed && !loading) void loadMore();
  }, [position, page, returnPage, hasMore, failed, loading, loadMore]);

  useEffect(() => {
    if (!position || (page < returnPage && hasMore)) return;
    const finish = () => {
      clearStockPosition(position);
      setPosition(null);
    };
    if (!listRef.current) {
      finish();
      return;
    }
    return restoreStockPosition(position, listRef.current, finish);
  }, [position, page, returnPage, hasMore]);

  if (initialVehicles.length === 0) return <>{empty}</>;

  return (
    <>
      <StockReturnCapture returnTo={returnTo} page={page} containerRef={listRef}>
        <HideStockCardInterest>
          <MemoVehicleGrid
            vehicles={vehicles}
            returnTo={returnTo}
            priorityCount={2}
            photoLayout="stock"
          />
        </HideStockCardInterest>
      </StockReturnCapture>

      {hasMore ? (
        <InfiniteSentinel
          onVisible={loadMore}
          disabled={paused || loading || failed || Boolean(position)}
          rootMargin={speculativeLoading ? "320px 0px" : "0px"}
        >
          {loading ? (
            <div aria-live="polite">
              <p className="mb-3 flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-muted">
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-r-transparent"
                  aria-hidden="true"
                />
                Carregando mais veículos…
              </p>
              <VehicleCardSkeletonGrid count={2} largePhoto />
            </div>
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
