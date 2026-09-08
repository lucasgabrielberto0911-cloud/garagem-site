import assert from "node:assert/strict";
import { test } from "node:test";
import { isVehicleCuid } from "./vehicle-slug";
import {
  META_CATALOG_CONTENT_TYPE,
  buildChatEventPayload,
  buildCatalogPayload,
  classifyChatIntent,
  stockSearchString,
  trackAddToWishlist,
  trackChatEvent,
  trackLead,
  trackSearch,
  trackViewContent,
  trackWhatsAppClick,
} from "./meta-pixel";

const VEHICLE_CUID = "cmt0ewzpg0000lc0493fl02h7";
const SLUG = `hyundai-hb20-platinum-2024-${VEHICLE_CUID}`;

test("content_ids uses the Prisma CUID, not the URL slug", () => {
  assert.equal(isVehicleCuid(VEHICLE_CUID), true);
  assert.equal(isVehicleCuid(SLUG), false);

  const payload = buildCatalogPayload({
    content_ids: [VEHICLE_CUID],
    content_name: "Hyundai HB20 Platinum 2024",
    value: 82900,
    make: "Hyundai",
    model: "HB20",
    year: 2024,
  });

  assert.deepEqual(payload.content_ids, [VEHICLE_CUID]);
  assert.equal(payload.content_type, META_CATALOG_CONTENT_TYPE);
  assert.equal(payload.currency, "BRL");
  assert.equal(payload.value, 82900);
  assert.equal(payload.price, 82900);
  assert.equal(payload.make, "Hyundai");
  assert.equal(payload.model, "HB20");
  assert.equal(payload.year, "2024");
  assert.deepEqual(payload.contents, [
    { id: VEHICLE_CUID, quantity: 1, item_price: 82900 },
  ]);
});

test("drops empty ids and does not invent a wishlist payload", () => {
  const payload = buildCatalogPayload({
    content_ids: ["  ", VEHICLE_CUID, ""],
  });
  assert.deepEqual(payload.content_ids, [VEHICLE_CUID]);
  assert.equal(payload.content_type, "vehicle");
});

test("Search keeps search_string and visible result ids", () => {
  const payload = buildCatalogPayload({
    content_ids: [VEHICLE_CUID, "cmt0ewzpg0000lc0493fl02h8"],
    search_string: "civic",
  });
  assert.equal(payload.search_string, "civic");
  assert.equal(payload.content_type, "vehicle");
  assert.equal(payload.content_ids.length, 2);
});

test("stockSearchString prefers q and otherwise joins filters", () => {
  assert.equal(
    stockSearchString({ q: "  civic  ", brand: "Honda" }),
    "civic",
  );
  assert.equal(
    stockSearchString({ brand: "Hyundai", minYear: "2020" }),
    "marca:Hyundai ano_min:2020",
  );
});

test("Lead without catalog ids keeps content_name for CTAs do site", () => {
  const payload = buildCatalogPayload({
    content_ids: [],
    content_name: "Avise-me",
    search_string: "civic",
  });
  assert.deepEqual(payload.content_ids, []);
  assert.equal(payload.content_name, "Avise-me");
  assert.equal(payload.search_string, "civic");
  assert.equal(payload.contents, undefined);
});

type FbqCall = unknown[];

function installFbq() {
  const calls: FbqCall[] = [];
  const gtagCalls: unknown[][] = [];
  const fbq = Object.assign(
    (...args: unknown[]) => {
      calls.push(args);
    },
    { queue: [] as unknown[], push() {} },
  );
  const gtag = (...args: unknown[]) => {
    gtagCalls.push(args);
  };
  (globalThis as {
    window: {
      fbq: typeof fbq;
      gtag: typeof gtag;
      setTimeout: typeof setTimeout;
    };
  }).window = {
    fbq,
    gtag,
    setTimeout,
  };
  return { calls, gtagCalls };
}

