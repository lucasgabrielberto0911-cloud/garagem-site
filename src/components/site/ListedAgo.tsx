"use client";

import { useSyncExternalStore } from "react";
import { formatListedAgo } from "@/lib/format";

function subscribe() {
  return () => {};
}

/**
 * A idade relativa depende do relógio. No HTML do ISR fica só o trecho estável
 * (`updatedLabel`); "Anunciado há N dias" entra depois da hidratação.
 */
export function ListedAgo({
  listedAt,
  updatedLabel = "",
}: {
  listedAt?: string | null;
  updatedLabel?: string;
}) {
  const relative = useSyncExternalStore(
    subscribe,
    () => (listedAt ? formatListedAgo(listedAt) : ""),
    () => "",
  );
  const line = [relative, updatedLabel].filter(Boolean).join(" · ");
  if (!line) return null;
  return <span className="inline">{line}</span>;
}
