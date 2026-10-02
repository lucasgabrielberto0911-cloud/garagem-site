import { useEffect, type RefObject } from "react";

/** Mostra a confirmação inteira abaixo do cabeçalho e anuncia o resultado. */
export function focusFormFeedback(element: HTMLElement | null) {
  if (!element) return;
  const frame = window.requestAnimationFrame(() => {
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "start", behavior: "instant" });
  });
  return () => window.cancelAnimationFrame(frame);
}

/** O teclado e as barras fixas não podem encobrir o campo em edição. */
export function useFormViewport(formRef: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    let frame = 0;
    const reveal = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!window.matchMedia("(max-width: 1023px)").matches) return;
        const field = document.activeElement;
        if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
        if (!formRef.current?.contains(field)) return;
        const viewport = window.visualViewport;
        if (viewport && viewport.scale !== 1) return;
        const viewportTop = viewport?.offsetTop ?? 0;
        const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
        const header = document.querySelector("header")?.getBoundingClientRect();
        const nav = document.querySelector("[data-mobile-bottom-nav]")?.getBoundingClientRect();
        const consent = document.querySelector(".site-consent")?.getBoundingClientRect();
        const top = Math.max(viewportTop + 12, (header?.bottom ?? 0) + 12);
        let bottom = viewportBottom - 12;
        for (const bar of [nav, consent]) {
          if (bar && bar.bottom > viewportTop && bar.top < viewportBottom) bottom = Math.min(bottom, bar.top - 12);
        }
        if (bottom <= top) return;
        const rect = field.getBoundingClientRect();
        const label = field.labels?.[0]?.getBoundingClientRect();
        const fieldTop = label ? Math.min(rect.top, label.top) : rect.top;
        let fieldBottom = rect.bottom;
        for (const id of (field.getAttribute("aria-describedby") ?? "").split(/\s+/)) {
          const description = document.getElementById(id)?.getBoundingClientRect();
          if (description) fieldBottom = Math.max(fieldBottom, description.bottom);
        }
        const delta = fieldTop < top ? fieldTop - top : fieldBottom > bottom ? fieldBottom - bottom : 0;
        if (delta) window.scrollBy({ top: delta, behavior: "instant" });
      });
    };
    document.addEventListener("focusin", reveal);
    window.addEventListener("resize", reveal);
    window.visualViewport?.addEventListener("resize", reveal);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("focusin", reveal);
      window.removeEventListener("resize", reveal);
      window.visualViewport?.removeEventListener("resize", reveal);
    };
  }, [formRef]);
}
