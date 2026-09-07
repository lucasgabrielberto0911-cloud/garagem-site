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

  return payload;
}

function getGtag() {
  if (typeof window === "undefined") return undefined;
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

/** Clique em WhatsApp (float, favoritos, hero) — Meta custom + GA4. */
export function trackWhatsAppClick(label: string) {
  if (typeof window === "undefined") return;
  const fbq = getFbq();
  if (fbq) fbq("trackCustom", "WhatsAppClick", { label });
  fireGtag("whatsapp_click", {
    event_category: "engagement",
    event_label: label,
  });
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
