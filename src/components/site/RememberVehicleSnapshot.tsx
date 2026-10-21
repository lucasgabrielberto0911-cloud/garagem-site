"use client";

import { useEffect } from "react";
import { readFavoriteIds } from "@/lib/favorites";
import { writeFavoriteSnapshots, type FavoriteSnapshot } from "@/lib/offline-queue";

// Só é preenchido nos efeitos do navegador. Coalesce os favoritos ativos do mesmo commit.
const pending = new Map<string, FavoriteSnapshot>();
let scheduled = false;

export function rememberFavoriteSnapshot(vehicle: FavoriteSnapshot, force = false) {
  if (!force) {
    const favorites = readFavoriteIds();
    if (!favorites.includes(vehicle.id)) return;
  }
  pending.set(vehicle.id, vehicle);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
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
