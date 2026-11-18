import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { toChatVehicleCard } from "./chat-cards";
import { readVehicleCards } from "./chat-history";
import { chatVehicleCatalogFlag } from "./chat-vehicle-context";
import { chatWhatsAppCta, resolveChatWhatsAppVehicle } from "./chat-text";
import { prisma } from "./prisma";
import { queryPublicVehicleCards } from "./public-vehicle-cards";
import {
  META_CATALOG_CONTENT_TYPE,
  buildCatalogPayload,
  buildChatEventPayload,
  catalogParamsFromChatVehicle,
  classifyChatIntent,
  isCatalogVehicle,
  SiteLeadHit,
  StockSearchPixel,
  trackAddToCart,
  trackLead,
  trackSearch,
  trackVehicleLeadHit,
  trackVehiclesWhatsAppLead,
  trackViewContent,
  trackVehicleView,
  trackWhatsAppClick,
  VehicleLeadHit,
  VehicleViewContent,
  readPageUtm,
} from "./funnel-events";
import * as compat from "./meta-pixel";

const CUID = "cmt0ewzpg0000lc0493fl02h7";

test("API unificada exporta helpers e componentes", () => {
  for (const name of [
    "buildCatalogPayload",
    "trackViewContent",
    "trackLead",
    "trackAddToCart",
    "trackSearch",
    "trackVehicleView",
    "trackWhatsAppClick",
    "VehicleViewContent",
    "VehicleLeadHit",
    "SiteLeadHit",
    "StockSearchPixel",
  ] as const) {
    assert.equal(typeof ({ VehicleViewContent, VehicleLeadHit, SiteLeadHit, StockSearchPixel, buildCatalogPayload, trackViewContent, trackLead, trackAddToCart, trackSearch, trackVehicleView, trackWhatsAppClick } as Record<string, unknown>)[name], "function", name);
  }
});

test("meta-pixel.ts mantém compatibilidade total", () => {
  assert.equal(compat.META_CATALOG_CONTENT_TYPE, META_CATALOG_CONTENT_TYPE);
  assert.equal(compat.buildCatalogPayload, buildCatalogPayload);
  assert.equal(compat.trackLead, trackLead);
  assert.equal(compat.trackViewContent, trackViewContent);
});

test("buildCatalogPayload usa CUID e content_type vehicle", () => {
  const payload = buildCatalogPayload({
    content_ids: [CUID],
    content_name: "Hyundai HB20 2024",
    value: 82900,
    make: "Hyundai",
    model: "HB20",
    year: 2024,
  });
  assert.deepEqual(payload.content_ids, [CUID]);
  assert.equal(payload.content_type, "vehicle");
  assert.equal(payload.value, 82900);
  assert.equal(payload.currency, "BRL");
});

test("funil do chat só guarda categorias e IDs públicos", () => {
  const payload = buildChatEventPayload({
    source: "home-hero",
    intent: classifyChatIntent("Aceita meu usado na troca?"),
    vehicle_ids: [CUID],
    message_count: 1,
  });
  assert.equal(payload.intent, "trade");
  assert.deepEqual(payload.vehicle_ids, [CUID]);
  assert.doesNotMatch(JSON.stringify(payload), /usado na troca/);
});

test("catalogParamsFromChatVehicle monta params de catálogo", () => {
  const params = catalogParamsFromChatVehicle({
    id: CUID,
    label: "Hyundai HB20 2024",
    brand: "Hyundai",
    model: "HB20",
    year: 2024,
    price: 80000,
  });
  assert.deepEqual(params.content_ids, [CUID]);
  assert.equal(params.value, 80000);
});

test("readPageUtm descarta utm_source=pwa legado e mantém campanhas reais", () => {
  assert.deepEqual(readPageUtm("?utm_source=pwa&utm_medium=homescreen"), {});
  assert.deepEqual(readPageUtm("?utm_source=meta&utm_medium=cpc"), { utm_source: "meta", utm_medium: "cpc" });
});

