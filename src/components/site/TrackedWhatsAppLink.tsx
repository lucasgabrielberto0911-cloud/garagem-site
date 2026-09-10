"use client";

import type { ReactNode } from "react";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { queueWhatsAppIfOffline } from "@/lib/offline-whatsapp";

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
      onClick={(event) => {
        trackWhatsAppClick(trackingLabel);
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          event.preventDefault();
          void queueWhatsAppIfOffline({ url: href, label: trackingLabel });
        }
      }}
      className={className}
    >
      {children}
    </a>
  );
}
