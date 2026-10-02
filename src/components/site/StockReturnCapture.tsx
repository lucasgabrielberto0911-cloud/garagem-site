"use client";

import type { ReactNode, Ref } from "react";
import { rememberStockReturn, rememberStockPosition } from "@/lib/stock-return";

/**
 * Um único listener no grid: guarda filtro e scroll sem hidratar cada card.
 */
export function StockReturnCapture({
  returnTo,
  page = 1,
  containerRef,
  children,
}: {
  returnTo?: string;
  page?: number;
  containerRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div
      ref={containerRef}
      onClickCapture={(event) => {
        const target = event.target as HTMLElement | null;
        const link = target?.closest("a[data-stock-card]");
        if (!(link instanceof HTMLAnchorElement)) return;
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        rememberStockReturn(returnTo);
        if (returnTo) rememberStockPosition(returnTo, page, link, event.currentTarget);
      }}
    >
      {children}
    </div>
  );
}
