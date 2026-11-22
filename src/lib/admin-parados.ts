import { formatCurrencyBRL } from "@/lib/format";
import { buildVehicleFullLabel } from "@/lib/vehicle-display";
import { vehiclePath } from "@/lib/vehicle-slug";

const DAY_MS = 1000 * 60 * 60 * 24;

/** Limiar exclusivo: entram veículos disponíveis há mais de 30 dias (> 30). */
export const PARKED_MIN_DAYS = 30;

/** Janelas de leitura de visitas e cliques no WhatsApp em AdminAudit. */
export const PARKED_METRICS_WINDOW_DAYS = 30;
export const PARKED_RECENT_VISITS_DAYS = 7;

/** Ações já gravadas por /api/funil em AdminAudit nas fichas do site. */
export const SITE_VISIT_ACTION = "site:visita" as const;
export const SITE_WHATSAPP_ACTION = "site:whatsapp" as const;

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
  fipePrice: true,
  featured: true,
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
  fipePrice?: number | null;
  featured?: boolean;
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
  fipePrice: number | null;
  featured: boolean;
  enteredAt: string;
  daysParked: number;
  views: number;
  views7d: number;
  whatsappClicks: number;
  publicPath: string;
};

export type ParkedFunnelReading = {
  kind: "high-views-low-clicks" | "low-views";
  label: string;
  tone: "brand" | "neutral";
};

/**
 * Leitura simples de visitas (30d) e cliques no WhatsApp (30d), sem IA.
 * Retorna null quando a medição não está disponível ou quando o carro
 * tem bom volume de visitas e cliques.
 */
export function parkedFunnelReading(input: {
  views30d: number;
  whatsappClicks: number;
  viewsAvailable?: boolean;
}): ParkedFunnelReading | null {
  if (input.viewsAvailable === false) return null;

  const views = Math.max(0, Math.floor(input.views30d || 0));
  const clicks = Math.max(0, Math.floor(input.whatsappClicks || 0));

  if (views >= 10 && (clicks === 0 || clicks / views < 0.05)) {
    return {
      kind: "high-views-low-clicks",
      label: "Muita visita e pouco clique → rever preço ou fotos",
      tone: "brand",
    };
  }

  if (views < 10) {
    return {
      kind: "low-views",
      label: "Pouca visita → divulgar mais",
      tone: "neutral",
    };
  }

  return null;
}

export type FipeComparison = {
  fipeFormatted: string;
  diffPercent: number;
  deltaLabel: string;
  tone: "brand" | "neutral" | "success";
};

/**
 * Compara o preço anunciado com a FIPE salva no carro.
 * Retorna null quando não há FIPE salva (ou preço <= 0) — nunca inventa valor.
 */
export function formatFipeComparison(
  price: number,
  fipePrice: number | null | undefined,
): FipeComparison | null {
  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    fipePrice == null ||
    !Number.isFinite(fipePrice) ||
    fipePrice <= 0
  ) {
    return null;
  }

  const diffPercent = Math.round(((price - fipePrice) / fipePrice) * 100);
  const fipeFormatted = formatCurrencyBRL(fipePrice);

  if (diffPercent === 0) {
    return {
      fipeFormatted,
      diffPercent: 0,
      deltaLabel: "na FIPE",
      tone: "neutral",
    };
  }
  if (diffPercent > 0) {
    return {
      fipeFormatted,
      diffPercent,
      deltaLabel: `+${diffPercent}% da FIPE`,
      tone: diffPercent >= 8 ? "brand" : "neutral",
    };
  }
  return {
    fipeFormatted,
    diffPercent,
    deltaLabel: `${diffPercent}% da FIPE`,
    tone: "success",
  };
}

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

function isCountMap(
  value: ReadonlyMap<string, number> | Record<string, number>,
): value is ReadonlyMap<string, number> {
  return typeof (value as ReadonlyMap<string, number>).get === "function";
}

function readCount(
  countsByVehicleId:
    | ReadonlyMap<string, number>
    | Record<string, number>
    | undefined,
  vehicleId: string,
): number {
  if (!countsByVehicleId) return 0;
  const raw = isCountMap(countsByVehicleId)
    ? countsByVehicleId.get(vehicleId)
    : countsByVehicleId[vehicleId];
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
    views7dByVehicleId?: ReadonlyMap<string, number> | Record<string, number>;
    whatsappByVehicleId?: ReadonlyMap<string, number> | Record<string, number>;
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

    const fipePrice =
      typeof vehicle.fipePrice === "number" &&
      Number.isFinite(vehicle.fipePrice) &&
      vehicle.fipePrice > 0
        ? vehicle.fipePrice
        : null;

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
        fipePrice,
        featured: Boolean(vehicle.featured),
        enteredAt: enteredDate.toISOString(),
        daysParked,
        views: readCount(options.viewsByVehicleId, vehicle.id),
        views7d: readCount(options.views7dByVehicleId, vehicle.id),
        whatsappClicks: readCount(options.whatsappByVehicleId, vehicle.id),
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
