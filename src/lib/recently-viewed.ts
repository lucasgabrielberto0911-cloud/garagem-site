import { isVehicleCuid } from "./vehicle-slug";

export const RECENT_VEHICLES_KEY = "garagem:vistos-recentemente";
export const RECENT_VEHICLES_EVENT = "garagem:vistos-alterados";
export const RECENT_VEHICLES_LIMIT = 8;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export type RecentVisit = { id: string; viewedAt: number };

/** Só ids e horário ficam neste aparelho. Preços sempre vêm da API pública. */
export function parseRecentVisits(raw: string | null, now = Date.now()): RecentVisit[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.filter((row): row is RecentVisit => {
      if (!row || typeof row.id !== "string" || !isVehicleCuid(row.id) ||
        !Number.isFinite(row.viewedAt) || row.viewedAt > now || now - row.viewedAt >= MAX_AGE_MS || seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    }).slice(0, RECENT_VEHICLES_LIMIT).map(row => ({ id: row.id, viewedAt: row.viewedAt }));
  } catch { return []; }
}

export function withRecentVisit(visits: RecentVisit[], id: string, now = Date.now()) {
  if (!isVehicleCuid(id)) return visits;
  return [{ id, viewedAt: now }, ...visits.filter(row => row.id !== id)].slice(0, RECENT_VEHICLES_LIMIT);
}

export function recentIdsSnapshot() {
  if (typeof window === "undefined") return "";
  try { return parseRecentVisits(localStorage.getItem(RECENT_VEHICLES_KEY)).map(row => row.id).join(","); }
  catch { return ""; }
}
export function rememberRecentVehicle(id: string) {
  try {
    const visits = parseRecentVisits(localStorage.getItem(RECENT_VEHICLES_KEY));
    localStorage.setItem(RECENT_VEHICLES_KEY, JSON.stringify(withRecentVisit(visits, id)));
    window.dispatchEvent(new Event(RECENT_VEHICLES_EVENT));
  } catch { /* Histórico opcional: armazenamento bloqueado não interrompe a ficha. */ }
}
export function clearRecentVehicles() {
  localStorage.removeItem(RECENT_VEHICLES_KEY);
  window.dispatchEvent(new Event(RECENT_VEHICLES_EVENT));
}
