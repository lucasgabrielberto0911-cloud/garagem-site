import assert from "node:assert/strict";
import { test } from "node:test";
import {
  coverSrc,
  coverSrcSet,
  galleryPreviewSrc,
  galleryPreviewSrcSet,
  galleryThumbSrc,
  supabaseCardSrc,
  supabaseOriginalSrc,
} from "./stock-query";

const ORIGINAL =
  "https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/foto.webp";

test("supabaseCardSrc recorta o original do Storage", () => {
  const src = supabaseCardSrc(ORIGINAL);
  assert.match(src, /\/storage\/v1\/render\/image\/public\/veiculos\/foto\.webp\?/);
  assert.match(src, /width=480/);
  assert.match(src, /height=300/);
  assert.match(src, /resize=cover/);
  assert.equal(src.includes("/object/public/"), false);
});

test("supabaseOriginalSrc devolve o arquivo se o recorte falhar", () => {
  const rendered = supabaseCardSrc(ORIGINAL, 720, 450);
  assert.equal(supabaseOriginalSrc(rendered), ORIGINAL);
  assert.equal(supabaseOriginalSrc(ORIGINAL), ORIGINAL);
});

test("coverSrc usa thumbnail quando existe e recorte quando não", () => {
  assert.equal(
    coverSrc([{ url: ORIGINAL, thumbnailUrl: "https://cdn.example/card.webp" }]),
    "https://cdn.example/card.webp",
  );
  assert.equal(coverSrc([{ url: ORIGINAL, thumbnailUrl: null }]), supabaseCardSrc(ORIGINAL));
  assert.equal(coverSrcSet([{ url: ORIGINAL, thumbnailUrl: "https://cdn.example/card.webp" }]), undefined);
  assert.match(coverSrcSet([{ url: ORIGINAL }]) ?? "", /480w/);
  assert.match(coverSrcSet([{ url: ORIGINAL }]) ?? "", /720w/);
});

test("galleryThumbSrc recorta o strip; preview não usa o original", () => {
  const photo = { id: "1", url: ORIGINAL, thumbnailUrl: null };
  assert.match(galleryThumbSrc(photo), /width=240/);
  assert.match(galleryPreviewSrc(photo), /width=960/);
  assert.match(galleryPreviewSrcSet(photo) ?? "", /640w/);
  assert.equal(
    galleryThumbSrc({ id: "1", url: ORIGINAL, thumbnailUrl: "https://cdn.example/card.webp" }),
    "https://cdn.example/card.webp",
  );
});
