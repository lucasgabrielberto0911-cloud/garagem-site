"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { recordLeadWhatsAppClick } from "@/app/admin/leads/actions";

export function LeadWhatsAppButton({
  leadId,
  href,
  className,
  children,
}: {
  leadId: string;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        startTransition(() => {
          void recordLeadWhatsAppClick(leadId).then((res) => {
            if (res.ok) router.refresh();
          });
        });
      }}
      className={className}
    >
      {children}
    </a>
  );
}
