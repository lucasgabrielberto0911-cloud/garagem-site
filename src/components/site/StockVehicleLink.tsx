import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Link do card: não faz prefetch de 12 anúncios de uma vez.
 * O filtro/scroll da listagem fica em StockReturnCapture.
 */
export function StockVehicleLink({
  href,
  className = "",
  children,
  ariaLabel,
  "aria-label": ariaLabelAttr,
}: {
  href: string;
  returnTo?: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  "aria-label"?: string;
}) {
  const accessibleLabel = ariaLabelAttr ?? ariaLabel;
  return (
    <Link
      href={href}
      prefetch={false}
      data-stock-card=""
      aria-label={accessibleLabel}
      className={`flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt ${className}`}
    >
      {children}
    </Link>
  );
}