function installTrackingSpy() {
  const fbqCalls: unknown[][] = [];
  const gtagCalls: unknown[][] = [];
  const fbq = Object.assign(
    (...args: unknown[]) => {
      fbqCalls.push(args);
    },
    { queue: [] as unknown[], push() {} },
  );
  const gtag = (...args: unknown[]) => {
    gtagCalls.push(args);
  };
  (
    globalThis as {
      window?: {
        fbq: typeof fbq;
        gtag: typeof gtag;
        setTimeout: typeof setTimeout;
      };
    }
  ).window = { fbq, gtag, setTimeout };
  return {
    fbqCalls,
    gtagCalls,
    restore() {
      delete (globalThis as { window?: unknown }).window;
    },
  };
}

const CUID_OWN_2 = "cmt0ewzpg0000lc0493fl02h8";
const CUID_CONSIGNED = "cmt0ewzpg0000lc0493fl02h9";

test("isCatalogVehicle aceita apenas estoque próprio disponível", () => {
  assert.equal(isCatalogVehicle({ id: CUID, status: "disponivel" }), true);
  assert.equal(isCatalogVehicle({ id: CUID, catalog: true }), true);
  assert.equal(isCatalogVehicle({ id: CUID_CONSIGNED, consigned: true }), false);
  assert.equal(isCatalogVehicle({ id: CUID_CONSIGNED, catalog: false }), false);
  assert.equal(isCatalogVehicle({ id: CUID, status: "reservado" }), false);
  assert.equal(isCatalogVehicle({ id: CUID, status: "vendido" }), false);
  assert.equal(isCatalogVehicle({ id: CUID, sold: true }), false);
  assert.equal(isCatalogVehicle({ id: "  " }), false);
});

test("contexto da ficha sem catalog=true não entra no catálogo do Meta", () => {
  const base = {
    id: CUID,
    label: "Hyundai HB20 2024",
    brand: "Hyundai",
    model: "HB20",
    status: "disponivel",
  };

  assert.equal(chatVehicleCatalogFlag(base), false);
  assert.equal(chatVehicleCatalogFlag({ ...base, catalog: false }), false);
  assert.equal(chatVehicleCatalogFlag({ ...base, catalog: true }), true);
  assert.equal(
    chatVehicleCatalogFlag({ ...base, status: "reservado", catalog: true }),
    false,
  );
  assert.equal(
    chatVehicleCatalogFlag({ ...base, sold: true, catalog: true }),
    false,
  );
  assert.equal(chatVehicleCatalogFlag(null), false);

  assert.deepEqual(
    catalogParamsFromChatVehicle({ ...base, catalog: false }).content_ids,
    [],
  );

  const spy = installTrackingSpy();
  try {
    trackVehicleLeadHit({
      contentId: CUID,
      contentName: base.label,
      value: 82900,
      catalog: false,
    });
    assert.deepEqual(
      spy.fbqCalls.map((call) => call[1]),
      ["Lead"],
    );
    assert.deepEqual(
      (spy.fbqCalls[0]?.[2] as { content_ids: string[] }).content_ids,
      [],
    );
  } finally {
    spy.restore();
  }
});

test("trackVehicleLeadHit dispara Lead e AddToCart para veículo do catálogo e omite content_ids em consignado", () => {
  const spy = installTrackingSpy();
  try {
    trackVehicleLeadHit({
      contentId: CUID,
      contentName: "Hyundai HB20 2024",
      value: 82900,
      make: "Hyundai",
      model: "HB20",
      year: 2024,
      catalog: true,
    });

    assert.deepEqual(
      spy.fbqCalls.map((call) => call[1]),
      ["Lead", "AddToCart"],
    );
    for (const call of spy.fbqCalls) {
      const payload = call[2] as {
        content_ids: string[];
        content_type: string;
        value: number;
        currency: string;
      };
      assert.deepEqual(payload.content_ids, [CUID]);
      assert.equal(payload.content_type, "vehicle");
      assert.equal(payload.value, 82900);
      assert.equal(payload.currency, "BRL");
    }

    spy.fbqCalls.length = 0;
    spy.gtagCalls.length = 0;

    trackVehicleLeadHit({
      contentId: CUID_CONSIGNED,
      contentName: "Honda Civic 2020",
      value: 125000,
      make: "Honda",
      model: "Civic",
      year: 2020,
      catalog: false,
    });

    assert.deepEqual(
      spy.fbqCalls.map((call) => call[1]),
      ["Lead"],
    );
    const consignedLead = spy.fbqCalls[0]?.[2] as {
      content_ids: string[];
      content_type: string;
      value: number;
      currency: string;
    };
    assert.deepEqual(consignedLead.content_ids, []);
    assert.equal(consignedLead.content_type, "vehicle");
    assert.equal(consignedLead.value, 125000);
    assert.equal(consignedLead.currency, "BRL");
    assert.doesNotMatch(JSON.stringify(spy.fbqCalls), new RegExp(CUID_CONSIGNED));
    assert.doesNotMatch(JSON.stringify(spy.gtagCalls), new RegExp(CUID_CONSIGNED));
  } finally {
    spy.restore();
  }
});

