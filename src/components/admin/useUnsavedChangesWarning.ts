"use client";

import { useEffect } from "react";

export const UNSAVED_CHANGES_MESSAGE =
  "Você tem alterações não salvas neste anúncio. Sair mesmo assim?";

function isInternalNavigation(anchor: HTMLAnchorElement, event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return (
    url.pathname !== window.location.pathname || url.search !== window.location.search
  );
}

/**
 * Aviso leve ao sair com o formulário sujo: fechar/recarregar a aba
 * (beforeunload) e cliques em links internos do painel (App Router não tem
 * evento de troca de rota). Salvar nunca passa por aqui.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function onClick(event: MouseEvent) {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isInternalNavigation(anchor, event)) return;
      if (window.confirm(UNSAVED_CHANGES_MESSAGE)) return;
      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
