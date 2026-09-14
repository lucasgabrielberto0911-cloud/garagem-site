import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_HOME_FEATURED,
  canEnableFeatured,
  featuredCapMessage,
  featuredOrdersFromIds,
  featuredSlotState,
  moveFeaturedIds,
  nextFeaturedOrder,
  sortFeaturedForHome,
} from "./featured";

test("home tem teto de 8 destaques e não deixa passar do limite", () => {
  assert.equal(MAX_HOME_FEATURED, 8);
  const slots = featuredSlotState(8);
  assert.equal(slots.atCap, true);
  assert.equal(slots.remaining, 0);
  assert.equal(canEnableFeatured(8, false), false);
  assert.equal(canEnableFeatured(8, true), true);
  assert.equal(canEnableFeatured(3, false), true);
  assert.match(featuredCapMessage(), /8 destaques/);
});

test("ordem da home usa featuredOrder e cai na data se faltar número", () => {
  const sorted = sortFeaturedForHome([
    { featuredOrder: 2, createdAt: "2026-01-01" },
    { featuredOrder: null, createdAt: "2026-03-01" },
    { featuredOrder: 1, createdAt: "2026-02-01" },
  ]);
  assert.equal(sorted[0]?.featuredOrder, 1);
  assert.equal(sorted[1]?.featuredOrder, 2);
  assert.equal(sorted[2]?.featuredOrder, null);
  assert.equal(nextFeaturedOrder([1, 3, null]), 4);
  assert.equal(nextFeaturedOrder([]), 1);
});

test("setas sobem e descem o id na vitrine", () => {
  const ids = ["a", "b", "c"];
  assert.deepEqual(moveFeaturedIds(ids, 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moveFeaturedIds(ids, 0, 1), ["b", "a", "c"]);
  assert.deepEqual(featuredOrdersFromIds(["c", "a"]), [
    { id: "c", featuredOrder: 1 },
    { id: "a", featuredOrder: 2 },
  ]);
});
