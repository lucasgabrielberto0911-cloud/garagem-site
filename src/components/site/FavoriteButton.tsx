"use client";

import { useState } from "react";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useFavorites } from "@/lib/favorites";
import { trackAddToWishlist, trackPwaEvent } from "@/lib/meta-pixel";
import { enqueueIntent } from "@/lib/offline-queue";

export function FavoriteButton({
  vehicleId,
  label,
  value,
  make,
  model,
  year,
  variant = "icon",
  size = "md",
  appearance = "ghost",
  className = "",
}: {
  vehicleId: string;
  label: string;
  value?: number;
  make?: string;
  model?: string;
  year?: number;
  variant?: "icon" | "full";
  size?: "sm" | "md";
  /** `ghost`: ícone pequeno, alvo de 44px, sem caixa — para o card do estoque. */
  appearance?: "chip" | "ghost";
  className?: string;
}) {
  const { has, toggle, ready } = useFavorites();
  const [pulse, setPulse] = useState(false);
  const active = ready && has(vehicleId);

  function applyToggle() {
    try {
      const added = toggle(vehicleId);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        void enqueueIntent({ type: "favorite", vehicleId, added });
        trackPwaEvent("PwaOfflineQueued", { kind: "favorite" });
      }
      if (added) {
        trackAddToWishlist({
          content_ids: [vehicleId],
          content_name: label,
          value,
          make,
          model,
          year,
        });
      }
      setPulse(true);
      window.setTimeout(() => setPulse(false), 320);
      notifySuccess(
        added ? `${label} salvo nos favoritos` : `${label} removido dos favoritos`,
        added
          ? {
              action: (
                <a href="/favoritos">Ver lista</a>
              ),
            }
          : {
              action: {
                label: "Desfazer",
                onClick: () => toggle(vehicleId),
              },
            },
      );
    } catch {
      notifyError("Não foi possível atualizar os favoritos neste aparelho.", {
        action: {
          label: "Tentar de novo",
          onClick: () => applyToggle(),
        },
      });
    }
  }

  function onClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    applyToggle();
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

  const compact = size === "sm";
  const ghost = appearance === "ghost";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `Remover ${label} dos favoritos` : `Salvar ${label} nos favoritos`}
      className={`flex items-center justify-center transition touch-manipulation ${
        ghost
          ? "relative z-20 inline-flex h-11 w-11 shrink-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
          : `border backdrop-blur ${compact ? "h-11 w-11" : "h-11 w-11"}`
      } ${
        ghost
          ? active
            ? "text-brand"
            : "text-cream/90 hover:text-brand"
          : active
            ? "border-brand bg-brand/20 text-brand"
            : "border-white/20 bg-asphalt/70 text-cream hover:border-brand"
      } ${className}`}
    >
      <Heart
        filled={active}
        className={`${ghost ? "h-4 w-4" : compact ? "h-3.5 w-3.5" : "h-4 w-4"} ${
          pulse ? "animate-fade-in-scale" : ""
        }`}
      />
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
