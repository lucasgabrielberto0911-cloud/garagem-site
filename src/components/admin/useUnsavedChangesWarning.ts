"use client";

import { useEffect } from "react";

export const UNSAVED_CHANGES_MESSAGE =
  "Você tem alterações não salvas. Sair mesmo assim?";

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
 * o botão Voltar consome essa entrada, disparamos o confirm e, se a pessoa
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
  if (window.confirm(UNSAVED_CHANGES_MESSAGE)) {
    leaving = true;
    sentinelUrl = null;
    window.history.go(-1);
    window.setTimeout(() => {
      leaving = false;
    }, 500);
  } else {
    pushSentinel();
  }
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
  if (!window.confirm(UNSAVED_CHANGES_MESSAGE)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (!sentinelUrl) return;
  // Já confirmado: tira a entrada extra antes de seguir para o link, para o Voltar da próxima tela não cair no formulário de novo.
  event.preventDefault();
  event.stopPropagation();
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
