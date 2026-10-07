"use client";

import { useEffect } from "react";
import { writeFavoriteSnapshots, type FavoriteSnapshot } from "@/lib/offline-queue";

// Só é preenchido nos efeitos do navegador. Coalesce os cards do mesmo commit.
const pending = new Map<string, FavoriteSnapshot>();
let scheduled = false;

function remember(vehicle: FavoriteSnapshot) {
  pending.set(vehicle.id, vehicle);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    const vehicles = [...pending.values()];
    pending.clear();
    scheduled = false;
    writeFavoriteSnapshots(vehicles);
  });
}

export function RememberVehicleSnapshot({ vehicle }: { vehicle: FavoriteSnapshot }) {
  useEffect(() => {
    remember(vehicle);
    // snapshot is rebuilt no servidor; o id é a chave estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);
  return null;
}
