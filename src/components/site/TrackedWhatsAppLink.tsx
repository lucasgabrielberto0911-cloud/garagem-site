"use client";

import type { ReactNode } from "react";
import { trackWhatsAppClick } from "@/lib/meta-pixel";

export function TrackedWhatsAppLink({
  href,
  trackingLabel,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  trackingLabel: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      onClick={() => trackWhatsAppClick(trackingLabel)}
      className={className}
    >
      {children}
    </a>
  );
}
