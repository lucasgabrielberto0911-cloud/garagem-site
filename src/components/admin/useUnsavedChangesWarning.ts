"use client";

import { createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const UNSAVED_CHANGES_MESSAGE =
  "Você tem alterações não salvas. Sair mesmo assim?";

type Confirmer = (message: string) => Promise<boolean>;

let customConfirmer: Confirmer | null = null;
let activeConfirmPromise: Promise<boolean> | null = null;

/** Permite injetar confirmador customizado em testes ou ambientes sem DOM completo. */
export function setUnsavedChangesConfirmer(confirmer: Confirmer | null) {
  customConfirmer = confirmer;
}

/** Troca o window.confirm pelo ConfirmDialog padrão do painel. */
export function confirmUnsavedChanges(
  message = UNSAVED_CHANGES_MESSAGE,
): Promise<boolean> {
  if (customConfirmer) return customConfirmer(message);
  if (typeof document === "undefined") return Promise.resolve(true);
  if (activeConfirmPromise) return activeConfirmPromise;

  activeConfirmPromise = new Promise<boolean>((resolve) => {
    const container = document.createElement("div");
    container.setAttribute("data-unsaved-dialog", "true");
    document.body.appendChild(container);

    const root = createRoot(container);

    function handleClose(confirmed: boolean) {
      try {
        root.unmount();
      } catch {}
      container.remove();
      activeConfirmPromise = null;
      resolve(confirmed);
    }

    root.render(
      createElement(ConfirmDialog, {
        open: true,
        title: "Descartar alterações?",
        description: message,
        confirmLabel: "Descartar",
        cancelLabel: "Continuar editando",
        danger: true,
        onConfirm: () => handleClose(true),
        onCancel: () => handleClose(false),
      }),
    );
  });

  return activeConfirmPromise;
}

function isInternalNavigation(anchor: HTMLAnchorElement, event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return (
    url.pathname !== window.location.pathname ||
    url.search !== window.location.search
  );
}

/*
 * Guarda compartilhada (vários formulários sujos ao mesmo tempo contam como um).
 *
 * Voltar/Avançar do navegador não passa por clique em link nem por beforeunload
 * quando a navegação é do App Router. Para poder perguntar, enquanto algum
 * formulário está sujo mantemos UMA entrada extra no histórico (mesma URL):
 * o botão Voltar consome essa entrada, disparamos a confirmação e, se a pessoa
 * ficar, a entrada é recriada. Sem mexer em history.pushState/replaceState
 * globais: só chamamos a API padrão uma vez por estado sujo.
 */
let dirtyCount = 0;
let sentinelUrl: string | null = null;
let leaving = false;
let skipNextClick = false;

function pushSentinel() {
  window.history.pushState(window.history.state, "");
  sentinelUrl = window.location.href;
}

function popSentinel() {
  if (!sentinelUrl) return;
  const url = sentinelUrl;
  sentinelUrl = null;
  // Só desfaz se continuamos na mesma tela; se a rota mudou, a navegação já cuidou do histórico.
  window.setTimeout(() => {
    if (window.location.href === url && !leaving) window.history.go(-1);
  }, 0);
}

function onPopState(event: PopStateEvent) {
  if (leaving || !sentinelUrl || dirtyCount === 0) return;
  // Voltamos da entrada extra para a entrada original (mesma URL): é o gesto Voltar.
  if (window.location.href !== sentinelUrl) {
    sentinelUrl = null;
    return;
  }
  event.stopImmediatePropagation();
  void confirmUnsavedChanges(UNSAVED_CHANGES_MESSAGE).then((confirmed) => {
    if (confirmed) {
      leaving = true;
      sentinelUrl = null;
      window.history.go(-1);
      window.setTimeout(() => {
        leaving = false;
      }, 500);
    } else {
      pushSentinel();
    }
  });
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = "";
}

function onClick(event: MouseEvent) {
  if (skipNextClick) {
    skipNextClick = false;
    return;
  }
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (!isInternalNavigation(anchor, event)) return;

  event.preventDefault();
  event.stopPropagation();

  void confirmUnsavedChanges(UNSAVED_CHANGES_MESSAGE).then((confirmed) => {
    if (!confirmed) return;
    if (!sentinelUrl) {
      skipNextClick = true;
      anchor.click();
      return;
    }
    // Já confirmado: tira a entrada extra antes de seguir para o link, para o Voltar da próxima tela não cair no formulário de novo.
    leaving = true;
    sentinelUrl = null;
    let done = false;
    const proceed = () => {
      if (done) return;
      done = true;
      window.removeEventListener("popstate", proceed);
      window.setTimeout(() => {
        leaving = false;
        skipNextClick = true;
        anchor.click();
      }, 0);
    };
    window.addEventListener("popstate", proceed);
    window.setTimeout(proceed, 600);
    window.history.go(-1);
  });
}

function activate() {
  dirtyCount += 1;
  skipNextClick = false;
  if (dirtyCount > 1) return;
  window.addEventListener("beforeunload", onBeforeUnload);
  document.addEventListener("click", onClick, true);
  window.addEventListener("popstate", onPopState, true);
  pushSentinel();
}

function deactivate() {
  dirtyCount = Math.max(0, dirtyCount - 1);
  if (dirtyCount > 0) return;
  window.removeEventListener("beforeunload", onBeforeUnload);
  document.removeEventListener("click", onClick, true);
  window.removeEventListener("popstate", onPopState, true);
  popSentinel();
}

/**
 * Aviso ao sair com o formulário sujo: fechar/recarregar a aba (beforeunload),
 * cliques em links internos e o gesto Voltar do navegador. Salvar nunca passa
 * por aqui. Cancelar a saída conserva o conteúdo digitado.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    activate();
    return deactivate;
  }, [dirty]);
}
