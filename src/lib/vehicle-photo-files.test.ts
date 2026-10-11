import assert from "node:assert/strict";
import { test } from "node:test";
import { replacedThumbnails } from "./vehicle-photo-files";

test("reenquadrar a capa libera a miniatura antiga, sem tocar nas outras", () => {
  const previous = [
    { url: "a.webp", thumbnailUrl: "a-card.webp" },
    { url: "b.webp", thumbnailUrl: "b-card.webp" },
    { url: "c.webp", thumbnailUrl: null },
  ];
  const next = [
    { url: "a.webp", thumbnailUrl: "a-card-x100y900z150.webp" },
    { url: "b.webp", thumbnailUrl: "b-card.webp" },
    { url: "c.webp", thumbnailUrl: "c-card-x500y500z100.webp" },
  ];
  assert.deepEqual(replacedThumbnails(previous, next), ["a-card.webp"]);
});

test("foto removida não entra aqui (a exclusão da foto já cuida da miniatura)", () => {
  assert.deepEqual(replacedThumbnails([{ url: "a.webp", thumbnailUrl: "a-card.webp" }], []), []);
  assert.deepEqual(replacedThumbnails([{ url: "a.webp", thumbnailUrl: "a-card.webp" }], [{ url: "a.webp", thumbnailUrl: "a-card.webp" }]), []);
});

test("miniatura que continua em outra foto do anúncio é preservada", () => {
  const previous = [{ url: "a.webp", thumbnailUrl: "shared-card.webp" }];
  const next = [{ url: "a.webp", thumbnailUrl: null }, { url: "z.webp", thumbnailUrl: "shared-card.webp" }];
  assert.deepEqual(replacedThumbnails(previous, next), []);
});
