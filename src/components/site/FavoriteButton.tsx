"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useFavorites } from "@/lib/favorites";

export function FavoriteButton({
  vehicleId,
  label,
  variant = "icon",
  className = "",
}: {
  vehicleId: string;
  label: string;
  variant?: "icon" | "full";
  className?: string;
}) {
  const { has, toggle, ready } = useFavorites();
  const [pulse, setPulse] = useState(false);
  const active = ready && has(vehicleId);

  function onClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const added = toggle(vehicleId);
    setPulse(true);
    window.setTimeout(() => setPulse(false), 320);
    toast.success(
      added ? `${label} salvo nos favoritos` : `${label} removido dos favoritos`,
    );
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`inline-flex min-h-[48px] items-center justify-center gap-2 border px-5 font-display text-xs font-semibold uppercase tracking-wide transition touch-manipulation sm:text-sm ${
          active
            ? "border-brand bg-brand/10 text-brand"
            : "border-white/20 text-cream hover:border-brand hover:bg-white/5"
        } ${className}`}
      >
        <Heart filled={active} className={`h-4 w-4 ${pulse ? "animate-fade-in-scale" : ""}`} />
        {active ? "Salvo nos favoritos" : "Salvar nos favoritos"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `Remover ${label} dos favoritos` : `Salvar ${label} nos favoritos`}
      className={`flex h-10 w-10 items-center justify-center border backdrop-blur transition touch-manipulation ${
        active
          ? "border-brand bg-brand/20 text-brand"
          : "border-white/20 bg-asphalt/70 text-cream hover:border-brand"
      } ${className}`}
    >
      <Heart filled={active} className={`h-[18px] w-[18px] ${pulse ? "animate-fade-in-scale" : ""}`} />
    </button>
  );
}

function Heart({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.6-7-9.6A4.4 4.4 0 0112 7a4.4 4.4 0 017 3.4c0 5-7 9.6-7 9.6z" />
    </svg>
  );
}