test("ViewContent / Lead / Search / AddToWishlist go through fbq with the CUID", () => {
  const { calls, gtagCalls } = installFbq();

  trackViewContent({
    content_ids: [VEHICLE_CUID],
    content_name: "Hyundai HB20",
    value: 82900,
  });
  trackLead({ content_ids: [VEHICLE_CUID], value: 82900 });
  trackSearch({ content_ids: [VEHICLE_CUID], search_string: "hb20" });
  trackAddToWishlist({ content_ids: [VEHICLE_CUID] });

  const names = calls.map((call) => call[1]);
  assert.deepEqual(names, [
    "ViewContent",
    "Lead",
    "Search",
    "AddToWishlist",
  ]);
  for (const call of calls) {
    const payload = call[2] as { content_ids: string[]; content_type: string };
    assert.deepEqual(payload.content_ids, [VEHICLE_CUID]);
    assert.equal(payload.content_type, "vehicle");
  }

  assert.deepEqual(
    gtagCalls.map((call) => call[1]),
    ["view_item", "generate_lead", "search", "add_to_wishlist"],
  );
});

test("WhatsAppClick vai para Meta custom e GA4", () => {
  const { calls, gtagCalls } = installFbq();
  trackWhatsAppClick("float");
  assert.equal(calls[0]?.[0], "trackCustom");
  assert.equal(calls[0]?.[1], "WhatsAppClick");
  assert.deepEqual(gtagCalls[0], [
    "event",
    "whatsapp_click",
    { event_category: "engagement", event_label: "float" },
  ]);
});

test("evento do chat guarda só categorias, contagem e IDs públicos", () => {
  assert.deepEqual(
    buildChatEventPayload({
      source: "home-hero",
      intent: "budget",
      vehicle_ids: [" a ", VEHICLE_CUID, "", "b", "c"],
      result_count: 3.2,
      message_count: 2,
    }),
    {
      source: "home-hero",
      intent: "budget",
      vehicle_ids: ["a", VEHICLE_CUID, "b"],
      result_count: 3,
      message_count: 2,
    },
  );
  assert.equal(classifyChatIntent("Automático até 80 mil?"), "automatic");
  assert.equal(classifyChatIntent("Aceita meu usado na troca?"), "trade");
  assert.equal(classifyChatIntent("Carros até 70 mil?"), "budget");
});

test("ChatOpen vai para Meta custom e GA4 sem texto da conversa", () => {
  const { calls, gtagCalls } = installFbq();
  trackChatEvent("ChatOpen", { source: "home-hero", message_count: 0 });
  assert.deepEqual(calls[0], [
    "trackCustom",
    "ChatOpen",
    { source: "home-hero", message_count: 0 },
  ]);
  assert.deepEqual(gtagCalls[0], [
    "event",
    "chat_open",
    {
      event_category: "chat",
      source: "home-hero",
      message_count: 0,
    },
  ]);
});

test("classifica intenção sem guardar o texto da mensagem", () => {
  assert.equal(classifyChatIntent("Financiamento em 60x"), "finance");
  assert.equal(classifyChatIntent("Tem garantia?"), "warranty");
  assert.equal(classifyChatIntent("Quero ver o estoque de hatch"), "stock");
  assert.equal(classifyChatIntent("oi"), "other");
  const payload = buildChatEventPayload({
    source: "home-hero",
    intent: classifyChatIntent("Meu nome é Ana e o telefone é 27999999999"),
  });
  assert.equal(payload.intent, "other");
  assert.equal("message" in payload, false);
  assert.doesNotMatch(JSON.stringify(payload), /Ana|27999999999/);
});

test("ChatLeadCreated e Lead do catálogo não levam telefone", () => {
  const { calls, gtagCalls } = installFbq();
  trackChatEvent("ChatLeadCreated", {
    source: "home-hero",
    intent: "stock",
    message_count: 2,
  });
  trackLead({ content_ids: [], content_name: "chatbot-site" });
  assert.equal(calls[0]?.[1], "ChatLeadCreated");
  assert.deepEqual(calls[0]?.[2], {
    source: "home-hero",
    intent: "stock",
    message_count: 2,
  });
  assert.equal(calls[1]?.[1], "Lead");
  assert.equal(gtagCalls[1]?.[1], "generate_lead");
});
