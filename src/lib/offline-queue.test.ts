import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createIntentId,
  isLikelyNetworkFailure,
  snapshotsForIds,
  writeFavoriteSnapshot,
  writeFavoriteSnapshots,
  FAVORITE_SNAPSHOT_KEY,
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


test("grava o lote em uma operação e preserva favoritos fora da lista", () => {
  const store = globalThis as typeof globalThis & { localStorage?: Storage };
  const previous = store.localStorage;
  const memory = new Map<string, string>();
  let writes = 0;
  store.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => { writes++; memory.set(key, value); },
  } as Storage;
  const sample: FavoriteSnapshot = {
    id: "existing", brand: "Marca de teste", model: "Modelo de teste", version: null,
    yearModel: 2024, km: 0, price: 100, transmission: "Manual", fuel: "Flex",
    status: "disponivel", featured: false, photos: [],
  };
  try {
    writeFavoriteSnapshot(sample);
    writes = 0;
    writeFavoriteSnapshots([{ ...sample, id: "first" }, { ...sample, id: "second" }, { ...sample, id: "first", price: 200 }]);
    assert.equal(writes, 1);
    assert.deepEqual(snapshotsForIds(["existing", "first", "second"]).map(v => [v.id, v.price]), [["existing", 100], ["first", 200], ["second", 100]]);
    assert.ok(memory.has(FAVORITE_SNAPSHOT_KEY));
    writeFavoriteSnapshots([]);
    assert.equal(writes, 1);
    store.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
    assert.doesNotThrow(() => writeFavoriteSnapshots([sample]));
  } finally { store.localStorage = previous; }
});
