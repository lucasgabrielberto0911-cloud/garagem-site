import assert from "node:assert/strict";
import { test } from "node:test";
import { isVehicleCuid } from "./vehicle-slug";
import {
  META_CATALOG_CONTENT_TYPE,
  buildCatalogPayload,
  stockSearchString,
  trackAddToWishlist,
  trackLead,
  trackSearch,
  trackViewContent,
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

type FbqCall = unknown[];

function installFbq() {
  const calls: FbqCall[] = [];
  const fbq = Object.assign(
    (...args: unknown[]) => {
      calls.push(args);
    },
    { queue: [] as unknown[], push() {} },
  );
  (globalThis as { window: { fbq: typeof fbq; setTimeout: typeof setTimeout } }).window = {
    fbq,
    setTimeout,
  };
  return calls;
}

test("ViewContent / Lead / Search / AddToWishlist go through fbq with the CUID", () => {
  const calls = installFbq();

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
});
