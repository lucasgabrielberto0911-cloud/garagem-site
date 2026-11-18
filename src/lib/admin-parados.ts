import { buildVehicleFullLabel } from "@/lib/vehicle-display";
import { vehiclePath } from "@/lib/vehicle-slug";

const DAY_MS = 1000 * 60 * 60 * 24;

/** Limiar exclusivo: entram veículos disponíveis há mais de 30 dias (> 30). */
export const PARKED_MIN_DAYS = 30;

/** Ação já gravada por /api/funil em AdminAudit nas visitas às fichas do site. */
export const SITE_VISIT_ACTION = "site:visita" as const;

/**
 * Campos lidos do veículo para a lista de carros parados.
 * Nunca inclui placa, final de placa, chassi nem RENAVAM.
 */
export const PARKED_VEHICLE_SELECT = {
  id: true,
  brand: true,
  model: true,
  version: true,
  yearModel: true,
  price: true,
  status: true,
  historical: true,
  createdAt: true,
} as const;

export type ParkedVehicleCandidate = {
  id: string;
  brand: string;
  model: string;
  version?: string | null;
  yearModel: number;
  price: number;
  status: string;
  historical?: boolean | null;
  createdAt: Date | string;
  stockEnteredAt?: Date | string | null;
};

export type ParkedVehicleItem = {
  id: string;
  name: string;
  brand: string;
  model: string;
  version: string | null;
  yearModel: number;
  price: number;
  enteredAt: string;
  daysParked: number;
  views: number;
  publicPath: string;
};

export function resolveVehicleEnteredAt(input: {
  createdAt: Date | string;
  stockEnteredAt?: Date | string | null;
}): Date {
  const raw = input.stockEnteredAt ?? input.createdAt;
  return raw instanceof Date ? raw : new Date(raw);
}

/** Calcula dias completos no estoque desde a entrada/criação do veículo. */
export function calculateParkedDays(
  enteredAt: Date | string,
  now: Date = new Date(),
): number {
  const start = enteredAt instanceof Date ? enteredAt : new Date(enteredAt);
  const end = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_MS));
}

/**
 * Data máxima de entrada para ter estritamente mais de `minDays` dias completos:
 * `Math.floor((now - enteredAt) / DAY_MS) > minDays` <=> `enteredAt <= now - (minDays + 1) * DAY_MS`.
 */
export function parkedCutoffDate(
  minDays = PARKED_MIN_DAYS,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() - (minDays + 1) * DAY_MS);
}

function isViewCountMap(
  value: ReadonlyMap<string, number> | Record<string, number>,
): value is ReadonlyMap<string, number> {
  return typeof (value as ReadonlyMap<string, number>).get === "function";
}

function readViewCount(
  viewsByVehicleId:
    | ReadonlyMap<string, number>
    | Record<string, number>
    | undefined,
  vehicleId: string,
): number {
  if (!viewsByVehicleId) return 0;
  const raw = isViewCountMap(viewsByVehicleId)
    ? viewsByVehicleId.get(vehicleId)
    : viewsByVehicleId[vehicleId];
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return 0;
  return Math.floor(raw);
}

/**
 * Filtra veículos disponíveis (não vendidos, não reservados e não históricos)
 * com mais de `minDays` dias no estoque e ordena por dias parado decrescente.
 */
export function filterParkedVehicles(
  vehicles: readonly ParkedVehicleCandidate[],
  options: {
    now?: Date;
    minDays?: number;
    viewsByVehicleId?: ReadonlyMap<string, number> | Record<string, number>;
  } = {},
): ParkedVehicleItem[] {
  const now = options.now ?? new Date();
  const minDays = options.minDays ?? PARKED_MIN_DAYS;
  const ranked: Array<{ item: ParkedVehicleItem; enteredMs: number }> = [];

  for (const vehicle of vehicles) {
    if (vehicle.status !== "disponivel") continue;
    if (vehicle.historical === true) continue;

    const enteredDate = resolveVehicleEnteredAt(vehicle);
    const enteredMs = enteredDate.getTime();
    if (Number.isNaN(enteredMs)) continue;

    const daysParked = calculateParkedDays(enteredDate, now);
    if (daysParked <= minDays) continue;

    ranked.push({
      enteredMs,
      item: {
        id: vehicle.id,
        name: buildVehicleFullLabel(vehicle),
        brand: vehicle.brand,
        model: vehicle.model,
        version: vehicle.version ?? null,
        yearModel: vehicle.yearModel,
        price: vehicle.price,
        enteredAt: enteredDate.toISOString(),
        daysParked,
        views: readViewCount(options.viewsByVehicleId, vehicle.id),
        publicPath: vehiclePath(vehicle),
      },
    });
  }

  ranked.sort(
    (a, b) =>
      b.item.daysParked - a.item.daysParked ||
      a.enteredMs - b.enteredMs ||
      a.item.name.localeCompare(b.item.name, "pt-BR") ||
      a.item.id.localeCompare(b.item.id),
  );

  return ranked.map((entry) => entry.item);
}
