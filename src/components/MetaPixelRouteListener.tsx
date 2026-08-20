"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackPageView } from "@/lib/meta-pixel";

/**
 * PageView do carregamento inicial já sai no next/script.
 * Aqui só cobre troca de rota no App Router, sem repetir o primeiro render.
 */
export function MetaPixelRouteListener() {
  const pathname = usePathname();
  const isFirstPath = useRef(true);

  useEffect(() => {
    if (isFirstPath.current) {
      isFirstPath.current = false;
      return;
    }
    if (pathname.startsWith("/admin")) return;
    trackPageView();
  }, [pathname]);

  return null;
}
