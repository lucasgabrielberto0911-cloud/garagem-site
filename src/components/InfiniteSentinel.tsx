"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Dispara `onVisible` quando o marcador entra na tela (com folga).
 * Usado na rolagem infinita do estoque público e das listas do admin.
 */
export function InfiniteSentinel({
  onVisible,
  disabled = false,
  rootMargin = "720px 0px",
  children,
}: {
  onVisible: () => void;
  disabled?: boolean;
  rootMargin?: string;
  children?: ReactNode;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    if (disabled) return;
    const node = nodeRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onVisibleRef.current();
      },
      { root: null, rootMargin, threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled, rootMargin]);

  return (
    <div ref={nodeRef} className="flex flex-col items-center justify-center py-6">
      {children}
    </div>
  );
}
