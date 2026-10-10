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
/**
 * Frase curta que o cliente "diz" no fim da mensagem. Acesso direto, origem
 * desconhecida ou sem consentimento não acrescentam nada.
 */
const ORIGIN_SENTENCE: Partial<Record<LeadOrigin, string>> = {
  google: "Vim pelo Google.", instagram: "Vim pelo Instagram.", facebook: "Vim pelo Facebook.",
  marketplace: "Vim pelo Marketplace do Facebook.", olx: "Vim pela OLX.",
  indicacao: "Vim por indicação.", outros: "Vim por outro site.",
};
/** Formato antigo entre parênteses, removido se ainda estiver num link já aberto. */
const LEGACY_SUFFIX = /\s\((?:vim pel[oa] [^()]+|vim por [^()]+|acessei o site diretamente)\)$/;
const KNOWN_SENTENCES = Object.values(ORIGIN_SENTENCE);
function stripOrigin(line: string) {
  for (const sentence of KNOWN_SENTENCES) {
    if (line.endsWith(` ${sentence}`)) return line.slice(0, -(sentence.length + 1));
  }
  return line.replace(LEGACY_SUFFIX, "");
}
/**
 * Acrescenta a origem na frase do cliente, antes da linha com o link da ficha
 * (o link continua sozinho na última linha para o WhatsApp gerar a prévia).
 */
export function withWhatsAppOrigin(text: string, origin?: LeadOrigin | null) {
  const lines = text.split("\n").map(stripOrigin);
  const sentence = origin ? ORIGIN_SENTENCE[origin] : undefined;
  if (sentence) {
    const linkLine = lines.findIndex(line => /^https?:\/\//.test(line.trim()));
    const target = linkLine > 0 ? linkLine - 1 : lines.length - 1;
    lines[target] = lines[target] ? `${lines[target]} ${sentence}` : sentence;
  }
  return lines.join("\n");
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
