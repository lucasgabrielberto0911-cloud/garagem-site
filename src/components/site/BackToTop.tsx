"use client";

import { useEffect, useState } from "react";

/** Desktop: acima do float do WhatsApp. Não monta no viewport mobile. */
export function BackToTop() {
  const [desktop, setDesktop] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    function sync() {
      setDesktop(media.matches);
    }
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!desktop) return;

    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:absolute;top:0;left:0;height:640px;width:1px;pointer-events:none;visibility:hidden";
    document.body.prepend(sentinel);

    const observer = new IntersectionObserver(([entry]) => {
      setShow(!entry.isIntersecting);
    });
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, [desktop]);

  if (!desktop || !show) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Voltar ao topo"
      className="fixed bottom-40 right-6 z-40 hidden h-11 w-11 items-center justify-center border border-white/15 bg-ink text-cream shadow-lg transition hover:border-brand active:scale-95 touch-manipulation lg:flex"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M6 14l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
