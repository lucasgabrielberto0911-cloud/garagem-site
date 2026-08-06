"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveal barato: opacity curta, fallback rápido, sem atrasar o LCP.
 */
export function ScrollReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setVisible(true);
      return;
    }

    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      if (delay <= 0) {
        setVisible(true);
        return;
      }
      window.setTimeout(() => setVisible(true), delay);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        show();
        observer.disconnect();
      },
      { threshold: 0.08, rootMargin: "40px 0px" },
    );

    observer.observe(node);
    const fallback = window.setTimeout(show, 600 + delay);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`transition-opacity duration-300 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
