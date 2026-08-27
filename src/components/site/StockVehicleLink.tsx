"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export const STOCK_RETURN_KEY = "garagem:estoque-volta";

export function rememberStockReturn(path?: string) {
  try {
    if (!path || !path.startsWith("/estoque")) {
      sessionStorage.removeItem(STOCK_RETURN_KEY);
      return;
    }
    sessionStorage.setItem(STOCK_RETURN_KEY, path);
  } catch {
    // private mode / storage blocked
  }
}

export function readStockReturn() {
  try {
    const value = sessionStorage.getItem(STOCK_RETURN_KEY);
    if (
      !value ||
      !value.startsWith("/estoque") ||
      value.startsWith("//") ||
      value.includes("\\")
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/**
 * Link do card: não faz prefetch de 12 anúncios de uma vez.
 * Guarda o filtro atual para o botão Voltar no anúncio.
 */
export function StockVehicleLink({
  href,
  returnTo,
  ariaLabel,
  children,
}: {
  href: string;
  returnTo?: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={ariaLabel}
      onClick={() => {
        rememberStockReturn(returnTo);
        try {
          sessionStorage.setItem("garagem:estoque-scroll", String(window.scrollY));
        } catch {
          // private mode
        }
      }}
      className="flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
    >
      {children}
    </Link>
  );
}
