"use client";

import { useEffect } from "react";
import { writeFavoriteSnapshot, type FavoriteSnapshot } from "@/lib/offline-queue";

export function RememberVehicleSnapshot({ vehicle }: { vehicle: FavoriteSnapshot }) {
  useEffect(() => {
    writeFavoriteSnapshot(vehicle);
    // snapshot is rebuilt no servidor; o id é a chave estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);
  return null;
}
