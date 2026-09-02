import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Link do card: não faz prefetch de 12 anúncios de uma vez.
 * O filtro/scroll da listagem fica em StockReturnCapture.
 */
export function StockVehicleLink({
  href,
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
      data-stock-card=""
      aria-label={ariaLabel}
      className="flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
    >
      {children}
    </Link>
  );
}
