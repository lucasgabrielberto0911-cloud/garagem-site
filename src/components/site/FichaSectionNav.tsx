"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  fichaSectionLinks,
  fichaSectionScrollTop,
  type FichaSectionId,
} from "@/lib/ficha-sections";

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

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

/**
 * Pula entre fotos, especificações e o texto do anúncio.
 * Não abre WhatsApp e não acrescenta bloco de preço.
 */
function scrollToSection(id: string, behavior: ScrollBehavior) {
  const target = visibleSection(id);
  if (!target) return false;
  reveal(target);
  const nav = document.querySelector(".ficha-section-nav");
  const navBottom = nav?.getBoundingClientRect().bottom ?? 0;
  const top = fichaSectionScrollTop(
    target.getBoundingClientRect().top,
    navBottom,
    window.scrollY,
  );
  window.scrollTo({ top, behavior });
  return true;
}

function sectionAtFold(sections: ReadonlyArray<{ id: FichaSectionId }>) {
  const nav = document.querySelector(".ficha-section-nav");
  const line = (nav?.getBoundingClientRect().bottom ?? 0) + 16;
  const reached: { id: FichaSectionId; top: number; left: number }[] = [];
  for (const section of sections) {
    const target = visibleSection(section.id);
    if (!target) continue;
    const rect = target.getBoundingClientRect();
    if (rect.top <= line) reached.push({ id: section.id, top: rect.top, left: rect.left });
  }
  if (reached.length === 0) return sections[0].id;
  const closest = Math.max(...reached.map((item) => item.top));
  const beside = reached.filter((item) => Math.abs(item.top - closest) <= 48);
  beside.sort((a, b) => a.left - b.left);
  return beside[0].id;
}

export function FichaSectionNav({ hasDetails }: { hasDetails: boolean }) {
  const sections = useMemo(() => fichaSectionLinks(hasDetails), [hasDetails]);
  const [current, setCurrent] = useState<FichaSectionId>(sections[0].id);
  const pinned = useRef<FichaSectionId | null>(null);

  useEffect(() => {
    const ids = sections.map((section) => section.id);
    placeSectionIds(ids);

    const hash = window.location.hash.replace(/^#/, "");
    if (ids.includes(hash as FichaSectionId)) {
      scrollToSection(hash, "auto");
      setCurrent(hash as FichaSectionId);
    }

    let frame = 0;
    function spy() {
      frame = 0;
      if (pinned.current) return;
      const next = sectionAtFold(sections);
      setCurrent((prev) => (prev === next ? prev : next));
    }

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(spy);
    }

    function releasePin() {
      if (!pinned.current) return;
      pinned.current = null;
      onScroll();
    }

    const media = window.matchMedia("(min-width: 1024px)");
    function onMode() {
      placeSectionIds(ids);
      onScroll();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onMode);
    window.addEventListener("wheel", releasePin, { passive: true });
    window.addEventListener("touchmove", releasePin, { passive: true });
    media.addEventListener("change", onMode);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onMode);
      window.removeEventListener("wheel", releasePin);
      window.removeEventListener("touchmove", releasePin);
      media.removeEventListener("change", onMode);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sections]);

  function onJump(event: MouseEvent<HTMLAnchorElement>, id: FichaSectionId) {
    event.preventDefault();
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    if (!scrollToSection(id, behavior)) return;
    pinned.current = id;
    setCurrent(id);
    const next = `${window.location.pathname}${window.location.search}#${id}`;
    window.history.replaceState(null, "", next);
  }

  return (
    <nav
      aria-label="Seções do anúncio"
      className="ficha-section-nav -mx-4 border-b border-white/10 bg-asphalt sm:-mx-6 lg:mx-0 lg:mt-4"
    >
      <ul className="flex">
        {sections.map((section) => {
          const active = current === section.id;
          return (
            <li key={section.id} className="flex min-w-0 flex-1">
              <a
                href={`#${section.id}`}
                aria-current={active ? "true" : undefined}
                onClick={(event) => onJump(event, section.id)}
                className={`-mb-px flex min-h-11 w-full items-center justify-center whitespace-nowrap border-b-2 px-1.5 font-display text-[11px] font-semibold uppercase tracking-wide transition touch-manipulation sm:px-3 sm:text-xs ${
                  active
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:text-cream"
                }`}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
