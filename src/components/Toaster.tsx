"use client";

import { useEffect, useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import { subscribeToasterRequest } from "@/lib/notify";

/**
 * O sonner fica fora do JS da primeira pintura. No site público ele
 * entra no primeiro aviso. No painel entra junto com a página.
 */
export function AppToaster() {
  const pathname = usePathname();
  const [Toaster, setToaster] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    let started = false;

    function load() {
      if (started) return;
      started = true;
      void import("@/components/SonnerToaster").then((mod) => {
        if (!cancelled) setToaster(() => mod.SonnerToaster);
      });
    }

    const unsubscribe = subscribeToasterRequest(load);
    if (pathname.startsWith("/admin")) load();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [pathname]);

  if (!Toaster) return null;
  return <Toaster />;
}
