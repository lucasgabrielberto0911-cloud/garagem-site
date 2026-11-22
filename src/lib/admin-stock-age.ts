import {
  calculateParkedDays,
  resolveVehicleEnteredAt,
} from "@/lib/admin-parados";
import { buildVehicleFullLabel } from "@/lib/vehicle-display";

export type StockAgeBandId = "0-30" | "31-45" | "46-60" | "60+";

export type StockAgeBandSpec = {
  id: StockAgeBandId;
  label: string;
  suggestion: string;
};

export const STOCK_AGE_BANDS: readonly StockAgeBandSpec[] = [
  {
    id: "0-30",
    label: "0–30 dias",
    suggestion: "Conferir fotos e texto",
  },
  {
    id: "31-45",
    label: "31–45 dias",
    suggestion: "Rever preço e trocar capa",
  },
  {
    id: "46-60",
    label: "46–60 dias",
    suggestion: "Baixar preço e divulgar",
  },
  {
    id: "60+",
    label: "60+ dias",
    suggestion: "Decidir: vender no preço ou repassar",
  },
];

export function classifyStockAgeBand(days: number): StockAgeBandId {
  if (days <= 30) return "0-30";
  if (days <= 45) return "31-45";
  if (days <= 60) return "46-60";
  return "60+";
}

/** Faixas de atenção de Carros parados, da mais urgente para a menos urgente. */
export const PARKED_ATTENTION_BAND_IDS: readonly StockAgeBandId[] = [
  "60+",
  "46-60",
  "31-45",
];

export type StockAgeBandGroup<T extends { daysParked: number }> =
  StockAgeBandSpec & {
    items: T[];
  };

/**
 * Agrupa carros parados nas faixas de atenção (60+, 46–60 e 31–45),
 * preservando a ordem interna dos itens em cada faixa.
 */
export function groupParkedByAgeBand<T extends { daysParked: number }>(
  items: readonly T[],
): StockAgeBandGroup<T>[] {
  const byBand: Record<StockAgeBandId, T[]> = {
    "0-30": [],
    "31-45": [],
    "46-60": [],
    "60+": [],
  };

  for (const item of items) {
    const band = classifyStockAgeBand(item.daysParked);
    byBand[band].push(item);
  }

  return PARKED_ATTENTION_BAND_IDS.map((bandId) => {
    const spec = STOCK_AGE_BANDS.find((entry) => entry.id === bandId)!;
    return {
      ...spec,
      items: byBand[bandId],
    };
  });
}

/**
 * Classes visuais para o indicador de dias em estoque conforme a faixa.
 * Mantém a paleta da marca (preto, vermelho, off-white — nunca dourado/amarelo).
 */
export function stockAgeBandBadgeClass(band: StockAgeBandId): string {
  if (band === "60+") {
    return "border border-brand/60 bg-brand/25 text-white";
  }
  if (band === "46-60") {
    return "border border-brand/40 bg-brand/15 text-red-200";
  }
  if (band === "31-45") {
    return "border border-white/30 bg-white/10 text-cream";
  }
  return "border border-white/15 bg-white/5 text-cream/80";
}

export type StockAgeVehicleInput = {
  id: string;
  brand: string;
  model: string;
  version?: string | null;
  yearModel: number;
  status: string;
  historical?: boolean | null;
  createdAt: Date | string;
  stockEnteredAt?: Date | string | null;
};

export type StockAgeBandSummary = StockAgeBandSpec & {
  count: number;
};

export type StockAgeOldestItem = {
  id: string;
  name: string;
  days: number;
  href: string;
};

export type StockAgeSummary = {
  totalActive: number;
  bands: StockAgeBandSummary[];
  oldest: StockAgeOldestItem[];
};

/**
 * Agrupa veículos disponíveis nas 4 faixas de idade (0–30, 31–45, 46–60 e 60+)
 * usando a mesma data de entrada de `admin-parados` (`stockEnteredAt ?? createdAt`)
 * e devolve os 3 mais antigos para ação rápida.
 */
export function summarizeStockAge(
  vehicles: readonly StockAgeVehicleInput[],
  now: Date = new Date(),
  oldestLimit = 3,
): StockAgeSummary {
  const counts: Record<StockAgeBandId, number> = {
    "0-30": 0,
    "31-45": 0,
    "46-60": 0,
    "60+": 0,
  };
  const ranked: Array<{ item: StockAgeOldestItem; enteredMs: number }> = [];

  for (const vehicle of vehicles) {
    if (vehicle.status !== "disponivel") continue;
    if (vehicle.historical === true) continue;

    const enteredAt = resolveVehicleEnteredAt(vehicle);
    const enteredMs = enteredAt.getTime();
    if (Number.isNaN(enteredMs)) continue;

    const days = calculateParkedDays(enteredAt, now);
    const band = classifyStockAgeBand(days);
    counts[band] += 1;

    ranked.push({
      enteredMs,
      item: {
        id: vehicle.id,
        name: buildVehicleFullLabel(vehicle),
        days,
        href: `/admin/veiculos/${encodeURIComponent(vehicle.id)}`,
      },
    });
  }

  ranked.sort(
    (a, b) =>
      b.item.days - a.item.days ||
      a.enteredMs - b.enteredMs ||
      a.item.name.localeCompare(b.item.name, "pt-BR") ||
      a.item.id.localeCompare(b.item.id),
  );

  return {
    totalActive: ranked.length,
    bands: STOCK_AGE_BANDS.map((spec) => ({
      ...spec,
      count: counts[spec.id],
    })),
    oldest: ranked.slice(0, Math.max(0, oldestLimit)).map((entry) => entry.item),
  };
}
