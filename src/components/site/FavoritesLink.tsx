"use client";

import Link from "next/link";
import { useFavorites } from "@/lib/favorites";

export function FavoritesLink({ className = "" }: { className?: string }) {
  const { count, ready } = useFavorites();

  return (
    <Link
      href="/favoritos"
      aria-label={
        count > 0
          ? `Favoritos (${count} ${count === 1 ? "veículo" : "veículos"})`
          : "Favoritos"
      }
      className={`relative inline-flex h-11 w-11 items-center justify-center border border-white/15 text-cream transition hover:border-brand active:bg-white/10 touch-manipulation ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={ready && count > 0 ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-5 w-5 ${ready && count > 0 ? "text-brand" : ""}`}
        aria-hidden="true"
      >
        <path d="M12 20s-7-4.6-7-9.6A4.4 4.4 0 0112 7a4.4 4.4 0 017 3.4c0 5-7 9.6-7 9.6z" />
      </svg>
      {ready && count > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
