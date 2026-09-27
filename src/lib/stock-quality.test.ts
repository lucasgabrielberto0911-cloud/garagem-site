import assert from "node:assert/strict";
import { test } from "node:test";
import {
  editListingGapLine,
  editListingGaps,
  formatRelativeUpdatedAt,
  listingGapBadges,
  stockListQuietNote,
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

test("edição lista lacunas sem badge; vendido não lista", () => {
  assert.deepEqual(
    editListingGaps({
      status: "disponivel",
      color: "",
      photoCount: 0,
      price: 0,
      hasVideo: false,
    }),
    ["fotos", "preço", "cor", "vídeo"],
  );
  assert.equal(
    editListingGapLine({
      status: "disponivel",
      color: "Prata",
      photoCount: 4,
      price: 64900,
      hasVideo: false,
    }),
    "Falta no cadastro: vídeo",
  );
  assert.equal(
    editListingGapLine({
      status: "disponivel",
      color: "Prata",
      photoCount: 4,
      price: 89900,
      hasVideo: true,
      version: "EX 1.8 FLEX ONE Automático",
      transmission: "Manual",
    }),
    "Falta no cadastro: câmbio da versão",
  );
  assert.equal(
    editListingGaps({
      status: "vendido",
      color: "",
      photoCount: 0,
      price: 0,
      hasVideo: false,
    }).length,
    0,
  );
  assert.equal(
    editListingGapLine({
      status: "disponivel",
      color: "Prata",
      photoCount: 2,
      price: 50000,
      hasVideo: true,
    }),
    null,
  );
});

test("resumo da lista não cita vídeo", () => {
  assert.equal(
    stockListQuietNote({ withoutPhotos: 0, stale: 0, staleDays: 60 }),
    null,
  );
  assert.equal(
    stockListQuietNote({ withoutPhotos: 1, stale: 0, staleDays: 60 }),
    "1 anúncio sem foto",
  );
  const note = stockListQuietNote({ withoutPhotos: 3, stale: 2, staleDays: 60 });
  assert.equal(note, "3 anúncios sem foto · 2 parados há mais de 60 dias");
  assert.equal(note?.includes("vídeo"), false);
});

test("tempo relativo do lote fala em minutos, horas e dias", () => {
  const now = Date.parse("2026-09-14T20:00:00.000Z");
  assert.equal(formatRelativeUpdatedAt(new Date(now - 30_000), now), "agora");
  assert.equal(formatRelativeUpdatedAt(new Date(now - 12 * 60_000), now), "há 12 min");
  assert.equal(formatRelativeUpdatedAt(new Date(now - 2 * 60 * 60_000), now), "há 2 h");
  assert.equal(formatRelativeUpdatedAt(new Date(now - 26 * 60 * 60_000), now), "há 1 dia");
  assert.equal(formatRelativeUpdatedAt("nao-e-data", now), "");
});
