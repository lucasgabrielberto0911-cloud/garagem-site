import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatRelativeUpdatedAt,
  listingGapBadges,
} from "./stock-quality";

test("badges de lote apontam cor, fotos e preço sem inventar FIPE", () => {
  assert.deepEqual(
    listingGapBadges({ color: "", photos: [], price: 0 }),
    ["Sem cor", "Sem fotos", "Sem preço"],
  );
  assert.deepEqual(
    listingGapBadges({ color: "Prata", photos: [{ url: "a.webp" }], price: 64900 }),
    [],
  );
  assert.deepEqual(
    listingGapBadges({ color: "  ", photos: [{ url: "a.webp" }], price: 89900 }),
    ["Sem cor"],
  );
  assert.equal(
    listingGapBadges({ color: "Branco", photos: [{ url: "a.webp" }], price: 89900 }).includes(
      "FIPE",
    ),
    false,
  );
});

test("tempo relativo do lote fala em minutos, horas e dias", () => {
  const now = Date.parse("2026-09-14T20:00:00.000Z");
  assert.equal(formatRelativeUpdatedAt(new Date(now - 30_000), now), "agora");
  assert.equal(formatRelativeUpdatedAt(new Date(now - 12 * 60_000), now), "há 12 min");
  assert.equal(formatRelativeUpdatedAt(new Date(now - 2 * 60 * 60_000), now), "há 2 h");
  assert.equal(formatRelativeUpdatedAt(new Date(now - 26 * 60 * 60_000), now), "há 1 dia");
  assert.equal(formatRelativeUpdatedAt("nao-e-data", now), "");
});
