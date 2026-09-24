export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ||
  process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim() ||
  "";

/** Catálogo de veículos da Meta: `content_type` tem que ser `vehicle`. */
export const META_CATALOG_CONTENT_TYPE = "vehicle" as const;

export type CatalogEventParams = {
  content_ids: string[];
  content_name?: string;
  value?: number;
  currency?: "BRL";
  make?: string;
  model?: string;
  year?: string | number;
  search_string?: string;
  /** Recomendados em Automotive Inventory Ads (ViewContent / Lead). */
  state_of_vehicle?: string;
  exterior_color?: string;
  transmission?: string;
  body_style?: string;
  fuel_type?: string;
  postal_code?: string;
};

export type CatalogEventPayload = {
  content_ids: string[];
  content_type: typeof META_CATALOG_CONTENT_TYPE;
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  content_name?: string;
  value?: number;
  price?: number;
  currency?: "BRL";
  make?: string;
  model?: string;
  year?: string;
  search_string?: string;
  country?: string;
  state_of_vehicle?: string;
  exterior_color?: string;
  transmission?: string;
  body_style?: string;
  fuel_type?: string;
  postal_code?: string;
};

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded?: boolean;
  version?: string;
  push: Fbq;
};

type Gtag = (...args: unknown[]) => void;

export type ChatEventName =
  | "ChatOpen"
  | "ChatFirstMessage"
  | "ChatStockShown"
  | "ChatVehicleClick"
  | "ChatStockExplore"
  | "ChatFollowupClick"
  | "ChatClose"
  | "ChatLeadCreated";

export type ChatEventParams = {
  source?: string;
  intent?: string;
  vehicle_ids?: string[];
  result_count?: number;
  message_count?: number;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

const TRACK_RETRY_MS = 250;
const TRACK_RETRY_BUDGET_MS = 15_000;

function getFbq() {
  if (typeof window === "undefined") return undefined;
  return window.fbq;
}

function compactString(value: string | number | undefined) {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

/**
 * Payload de catálogo: `content_ids` = Prisma CUID (`vehicle_id` do feed).
 * Não usar slug da URL.
 */
export function buildCatalogPayload(
  params: CatalogEventParams,
): CatalogEventPayload {
  const content_ids = params.content_ids
    .map((id) => id.trim())
    .filter(Boolean);

  const payload: CatalogEventPayload = {
    content_ids,
    content_type: META_CATALOG_CONTENT_TYPE,
    country: "Brazil",
  };

  if (content_ids.length > 0) {
    payload.contents = content_ids.map((id) => {
      const row: { id: string; quantity: number; item_price?: number } = {
        id,
        quantity: 1,
      };
      if (typeof params.value === "number" && Number.isFinite(params.value)) {
        row.item_price = params.value;
      }
      return row;
    });
  }

  const contentName = compactString(params.content_name);
  if (contentName) payload.content_name = contentName;

  const make = compactString(params.make);
  if (make) payload.make = make;

  const model = compactString(params.model);
  if (model) payload.model = model;

  const year = compactString(params.year);
  if (year) payload.year = year;

  if (typeof params.value === "number" && Number.isFinite(params.value)) {
    payload.value = params.value;
    payload.price = params.value;
    payload.currency = params.currency ?? "BRL";
  } else if (params.currency) {
    payload.currency = params.currency;
  }

  const search = compactString(params.search_string);
  if (search) payload.search_string = search;

  const stateOfVehicle = compactString(params.state_of_vehicle);
  if (stateOfVehicle) payload.state_of_vehicle = stateOfVehicle;
  const exterior = compactString(params.exterior_color);
  if (exterior) payload.exterior_color = exterior;
  const transmission = compactString(params.transmission);
  if (transmission) payload.transmission = transmission;
  const bodyStyle = compactString(params.body_style);
  if (bodyStyle) payload.body_style = bodyStyle;
  const fuelType = compactString(params.fuel_type);
  if (fuelType) payload.fuel_type = fuelType;
  const postal = compactString(params.postal_code);
  if (postal) payload.postal_code = postal;

  return payload;
}

const PAGE_UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type VehicleFunnelRef = {
  vehicleId?: string;
  slug?: string;
};

/** UTM da URL atual. Não lê o texto do WhatsApp. */
export function readPageUtm(search?: string) {
  const raw =
    search ??
    (typeof window === "undefined" ? "" : window.location?.search || "");
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  } catch {
    return {};
  }
  const utm: Record<string, string> = {};
  for (const key of PAGE_UTM_KEYS) {
    const value = compactString(params.get(key) ?? undefined)?.slice(0, 80);
    if (value) utm[key] = value;
  }
  return utm;
}

export function vehicleFunnelParams(ref?: VehicleFunnelRef) {
  const params: Record<string, string> = {};
  const vehicleId = compactString(ref?.vehicleId)?.slice(0, 80);
  const slug = compactString(ref?.slug)?.slice(0, 120);
  if (vehicleId) params.vehicle_id = vehicleId;
  if (slug) params.slug = slug;
  return { ...params, ...readPageUtm() };
}

function ensureGtagQueue() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag === "function") return;
  // Mesmo stub do snippet do GA4: o script oficial drena o dataLayer depois.
  window.gtag = function gtag() {
    // gtag.js só consome o objeto Arguments do snippet oficial, não um array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
}

