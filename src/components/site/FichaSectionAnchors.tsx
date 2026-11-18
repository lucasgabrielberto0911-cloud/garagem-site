"use client";

import { useEffect } from "react";
import {
  fichaSectionLinks,
  fichaSectionScrollTop,
  focusFichaSection,
} from "@/lib/ficha-sections";

function visibleSection(id: string) {
  const nodes = document.querySelectorAll<HTMLElement>(
    `[data-ficha-section="${id}"]`,
  );
  for (const node of nodes) {
    if (node.getClientRects().length > 0) return node;
  }
  return null;
}

/**
 * O id único fica no bloco visível. No celular a ficha e o texto estão
 * no dossiê; no desktop, na coluna e abaixo da foto. Os dois existem no
 * HTML, mas só um tem layout.
 */
function placeSectionIds(ids: readonly string[]) {
  for (const id of ids) {
    const nodes = [
      ...document.querySelectorAll<HTMLElement>(`[data-ficha-section="${id}"]`),
    ];
    const visible =
      nodes.length === 1
        ? nodes[0]
        : nodes.find((node) => node.getClientRects().length > 0);
    if (!visible) continue;
    for (const node of nodes) {
      if (node === visible) node.id = id;
      else if (node.id === id) node.removeAttribute("id");
    }
  }
}

function reveal(target: HTMLElement) {
  const details =
    target instanceof HTMLDetailsElement ? target : target.closest("details");
  if (details && !details.open) details.open = true;
}

export function focusSectionTarget(target: HTMLElement) {
  try {
    focusFichaSection(target);
  } catch {
    // Ambientes sem suporte a preventScroll.
  }
}

/** Linha livre abaixo do header do site, a única coisa fixa no topo. */
function fixedTop() {
  const header = document.querySelector("header");
  return Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
}

function scrollToSection(id: string) {
  const target = visibleSection(id);
  if (!target) return;
  reveal(target);
  const top = fichaSectionScrollTop(
    target.getBoundingClientRect().top,
    fixedTop(),
    window.scrollY,
  );
  window.scrollTo({ top, behavior: "auto" });
  focusSectionTarget(target);
}

/**
 * Sem abas visíveis (a ficha é um scroll só), mas os links com
 * #fotos, #especificacoes e #detalhes continuam caindo no bloco certo.
 */
export function FichaSectionAnchors({ hasDetails }: { hasDetails: boolean }) {
  useEffect(() => {
    const ids: string[] = fichaSectionLinks(hasDetails).map((section) => section.id);
    let frameId = 0;
    let idleId = 0;
    let timerId = 0;

    const schedulePlace = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        placeSectionIds(ids);
      });
    };

    const hash = window.location.hash.replace(/^#/, "");
    if (ids.includes(hash)) {
      placeSectionIds(ids);
      scrollToSection(hash);
    } else if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(() => placeSectionIds(ids), { timeout: 1500 });
    } else {
      timerId = window.setTimeout(() => placeSectionIds(ids), 250);
    }

    const onHashChange = () => {
      const nextHash = window.location.hash.replace(/^#/, "");
      if (ids.includes(nextHash)) {
        placeSectionIds(ids);
        scrollToSection(nextHash);
      }
    };

    const media = window.matchMedia("(min-width: 1024px)");
    window.addEventListener("resize", schedulePlace, { passive: true });
    window.addEventListener("hashchange", onHashChange);
    media.addEventListener("change", schedulePlace);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timerId) window.clearTimeout(timerId);
      window.removeEventListener("resize", schedulePlace);
      window.removeEventListener("hashchange", onHashChange);
      media.removeEventListener("change", schedulePlace);
    };
  }, [hasDetails]);

  return null;
}