test("trackVehiclesWhatsAppLead envia só IDs do catálogo nos Favoritos e cai para Lead sem IDs se só houver consignado", () => {
  const spy = installTrackingSpy();
  try {
    trackVehiclesWhatsAppLead(
      [
        { id: CUID, price: 70000, status: "disponivel", catalog: true },
        { id: CUID_OWN_2, price: 85000, status: "disponivel" },
        { id: CUID_CONSIGNED, price: 125000, status: "disponivel", catalog: false },
        { id: "cmt0ewzpg0000lc0493fl02hr", price: 60000, status: "reservado" },
      ],
      "Favoritos",
    );

    assert.deepEqual(
      spy.fbqCalls.map((call) => call[1]),
      ["Lead", "AddToCart"],
    );
    const cartPayload = spy.fbqCalls[1]?.[2] as {
      content_ids: string[];
      content_type: string;
      value: number;
      currency: string;
      contents: Array<{ id: string; quantity: number; item_price?: number }>;
    };
    assert.deepEqual(cartPayload.content_ids, [CUID, CUID_OWN_2]);
    assert.equal(cartPayload.content_type, "vehicle");
    assert.equal(cartPayload.value, 155000);
    assert.equal(cartPayload.currency, "BRL");
    assert.deepEqual(cartPayload.contents, [
      { id: CUID, quantity: 1 },
      { id: CUID_OWN_2, quantity: 1 },
    ]);
    assert.doesNotMatch(JSON.stringify(spy.fbqCalls), new RegExp(CUID_CONSIGNED));

    spy.fbqCalls.length = 0;

    trackVehiclesWhatsAppLead(
      [{ id: CUID_CONSIGNED, price: 125000, status: "disponivel", consigned: true }],
      "Favoritos",
    );
    assert.deepEqual(
      spy.fbqCalls.map((call) => call[1]),
      ["Lead"],
    );
    const onlyConsigned = spy.fbqCalls[0]?.[2] as {
      content_ids: string[];
      value: number;
      currency: string;
    };
    assert.deepEqual(onlyConsigned.content_ids, []);
    assert.equal(onlyConsigned.value, 125000);
    assert.equal(onlyConsigned.currency, "BRL");
  } finally {
    spy.restore();
  }
});

