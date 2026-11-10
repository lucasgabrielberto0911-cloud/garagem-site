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
    const visible = nodes.find((node) => node.getClientRects().length > 0);
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
    placeSectionIds(ids);

    const hash = window.location.hash.replace(/^#/, "");
    if (ids.includes(hash)) scrollToSection(hash);

    const media = window.matchMedia("(min-width: 1024px)");
    const onMode = () => placeSectionIds(ids);
    window.addEventListener("resize", onMode);
    media.addEventListener("change", onMode);
    return () => {
      window.removeEventListener("resize", onMode);
      media.removeEventListener("change", onMode);
    };
  }, [hasDetails]);

  return null;
}
