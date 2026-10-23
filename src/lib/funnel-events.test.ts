import assert from "node:assert/strict";
import { test } from "node:test";
import {
  META_CATALOG_CONTENT_TYPE,
  buildCatalogPayload,
  buildChatEventPayload,
  catalogParamsFromChatVehicle,
  classifyChatIntent,
  SiteLeadHit,
  StockSearchPixel,
  trackAddToCart,
  trackLead,
  trackSearch,
  trackViewContent,
  trackVehicleView,
  trackWhatsAppClick,
  VehicleLeadHit,
  VehicleViewContent,
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