test("assistente fora da ficha propaga veículo resolvido para AddToCart/Lead e bloqueia content_ids de consignado/vendido", () => {
  const spy = installTrackingSpy();
  try {
    const ownCard = toChatVehicleCard({
      id: CUID,
      brand: "Hyundai",
      model: "HB20",
      version: "Comfort 1.0",
      yearModel: 2024,
      km: 18000,
      price: 82900,
      transmission: "Automático",
      fuel: "Flex",
      color: "Branco",
      category: "carro",
    });
    const consignedCard = toChatVehicleCard({
      id: CUID_CONSIGNED,
      brand: "Honda",
      model: "Civic",
      version: "EXL 2.0",
      yearModel: 2020,
      km: 52000,
      price: 125000,
      transmission: "Automático",
      fuel: "Flex",
      color: "Prata",
      category: "carro",
      consigned: true,
    });

    assert.doesNotMatch(JSON.stringify(consignedCard), /consign/i);
    assert.equal(consignedCard.catalog, false);

    const parsedOwn = readVehicleCards([ownCard]);
    const resolvedOwn = resolveChatWhatsAppVehicle(null, parsedOwn);
    const ownCta = chatWhatsAppCta("Temos essa opção. Chama no WhatsApp.", resolvedOwn, {
      force: true,
      userText: "tem hb20?",
    });
    assert.equal(ownCta?.vehicle?.id, CUID);

    trackVehicleLeadHit({
      contentId: ownCta!.vehicle!.id!,
      contentName: ownCta!.vehicle!.label,
      value: ownCta!.vehicle!.price,
      make: ownCta!.vehicle!.brand,
      model: ownCta!.vehicle!.model,
      year: ownCta!.vehicle!.year,
      catalog: ownCta!.vehicle!.catalog,
    });
    assert.deepEqual(
      spy.fbqCalls.map((call) => call[1]),
      ["Lead", "AddToCart"],
    );
    assert.deepEqual(
      (spy.fbqCalls[1]?.[2] as { content_ids: string[] }).content_ids,
      [CUID],
    );

    const followupCta = chatWhatsAppCta(
      "Aceitamos troca sim, chama no WhatsApp: https://wa.me/5527996330706",
      null,
      { userText: "aceita meu carro na troca?", contextVehicle: resolvedOwn },
    );
    assert.equal(followupCta?.vehicle?.id, CUID);

    const soldWaitlistCta = chatWhatsAppCta(
      "Esse modelo já foi vendido. Posso avisar no WhatsApp.",
      resolvedOwn,
      { force: true, userText: "tem grand siena?" },
    );
    assert.equal(soldWaitlistCta?.vehicle, null);

    spy.fbqCalls.length = 0;
    const parsedConsigned = readVehicleCards([consignedCard]);
    const resolvedConsigned = resolveChatWhatsAppVehicle(null, parsedConsigned);
    const consignedCta = chatWhatsAppCta("Temos o Civic 2020.", resolvedConsigned, {
      force: true,
      userText: "civic 2020",
    });
    assert.equal(consignedCta?.vehicle?.id, CUID_CONSIGNED);
    assert.equal(consignedCta?.vehicle?.catalog, false);

    trackVehicleLeadHit({
      contentId: consignedCta!.vehicle!.id!,
      contentName: consignedCta!.vehicle!.label,
      value: consignedCta!.vehicle!.price,
      catalog: consignedCta!.vehicle!.catalog,
    });
    assert.deepEqual(
      spy.fbqCalls.map((call) => call[1]),
      ["Lead"],
    );
    assert.deepEqual(
      (spy.fbqCalls[0]?.[2] as { content_ids: string[] }).content_ids,
      [],
    );
    spy.fbqCalls.length = 0;
    spy.gtagCalls.length = 0;
    const ownCard2 = toChatVehicleCard({
      id: CUID_OWN_2,
      brand: "Chevrolet",
      model: "Onix",
      version: "LTZ 1.0 Turbo",
      yearModel: 2023,
      km: 24000,
      price: 89900,
      transmission: "Automático",
      fuel: "Flex",
      color: "Preto",
      category: "carro",
    });
    const multiCta = chatWhatsAppCta(
      "Separei essas opções automáticas para você.",
      null,
      {
        force: true,
        userText: "texto livre digitado pelo visitante quero automatico",
        handoff: {
          vehicles: [ownCard, ownCard2, consignedCard].map((card) => ({
            id: card.id,
            brand: card.brand,
            model: card.model,
            version: card.version,
            year: card.year,
            label: card.title,
            category: card.category,
            href: card.href,
            transmission: card.transmission,
            price: card.price,
            sold: card.sold,
            catalog: card.catalog,
          })),
          transmission: "automatico",
        },
      },
    );
    assert.equal(multiCta?.vehicle, null);
    assert.equal(multiCta?.vehicles?.length, 3);
    trackVehiclesWhatsAppLead(multiCta!.vehicles!, "Assistente");
    assert.deepEqual(
      spy.fbqCalls.map((call) => call[1]),
      ["Lead", "AddToCart"],
    );
    const multiPayload = spy.fbqCalls[1]?.[2] as {
      content_ids: string[];
      value: number;
      currency: string;
    };
    assert.deepEqual(multiPayload.content_ids, [CUID, CUID_OWN_2]);
    assert.equal(multiPayload.value, 82900 + 89900);
    assert.equal(multiPayload.currency, "BRL");
    assert.doesNotMatch(JSON.stringify(spy.fbqCalls), new RegExp(CUID_CONSIGNED));
    assert.doesNotMatch(JSON.stringify(spy.fbqCalls), /texto livre digitado/);
    assert.doesNotMatch(JSON.stringify(spy.gtagCalls), /texto livre digitado/);

    const soldWithAlternatives = chatWhatsAppCta(
      "Esse modelo já foi vendido. Veja alternativas abaixo.",
      null,
      {
        force: true,
        userText: "tem grand siena?",
        handoff: {
          vehicles: [ownCard, ownCard2].map((card) => ({
            id: card.id,
            brand: card.brand,
            model: card.model,
            year: card.year,
            href: card.href,
            price: card.price,
          })),
        },
      },
    );
    assert.equal(soldWithAlternatives?.vehicle, null);
    assert.equal(soldWithAlternatives?.vehicles, undefined);
  } finally {
    spy.restore();
  }
});

