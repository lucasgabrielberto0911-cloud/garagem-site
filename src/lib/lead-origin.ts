/** Categorias fechadas: nunca guardar URLs, identificadores de anúncio ou UTMs livres. */
export const ORIGIN_LABELS = {
  google: "Google", instagram: "Instagram", facebook: "Facebook",
  marketplace: "Facebook Marketplace", olx: "OLX", direto: "acesso direto",
  indicacao: "indicação", outros: "outro site", desconhecida: "origem não informada",
} as const;
export type LeadOrigin = keyof typeof ORIGIN_LABELS;
export function isLeadOrigin(value: unknown): value is LeadOrigin {
  return typeof value === "string" && Object.hasOwn(ORIGIN_LABELS, value);
}
export function classifyLeadOrigin(search: string, referrer: string, siteOrigin: string): LeadOrigin {
  const query = new URLSearchParams(search);
  const source = (query.get("utm_source") || "").toLowerCase();
  const medium = (query.get("utm_medium") || "").toLowerCase();
  if (source === "marketplace" || (/^(facebook|fb|meta)$/.test(source) && medium === "marketplace")) return "marketplace";
  if (/^(instagram|ig)$/.test(source)) return "instagram";
  if (/^(facebook|fb|meta)$/.test(source)) return "facebook";
  if (/^(google|googleads|adwords)$/.test(source)) return "google";
  if (source === "olx") return "olx";
  if (source) return "outros";
  const fallback = query.has("fbclid") ? "facebook" : query.has("gclid") ? "google" : "direto";
  if (!referrer) return fallback;
  try {
    const url = new URL(referrer);
    if (url.origin === siteOrigin) return fallback === "direto" ? "desconhecida" : fallback;
    const host = url.hostname.toLowerCase();
    if (/(^|\.)google\.(com|com\.br)$/.test(host)) return "google";
    if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
    if (/(^|\.)(facebook\.com|fb\.com)$/.test(host)) return "facebook";
    if (/(^|\.)olx\.com\.br$/.test(host)) return "olx";
    return fallback === "direto" ? "outros" : fallback;
  } catch { return "desconhecida"; }
}
const ORIGIN_SUFFIX: Partial<Record<LeadOrigin, string>> = {
  google: "vim pelo Google", instagram: "vim pelo Instagram", facebook: "vim pelo Facebook",
  marketplace: "vim pelo Facebook Marketplace", olx: "vim pela OLX", direto: "acessei o site diretamente",
  indicacao: "vim por indicação", outros: "vim por outro site",
};
export function withWhatsAppOrigin(text: string, origin?: LeadOrigin | null) {
  const clean = text.replace(/ \(\w[^()]*\)$/, match =>
    Object.values(ORIGIN_SUFFIX).some(suffix => match === ` (${suffix})`) ? "" : match);
  const suffix = origin ? ORIGIN_SUFFIX[origin] : undefined;
  return suffix ? `${clean} (${suffix})` : clean;
}
export function applyWhatsAppOrigin(href: string, origin?: LeadOrigin | null) {
  try {
    const url = new URL(href);
    if (url.hostname !== "wa.me") return href;
    const text = url.searchParams.get("text");
    if (!text) return href;
    const updated = withWhatsAppOrigin(text, origin);
    if (updated === text) return href;
    return href.replace(/([?&]text=)[^&#]*/, (_, prefix: string) => prefix + encodeURIComponent(updated));
  } catch { return href; }
}
export const PURCHASE_SOURCE_PREFIX = "whatsapp:";
export function purchaseSourceLabel(source: string | null) {
  const origin = source?.slice(PURCHASE_SOURCE_PREFIX.length);
  return source?.startsWith(PURCHASE_SOURCE_PREFIX) && isLeadOrigin(origin) ? ORIGIN_LABELS[origin] : source || "Não informada";
}
