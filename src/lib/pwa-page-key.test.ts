import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isNetworkOnlyPagePath,
  isPrecachedShellPath,
  isStockListingPath,
  pageCacheKeyFromUrl,
} from "./pwa-page-key";

test("PWA start_url com utm usa o cache da home", () => {
  assert.equal(pageCacheKeyFromUrl("https://www.suagaragem.net/?utm_source=pwa"), "/");
  assert.equal(pageCacheKeyFromUrl("https://www.suagaragem.net/"), "/");
  assert.equal(pageCacheKeyFromUrl("/?utm_source=pwa&utm_medium=homescreen"), "/");
});

test("lista do estoque entra no cache; a ficha fica só na rede", () => {
  assert.equal(isStockListingPath("/"), false);
  assert.equal(isStockListingPath("/estoque"), true);
  assert.equal(isStockListingPath("/estoque/"), true);
  assert.equal(isStockListingPath("/estoque/hyundai-hb20"), false);
  assert.equal(isNetworkOnlyPagePath("/estoque/hyundai-hb20"), true);
  assert.equal(isNetworkOnlyPagePath("/estoque/hyundai-hb20/"), true);
  assert.equal(isNetworkOnlyPagePath("/estoque"), false);
  assert.equal(isPrecachedShellPath("/"), true);
  assert.equal(isPrecachedShellPath("/estoque"), true);
  assert.equal(isPrecachedShellPath("/favoritos"), true);
  assert.equal(isPrecachedShellPath("/vender"), false);
});

test("filtros reais do estoque continuam na chave e o _rsc do Next sai", () => {
  assert.equal(
    pageCacheKeyFromUrl("https://www.suagaragem.net/estoque?q=honda&utm_source=pwa"),
    "/estoque?q=honda",
  );
  assert.equal(
    pageCacheKeyFromUrl("/estoque/?q=honda&_rsc=abc123"),
    "/estoque?q=honda",
  );
});
