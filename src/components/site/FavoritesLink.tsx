"use client";

import Link from "next/link";
import { useFavoritesState } from "@/lib/favorites";

export function FavoritesLink({ className = "" }: { className?: string }) {
  const { count } = useFavoritesState();
  const hasItems = count > 0;
  const label =
    hasItems
      ? `Favoritos (${count} ${count === 1 ? "veículo" : "veículos"})`
      : "Favoritos";

  return (
    <Link
      href="/favoritos"
      prefetch={false}
      aria-label={label}
      className={`relative inline-flex h-11 w-11 items-center justify-center gap-2 border border-white/15 text-cream transition hover:border-brand active:bg-white/10 touch-manipulation focus-visible:border-brand 2xl:w-auto 2xl:px-3 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={hasItems ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-5 w-5 ${hasItems ? "text-brand-light" : ""}`}
        aria-hidden="true"
      >
        <path d="M12 20s-7-4.6-7-9.6A4.4 4.4 0 0112 7a4.4 4.4 0 017 3.4c0 5-7 9.6-7 9.6z" />
      </svg>
      <span className="hidden font-display text-xs font-semibold uppercase tracking-wide 2xl:inline">
        Favoritos
      </span>
      {hasItems ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white 2xl:static 2xl:ml-0.5">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
