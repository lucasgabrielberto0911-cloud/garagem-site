const SEVEN_DAYS_MS = 7 * 86400000;

/** Retorna chave de data YYYY-MM-DD no fuso de São Paulo via formatToParts. */
export function saoPauloDateKey(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/** Verifica se o veículo entrou nos últimos 7 dias (7 * 86400000 ms). */
export function isNewArrival(createdAt: Date | string, now: Date = new Date()): boolean {
  const createdMs =
    typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  if (Number.isNaN(createdMs)) return false;
  const diff = now.getTime() - createdMs;
  return diff >= 0 && diff <= SEVEN_DAYS_MS;
}

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ordenação diária do estoque:
 * - Novos no topo (createdAt desc, desempate por id)
 * - Resto: shuffle determinístico mulberry32 com seed = hash(dateKey),
 *   com ids previamente ordenados para estabilidade.
 */
export function orderStockDaily<T extends { id: string; createdAt: Date | string }>(
  vehicles: T[],
  now: Date = new Date(),
): T[] {
  const newArrivals: T[] = [];
  const others: T[] = [];

  for (const v of vehicles) {
    if (isNewArrival(v.createdAt, now)) {
      newArrivals.push(v);
    } else {
      others.push(v);
    }
  }

  newArrivals.sort((a, b) => {
    const bTime =
      typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() : b.createdAt.getTime();
    const aTime =
      typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() : a.createdAt.getTime();
    const diff = bTime - aTime;
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  const dateKey = saoPauloDateKey(now);
  const rng = mulberry32(hashString(dateKey));

  const shuffledOthers = [...others];
  shuffledOthers.sort((a, b) => a.id.localeCompare(b.id));

  for (let i = shuffledOthers.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = shuffledOthers[i]!;
    shuffledOthers[i] = shuffledOthers[j]!;
    shuffledOthers[j] = temp;
  }

  return [...newArrivals, ...shuffledOthers];
}