function getGtag() {
  if (typeof window === "undefined") return undefined;
  ensureGtagQueue();
  return window.gtag;
}

function fireGtag(event: string, params?: Record<string, unknown>) {
  const gtag = getGtag();
  if (!gtag) return;
  if (params) gtag("event", event, params);
  else gtag("event", event);
}

function gtagItemParams(payload?: CatalogEventPayload) {
  if (!payload) return {};
  const params: Record<string, unknown> = {};
  if (payload.content_ids.length > 0) {
    params.item_id = payload.content_ids[0];
    params.items = payload.content_ids.map((id) => ({ item_id: id }));
  }
  if (payload.content_name) params.item_name = payload.content_name;
  if (typeof payload.value === "number") {
    params.value = payload.value;
    params.currency = payload.currency ?? "BRL";
  } else if (payload.currency) {
    params.currency = payload.currency;
  }
  if (payload.search_string) params.search_term = payload.search_string;
  return params;
}

function fire(event: string, payload?: CatalogEventPayload) {
  if (typeof window === "undefined") return;

  const run = () => {
    const fbq = getFbq();
    if (!fbq) return false;
    if (payload) fbq("track", event, payload);
    else fbq("track", event);
    return true;
  };

  if (run()) return;

  const started = Date.now();
  const tick = () => {
    if (run()) return;
    if (Date.now() - started > TRACK_RETRY_BUDGET_MS) return;
    window.setTimeout(tick, TRACK_RETRY_MS);
  };
  window.setTimeout(tick, TRACK_RETRY_MS);
}

export function trackPageView() {
  fire("PageView");
}

export function trackViewContent(params: CatalogEventParams) {
  const payload = buildCatalogPayload(params);
  fire("ViewContent", payload);
  fireGtag("view_item", gtagItemParams(payload));
}

/** WhatsApp / interesse na ficha — sinal de Lead do catálogo (não Contact). */
export function trackLead(params: CatalogEventParams) {
  const payload = buildCatalogPayload(params);
  fire("Lead", payload);
  fireGtag("generate_lead", gtagItemParams(payload));
}

/** @deprecated Use trackLead — Commerce Manager casa Lead, não Contact. */
export function trackContact(params: CatalogEventParams) {
  trackLead(params);
}

export function trackSearch(params: CatalogEventParams) {
  const payload = buildCatalogPayload(params);
  fire("Search", payload);
  fireGtag("search", gtagItemParams(payload));
}

export function trackAddToWishlist(params: CatalogEventParams) {
  const payload = buildCatalogPayload(params);
  fire("AddToWishlist", payload);
  fireGtag("add_to_wishlist", gtagItemParams(payload));
}

export type PwaEventName =
  | "PwaInstallPromptShown"
  | "PwaInstallAccepted"
  | "PwaInstallDismissed"
  | "PwaIosTipShown"
  | "PwaIosTipDismissed"
  | "PwaOfflineQueued"
  | "PwaOfflineFlushed";

const PWA_GA_EVENTS: Record<PwaEventName, string> = {
  PwaInstallPromptShown: "pwa_install_prompt_shown",
  PwaInstallAccepted: "pwa_install_accepted",
  PwaInstallDismissed: "pwa_install_dismissed",
  PwaIosTipShown: "pwa_ios_tip_shown",
  PwaIosTipDismissed: "pwa_ios_tip_dismissed",
  PwaOfflineQueued: "pwa_offline_queued",
  PwaOfflineFlushed: "pwa_offline_flushed",
};

/** Instalação PWA / fila offline — só o nome do evento, sem PII. */
export function trackPwaEvent(
  event: PwaEventName,
  params: { kind?: string } = {},
) {
  if (typeof window === "undefined") return;
  const kind = compactString(params.kind)?.slice(0, 24);
  const payload = kind ? { kind } : {};
  const fbq = getFbq();
  if (fbq) fbq("trackCustom", event, payload);
  fireGtag(PWA_GA_EVENTS[event], {
    event_category: "pwa",
    ...payload,
  });
}

