import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

test("service worker não cacheia ficha e não toma a aba no meio do deploy", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /const VERSION = "garagem-v10"/);
  assert.match(sw, /const NETWORK_TIMEOUT_MS = 2500/);
  assert.match(sw, /function isVehicleDetailPath/);
  assert.match(sw, /path !== "\/estoque"/);
  assert.match(sw, /PRECACHE_PAGES = \["\/", "\/estoque", "\/favoritos"\]/);
  assert.match(sw, /url\.pathname\.startsWith\("\/atalho"\)/);
  assert.match(sw, /url\.pathname\.startsWith\("\/admin"\)/);
  assert.match(sw, /if \(isVehicleDetailPath\(url\.pathname\)\)/);
  assert.match(sw, /if \(previous\.length === 0\) \{\s*await self\.clients\.claim\(\)/);
  assert.equal((sw.match(/await self\.clients\.claim\(/g) || []).length, 1);
  assert.equal(sw.match(/workbox|serwist/g), null);
});

test("fotos públicas respeitam cache HTTP em vez de cache-first do service worker", () => {
  const listeners = new Map<string, (event: unknown) => void>();
  runInNewContext(read("public/sw.js"), { URL, self: {
    location: { origin: "https://www.suagaragem.net" },
    addEventListener: (name: string, callback: (event: unknown) => void) => listeners.set(name, callback),
  } });
  let intercepted = false;
  listeners.get("fetch")!({ request: { method: "GET", url: "https://www.suagaragem.net/fotos/v1/original/car-card.webp" }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
});

test("manifesto instala em standalone com atalhos de estoque, WhatsApp e vender", () => {
  const manifest = read("src/app/manifest.ts");
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /PWA_START_URL/);
  assert.match(manifest, /url: "\/estoque"/);
  assert.match(manifest, /url: PWA_WHATSAPP_SHORTCUT_PATH/);
  assert.match(manifest, /url: "\/vender"/);
  assert.match(manifest, /purpose: "maskable"/);
  assert.match(manifest, /#0D0D0F/);
});
