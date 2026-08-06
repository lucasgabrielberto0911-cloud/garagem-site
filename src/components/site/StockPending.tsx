"use client";

import {
  createContext,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from "react";
import { VehicleCardSkeletonGrid } from "@/components/site/VehicleCardSkeleton";

type StockPendingValue = {
  isPending: boolean;
  startTransition: TransitionStartFunction;
};

const StockPendingContext = createContext<StockPendingValue | null>(null);

export function StockPendingProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  const value = useMemo(
    () => ({ isPending, startTransition }),
    [isPending, startTransition],
  );

  return (
    <StockPendingContext.Provider value={value}>
      {children}
    </StockPendingContext.Provider>
  );
}

/** Filters use shared pending when wrapped; otherwise local transition. */
export function useStockPendingOptional(): StockPendingValue {
  const ctx = useContext(StockPendingContext);
  const [isPending, startTransition] = useTransition();
  if (ctx) return ctx;
  return { isPending, startTransition };
}

export function StockResultsPending({ children }: { children: ReactNode }) {
  const ctx = useContext(StockPendingContext);
  const isPending = ctx?.isPending ?? false;

  return (
    <div className="relative min-w-0" aria-busy={isPending}>
      <div
        className={
          isPending
            ? "pointer-events-none opacity-40 transition-opacity"
            : "transition-opacity"
        }
      >
        {children}
      </div>
      {isPending ? (
        <div
          className="absolute inset-0 z-10 overflow-hidden bg-asphalt/55 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
          aria-label="Atualizando resultados"
        >
          <div className="sticky top-28 flex flex-col gap-4 p-2 sm:p-0">
            <div className="flex items-center justify-center gap-2 py-3 lg:justify-start">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-r-transparent"
                aria-hidden="true"
              />
              <span className="font-display text-xs font-semibold uppercase tracking-wider text-cream">
                Atualizando estoque…
              </span>
            </div>
            <VehicleCardSkeletonGrid count={6} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Bridge so server-rendered children can sit inside the client provider. */
export function StockBrowseShell({
  filters,
  results,
}: {
  filters: ReactNode;
  results: ReactNode;
}) {
  return (
    <StockPendingProvider>
      <div className="mt-8 lg:grid lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className="lg:sticky lg:top-24">{filters}</aside>
        <StockResultsPending>{results}</StockResultsPending>
      </div>
    </StockPendingProvider>
  );
}
