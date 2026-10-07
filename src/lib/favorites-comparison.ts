import { isVehicleCuid } from "./vehicle-slug";

export function comparisonSelection(available: string[], chosen: string[] | null) {
  return [...new Set(chosen ?? available.slice(0, 2))].filter(id => available.includes(id)).slice(0, 3);
}
export function toggleComparison(current: string[], id: string) {
  return current.includes(id) ? current.filter(item => item !== id) : current.length < 3 ? [...current, id] : current;
}

export const COMPARISON_SESSION_KEY = "garagem:comparacao";
export type ComparisonSession = { chosen: string[] | null; open: boolean };
export function parseComparisonSession(raw: string | null): ComparisonSession {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object" || !("chosen" in value) || !("open" in value) || typeof value.open !== "boolean" ||
      !(value.chosen === null || Array.isArray(value.chosen) && value.chosen.every(id => typeof id === "string" && isVehicleCuid(id)))) return { chosen: null, open: false };
    return { chosen: value.chosen === null ? null : [...new Set(value.chosen as string[])].slice(0, 3), open: value.open };
  } catch { return { chosen: null, open: false }; }
}
export function readComparisonSession(): ComparisonSession {
  try { return parseComparisonSession(sessionStorage.getItem(COMPARISON_SESSION_KEY)); }
  catch { return { chosen: null, open: false }; }
}
export function writeComparisonSession(state: ComparisonSession) {
  try { sessionStorage.setItem(COMPARISON_SESSION_KEY, JSON.stringify(state)); }
  catch { /* Seleção ainda funciona quando o armazenamento está bloqueado. */ }
}