test("queryPublicVehicleCards marca catalog=false em consignado sem expor o campo interno", async () => {
  const originalFindMany = prisma.vehicle.findMany;
  const originalHistory = prisma.vehiclePriceHistory.findMany;
  try {
    prisma.vehiclePriceHistory.findMany = (async () => []) as unknown as typeof originalHistory;
    prisma.vehicle.findMany = (async (args: { where?: { consigned?: boolean } }) => {
      if (args.where?.consigned === true) {
        return [{ id: CUID_CONSIGNED }];
      }
      return [
        {
          id: CUID,
          brand: "Hyundai",
          model: "HB20",
          version: null,
          yearModel: 2024,
          km: 15000,
          price: 82900,
          transmission: "Automático",
          fuel: "Flex",
          status: "disponivel",
          featured: false,
          photos: [],
        },
        {
          id: CUID_CONSIGNED,
          brand: "Honda",
          model: "Civic",
          version: "EXL",
          yearModel: 2020,
          km: 50000,
          price: 125000,
          transmission: "Automático",
          fuel: "Flex",
          status: "disponivel",
          featured: false,
          photos: [],
        },
      ];
    }) as unknown as typeof originalFindMany;

    const cards = await queryPublicVehicleCards({ where: { id: { in: [CUID, CUID_CONSIGNED] } } });
    assert.equal(isCatalogVehicle(cards.find((c) => c.id === CUID)), true);
    assert.equal(isCatalogVehicle(cards.find((c) => c.id === CUID_CONSIGNED)), false);
    assert.doesNotMatch(JSON.stringify(cards), /consigned/i);
  } finally {
    prisma.vehicle.findMany = originalFindMany;
    prisma.vehiclePriceHistory.findMany = originalHistory;
  }
});

test("Favoritos, Comparador e SiteChat usam os helpers de catálogo nos CTAs de WhatsApp", () => {
  const comparison = readFileSync("src/components/site/FavoritesComparison.tsx", "utf8");
  assert.match(comparison, /<VehicleLeadHit[\s\S]*catalog=\{isCatalogVehicle\(\{ \.\.\.vehicle, catalog: vehicle\.catalog === true \}\)\}[\s\S]*<WhatsAppButton/);

  const favorites = readFileSync("src/components/site/FavoritesList.tsx", "utf8");
  assert.match(favorites, /trackVehiclesWhatsAppLead\(ordered,\s*"Favoritos"\)/);

  const chat = readFileSync("src/components/site/SiteChat.tsx", "utf8");
  assert.match(chat, /<ChatWhatsAppButton[\s\S]*vehicle=\{cta\.vehicle !== undefined \? cta\.vehicle : ctaVehicle\}/);
});