/**
 * Vista da ficha. Convive com `view_item` / ViewContent do catálogo.
 * Payload: vehicle_id, slug e UTM da página quando existirem.
 */
export function trackVehicleView(ref: VehicleFunnelRef) {
  if (typeof window === "undefined") return;
  const params = vehicleFunnelParams(ref);
  if (!params.vehicle_id) return;
  const fbq = getFbq();
  if (fbq) fbq("trackCustom", "vehicle_view", params);
  fireGtag("vehicle_view", params);
}

/** Clique em WhatsApp (float, favoritos, hero, ficha) — Meta custom + GA4. */
export function trackWhatsAppClick(label: string, ref?: VehicleFunnelRef) {
  if (typeof window === "undefined") return;
  const funnel = vehicleFunnelParams(ref);
  const custom: Record<string, string> = { label, ...funnel };
  const fbq = getFbq();
  if (fbq) fbq("trackCustom", "WhatsAppClick", custom);
  fireGtag("whatsapp_click", {
    event_category: "engagement",
    event_label: label,
    ...funnel,
  });
}

const CHAT_GA_EVENTS: Record<ChatEventName, string> = {
  ChatOpen: "chat_open",
  ChatFirstMessage: "chat_first_message",
  ChatStockShown: "chat_stock_shown",
  ChatVehicleClick: "chat_vehicle_click",
  ChatStockExplore: "chat_stock_explore",
  ChatFollowupClick: "chat_followup_click",
  ChatClose: "chat_close",
  ChatLeadCreated: "chat_lead_created",
};

/** Funil do chat: somente categorias e IDs públicos, nunca texto ou PII. */
export function buildChatEventPayload(params: ChatEventParams = {}) {
  const payload: Record<string, string | number | string[]> = {};
  const source = compactString(params.source);
  const intent = compactString(params.intent);
  const ids = (params.vehicle_ids ?? [])
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (source) payload.source = source.slice(0, 48);
  if (intent) payload.intent = intent.slice(0, 32);
  if (ids.length) payload.vehicle_ids = ids;
  if (
    typeof params.result_count === "number" &&
    Number.isFinite(params.result_count)
  ) {
    payload.result_count = Math.max(0, Math.round(params.result_count));
  }
  if (
    typeof params.message_count === "number" &&
    Number.isFinite(params.message_count)
  ) {
    payload.message_count = Math.max(0, Math.round(params.message_count));
  }
  return payload;
}

export function trackChatEvent(
  event: ChatEventName,
  params: ChatEventParams = {},
) {
  if (typeof window === "undefined") return;
  const payload = buildChatEventPayload(params);
  const fbq = getFbq();
  if (fbq) fbq("trackCustom", event, payload);
  fireGtag(CHAT_GA_EVENTS[event], {
    event_category: "chat",
    ...payload,
  });
}

export function classifyChatIntent(message: string) {
  const text = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/financi|parcela|60x|juros|cartao|credito|18x/.test(text)) return "finance";
  if (/\btroca\b|meu usado|avali/.test(text)) return "trade";
  if (/garantia/.test(text)) return "warranty";
  if (/automatic|cvt/.test(text)) return "automatic";
  if (/\b\d+\s*(mil|k)\b|r\$\s*\d|orcamento|ate\s+\d/.test(text)) {
    return "budget";
  }
  if (/estoque|carro|moto|modelo|marca|hatch|sedan|suv/.test(text)) {
    return "stock";
  }
  if (/avisar|quando chegar|encomend|similar/.test(text)) {
    return "wanted";
  }
  return "other";
}

export function stockSearchString(input: {
  q?: string;
  category?: string;
  brand?: string;
  transmission?: string;
  fuel?: string;
  color?: string;
  accessory?: string;
  laudo?: string;
  minPrice?: string;
  maxPrice?: string;
  minYear?: string;
  maxYear?: string;
  maxKm?: string;
}) {
  const query = compactString(input.q);
  if (query) return query;

  const parts: string[] = [];
  const push = (label: string, value?: string) => {
    const text = compactString(value);
    if (text) parts.push(`${label}:${text}`);
  };
  push("marca", input.brand);
  push("tipo", input.category);
  push("cambio", input.transmission);
  push("combustivel", input.fuel);
  push("cor", input.color);
  push("item", input.accessory);
  push("laudo", input.laudo);
  push("preco_min", input.minPrice);
  push("preco_max", input.maxPrice);
  push("ano_min", input.minYear);
  push("ano_max", input.maxYear);
  push("km_max", input.maxKm);
  return parts.join(" ");
}
