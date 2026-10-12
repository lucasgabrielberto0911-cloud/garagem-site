import { vehicleFunnelParams, type VehicleFunnelRef } from "@/lib/meta-pixel";

/**
 * Eventos de medição do site (GA4 + Meta custom). Nunca enviar texto livre nem PII.
 * Clique no WhatsApp (`trackWhatsAppClick`) e abertura do chat (`trackChatEvent("ChatOpen")`)
 * já disparam GA4 + Meta em meta-pixel.ts; aqui ficam os eventos novos.
 */
export type SiteEventName =
  | "chat_message_sent"
  | "chat_visit_request";

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

const CUSTOM_NAMES: Record<SiteEventName, string> = {
  chat_message_sent: "ChatMessageSent",
  chat_visit_request: "ChatVisitRequest",
};

/** Mantém só valores curtos e primitivos; descarta o resto. */
export function sanitizeEventParams(
  params: Record<string, unknown> = {},
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "string" && value.trim()) {
      out[key] = value.trim().slice(0, 80);
    }
  }
  return out;
}

/** Helper único: dispara o evento no GA4 (gtag) e no Pixel da Meta, se estiverem carregados. */
export function trackEvent(
  event: SiteEventName,
  params: Record<string, unknown> = {},
  ref?: VehicleFunnelRef,
) {
  if (typeof window === "undefined") return;
  const payload = sanitizeEventParams({
    ...params,
    ...(ref ? vehicleFunnelParams(ref) : {}),
  });
  const w = window as unknown as { gtag?: Gtag; fbq?: Fbq };
  try {
    w.gtag?.("event", event, payload);
    w.fbq?.("trackCustom", CUSTOM_NAMES[event], payload);
  } catch {
    // medição nunca pode quebrar a navegação
  }
}
