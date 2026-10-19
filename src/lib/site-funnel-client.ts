import { hasMarketingConsent } from "./consent";
import { classifyLeadOrigin, isLeadOrigin } from "./lead-origin";
/** Sem URL, IP, identificador de sessão ou UTM livre no registro. */
export function recordSiteFunnel(event: "visita" | "whatsapp", vehicleId?: string) {
  if (typeof window === "undefined" || !hasMarketingConsent() || location.pathname.startsWith("/admin")) return;
  let origin = classifyLeadOrigin(location.search, document.referrer, location.origin);
  try { const stored = sessionStorage.getItem("garagem_primeira_origem"); if (isLeadOrigin(stored)) origin = stored; } catch { /* armazenamento indisponível */ }
  void fetch("/api/funil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, origin, vehicleId }), keepalive: true }).catch(() => {});
}
