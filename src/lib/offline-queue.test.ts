import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createIntentId,
  isLikelyNetworkFailure,
  snapshotsForIds,
  writeFavoriteSnapshot,
  type FavoriteSnapshot,
} from "./offline-queue";

test("falha de rede cobre offline e TypeError de fetch", () => {
  assert.equal(isLikelyNetworkFailure(undefined, false), true);
  assert.equal(isLikelyNetworkFailure(undefined, true), false);
  assert.equal(isLikelyNetworkFailure(new TypeError("Failed to fetch"), true), true);
  assert.equal(isLikelyNetworkFailure(new Error("validação"), true), false);
});

test("id da fila é estável o bastante para gravar", () => {
  const id = createIntentId(1_700_000_000_000);
  assert.match(id, /^q-/);
  assert.notEqual(createIntentId(), createIntentId());
});

test("snapshots de favoritos devolvem só os ids pedidos", () => {
  const store = globalThis as typeof globalThis & { localStorage?: Storage };
  const memory = new Map<string, string>();
  store.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
    removeItem: (key) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  };

  const sample: FavoriteSnapshot = {
    id: "cmt0ewzpg0000lc0493fl02h7",
    brand: "Hyundai",
    model: "HB20",
    version: "Platinum",
    yearModel: 2024,
    km: 12000,
    price: 82900,
    transmission: "Automático",
    fuel: "Flex",
    status: "disponivel",
    featured: false,
    photos: [],
  };
  writeFavoriteSnapshot(sample);
  const found = snapshotsForIds([sample.id, "missing"]);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.model, "HB20");
});
