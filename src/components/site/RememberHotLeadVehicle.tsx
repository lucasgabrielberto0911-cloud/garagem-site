"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getHotLeadCarsSnapshot,
  getHotLeadServerSnapshot,
  rememberHotLeadViewedCar,
  subscribeHotLeadCars,
  type HotLeadViewedCar,
} from "@/lib/hot-lead";

function noopSubscribe() {
  return () => {};
}

export function useHotLeadViewedCars(
  enabled = true,
): readonly HotLeadViewedCar[] {
  return useSyncExternalStore(
    enabled ? subscribeHotLeadCars : noopSubscribe,
    enabled ? getHotLeadCarsSnapshot : getHotLeadServerSnapshot,
    getHotLeadServerSnapshot,
  );
}

/**
 * Registra no localStorage (somente ao abrir a ficha /estoque/[slug])
 * os últimos carros vistos (slug, nome, ano, link; até 5, sem duplicar, mais recente primeiro).
 * Se o veículo estiver vendido, não inclui e remove eventual entrada anterior dele.
 */
export function RememberHotLeadVehicle({
  slug,
  name,
  year,
  link,
  sold = false,
}: {
  slug: string;
  name: string;
  year: number;
  link: string;
  sold?: boolean;
}) {
  useEffect(() => {
    rememberHotLeadViewedCar({ slug, name, year, link, sold });
  }, [slug, name, year, link, sold]);

  return null;
}
