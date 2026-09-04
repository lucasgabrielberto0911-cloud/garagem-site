import assert from "node:assert/strict";
import { test } from "node:test";
import { pageCacheKeyFromUrl } from "./pwa-page-key";

test("PWA start_url com utm usa o cache da home", () => {
  assert.equal(pageCacheKeyFromUrl("https://www.suagaragem.net/?utm_source=pwa"), "/");
  assert.equal(pageCacheKeyFromUrl("https://www.suagaragem.net/"), "/");
  assert.equal(pageCacheKeyFromUrl("/?utm_source=pwa&utm_medium=homescreen"), "/");
});

test("filtros reais do estoque continuam na chave", () => {
  assert.equal(
    pageCacheKeyFromUrl("https://www.suagaragem.net/estoque?q=honda&utm_source=pwa"),
    "/estoque?q=honda",
  );
});
