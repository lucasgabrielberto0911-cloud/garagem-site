"use client";

import { useEffect } from "react";
import { readFavoriteIds } from "@/lib/favorites";
import { writeFavoriteSnapshots, type FavoriteSnapshot } from "@/lib/offline-queue";

// Só é preenchido nos efeitos do navegador. Coalesce os cards do mesmo commit em horário ocioso.
const pending = new Map<string, FavoriteSnapshot>();
let scheduled = false;

function scheduleFlush(callback: () => void) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 600 });
    return;
  }
  setTimeout(callback, 120);
}

export function rememberFavoriteSnapshot(vehicle: FavoriteSnapshot, force = false) {
  if (!force) {
    const favorites = readFavoriteIds();
    if (!favorites.includes(vehicle.id)) return;
  }
  pending.set(vehicle.id, vehicle);
  if (scheduled) return;
  scheduled = true;
  scheduleFlush(() => {
    const vehicles = [...pending.values()];
    pending.clear();
    scheduled = false;
    if (vehicles.length > 0) {
      writeFavoriteSnapshots(vehicles);
    }
  });
}

export function RememberVehicleSnapshot({ vehicle }: { vehicle: FavoriteSnapshot }) {
  useEffect(() => {
    rememberFavoriteSnapshot(vehicle);
    // snapshot is rebuilt no servidor; o id é a chave estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);
  return null;
}
