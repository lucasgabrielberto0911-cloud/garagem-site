"use client";

import { useEffect, useRef } from "react";

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    let frame = 0;

    function update() {
      frame = 0;
      const total =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = total <= 0 ? 0 : Math.min(window.scrollY / total, 1);
      if (bar) bar.style.transform = `scaleX(${progress})`;
    }

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] origin-left"
      aria-hidden="true"
    >
      <div
        ref={barRef}
        className="h-full origin-left progress-brand will-change-transform"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
