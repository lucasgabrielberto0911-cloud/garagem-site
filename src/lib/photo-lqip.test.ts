import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import sharp from "sharp";
import { VehicleCard } from "@/components/site/VehicleCard";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { FavoritesProvider } from "@/lib/favorites";
import {
  MAX_LQIP_MEMORY_ENTRIES,
  attachCachedPhotoLqip,
  clearPhotoLqipMemoryCacheForTests,
  isAllowedLqipUrl,
  isValidLqipDataUri,
  photoLqipMemoryCacheSizeForTests,
  setCachedPhotoLqip,
} from "@/lib/photo-lqip-cache";
import {
  enrichVehiclesWithLqip,
  generatePhotoLqip,
  lqipFromImageBuffer,
} from "@/lib/photo-lqip";
import {
  PHOTO_BLOB_ORIGIN,
  PHOTO_R2_ORIGIN,
  PHOTO_STORAGE_ORIGIN,
  publicPhotoR2Origin,
} from "@/lib/public-photo-url";
import {
  CARD_SIZES,
  HOME_PRIORITY_COUNT,
  STOCK_PRIORITY_COUNT,
  cardImageLoadingPlan,
  type VehicleCardRecord,
} from "@/lib/stock-query";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(srcRoot, "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

function makeVehicle(index: number, lqip?: string | null): VehicleCardRecord {
  const key = `179000000000${index}-carro-${index}`;
  return {
    id: `clqip000000000000000000${index}`,
    brand: "Honda",
    model: `Civic ${index}`,
    version: "LXR 2.0",
    yearModel: 2020,
    km: 55000,
    price: 74900,
    transmission: "Automático",
    fuel: "Flex",
    status: "disponivel",
    featured: index === 0,
    createdAt: new Date("2026-10-01T12:00:00Z"),
    photos: [
      {
        url: `${PHOTO_R2_ORIGIN}/${key}.webp`,
        thumbnailUrl: `${PHOTO_R2_ORIGIN}/${key}-card.webp`,
        ...(lqip !== undefined ? { lqip } : {}),
      },
    ],
  };
}

async function sampleWebpBuffer(): Promise<Buffer> {
  // Gera imagem sintética colorida 480×360 (mesmo porte da miniatura real).
  const width = 480;
  const height = 360;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      raw[idx] = Math.round((x / width) * 200);
      raw[idx + 1] = Math.round((y / height) * 140);
      raw[idx + 2] = 90;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).webp({ quality: 78 }).toBuffer();
}

test("isAllowedLqipUrl aceita apenas R2 da loja, Blob e bucket público veiculos", () => {
  assert.equal(isAllowedLqipUrl(`${PHOTO_R2_ORIGIN}/1790-foto-card.webp`), true);
  assert.equal(isAllowedLqipUrl(`${PHOTO_BLOB_ORIGIN}/estoque/foto-card.webp`), true);
  assert.equal(
    isAllowedLqipUrl(`${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/foto-card.webp`),
    true,
  );

  // Hosts externos, HTTP, SSRF, credenciais, query string, path traversal e bucket privado são recusados.
  for (const blocked of [
    "http://pub-92a1bcb633c0472bbd89ca0f450e5935.r2.dev/foto.webp",
    "https://evil.example/foto.webp",
    "https://127.0.0.1/foto.webp",
    "https://169.254.169.254/latest/meta-data/",
    "https://pub-outro-host-desconhecido.r2.dev/foto.webp",
    `${PHOTO_R2_ORIGIN}:8443/foto.webp`,
    `${PHOTO_R2_ORIGIN}/foto.webp?download=1`,
    `${PHOTO_R2_ORIGIN}/foto.webp#hash`,
    `${PHOTO_R2_ORIGIN}/../segredo.webp`,
    `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/documentos/cnh.jpg`,
    `${PHOTO_STORAGE_ORIGIN}/storage/v1/render/image/public/veiculos/foto.webp?width=480`,
    "https://user:pass@pub-92a1bcb633c0472bbd89ca0f450e5935.r2.dev/foto.webp",
    "",
    null,
  ]) {
    assert.equal(isAllowedLqipUrl(blocked), false, String(blocked));
  }

  const prevR2 = process.env.R2_PUBLIC_URL;
  try {
    process.env.R2_PUBLIC_URL = "https://fotos.suagaragem.net";
    assert.equal(publicPhotoR2Origin(), "https://fotos.suagaragem.net");
    assert.equal(isAllowedLqipUrl("https://fotos.suagaragem.net/1790-foto-card.webp"), true);
    assert.equal(isAllowedLqipUrl(`${PHOTO_R2_ORIGIN}/1790-foto-card.webp`), true);
  } finally {
    if (prevR2 === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = prevR2;
  }
});

test("generatePhotoLqip gera WebP 16x12 leve, usa cache em memória e cai em undefined em falha/timeout", async () => {
  clearPhotoLqipMemoryCacheForTests();
  const sample = await sampleWebpBuffer();
  const url = `${PHOTO_R2_ORIGIN}/1790028541547-teste-card.webp`;
  let calls = 0;

  const okFetcher: typeof fetch = async () => {
    calls += 1;
    return new Response(new Uint8Array(sample), {
      status: 200,
      headers: { "Content-Type": "image/webp" },
    });
  };

  const first = await generatePhotoLqip(url, { fetcher: okFetcher });
  assert.ok(first, "deve gerar data URI");
  assert.equal(isValidLqipDataUri(first), true);
  assert.match(first, /^data:image\/webp;base64,/);
  assert.ok(first.length < 600, `LQIP deve ser compacto (obtido ${first.length} chars)`);

  // Segunda chamada usa o cache em memória sem novo fetch.
  const second = await generatePhotoLqip(url, { fetcher: okFetcher });
  assert.equal(second, first);
  assert.equal(calls, 1);

  // Fixture do repo também gera LQIP compacto (~150–400 bytes).
  const fixtureBytes = readFileSync(join(repoRoot, "public/branding/placeholder-car.png"));
  const fixtureLqip = await lqipFromImageBuffer(fixtureBytes);
  assert.equal(isValidLqipDataUri(fixtureLqip), true);
  assert.ok(fixtureLqip.length < 600);

  // Host proibido nem chama o fetcher.
  let forbiddenCalls = 0;
  const blocked = await generatePhotoLqip("https://evil.example/foto.webp", {
    fetcher: async () => {
      forbiddenCalls += 1;
      return new Response(new Uint8Array(sample), { status: 200 });
    },
  });
  assert.equal(blocked, undefined);
  assert.equal(forbiddenCalls, 0);

  // Timeout curto retorna undefined sem lançar erro.
  const timedOutUrl = `${PHOTO_R2_ORIGIN}/1790028541547-lento-card.webp`;
  const timedOut = await generatePhotoLqip(timedOutUrl, {
    timeoutMs: 60,
    fetcher: (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }),
  });
  assert.equal(timedOut, undefined);

  // HTTP 500 e Content-Type inválido retornam undefined.
  const failed = await generatePhotoLqip(`${PHOTO_R2_ORIGIN}/1790028541547-erro-card.webp`, {
    fetcher: async () => new Response("erro", { status: 500, headers: { "Content-Type": "text/plain" } }),
  });
  assert.equal(failed, undefined);

  const wrongType = await generatePhotoLqip(`${PHOTO_R2_ORIGIN}/1790028541547-html-card.webp`, {
    fetcher: async () => new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } }),
  });
  assert.equal(wrongType, undefined);

  clearPhotoLqipMemoryCacheForTests();
});

test("cache em memória respeita o teto MAX_LQIP_MEMORY_ENTRIES e attachCachedPhotoLqip não puxa sharp", () => {
  clearPhotoLqipMemoryCacheForTests();
  const dummyUri = "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
  for (let i = 0; i < MAX_LQIP_MEMORY_ENTRIES + 25; i++) {
    setCachedPhotoLqip(`${PHOTO_R2_ORIGIN}/item-${i}-card.webp`, dummyUri);
  }
  assert.equal(photoLqipMemoryCacheSizeForTests(), MAX_LQIP_MEMORY_ENTRIES);

  const vCached = makeVehicle(1);
  setCachedPhotoLqip(vCached.photos[0].thumbnailUrl!, dummyUri);
  const vCold = makeVehicle(2);
  const attached = attachCachedPhotoLqip([vCached, vCold]);
  assert.equal(attached[0].photos[0].lqip, dummyUri);
  assert.equal(attached[1].photos[0].lqip, undefined);

  // Garante que rotas sem sharp não importam photo-lqip.ts nem sharp.
  for (const rel of [
    "lib/photo-lqip-cache.ts",
    "app/api/estoque/route.ts",
    "app/api/veiculos/route.ts",
  ]) {
    const code = readSrc(rel);
    assert.doesNotMatch(code, /from\s+["']sharp["']|from\s+["']@\/lib\/photo-lqip["']|\bphoto-lqip["']/);
  }

  clearPhotoLqipMemoryCacheForTests();
});

test("enrichVehiclesWithLqip limita quantidade em paralelo e preserva lista vazia", async () => {
  const empty: VehicleCardRecord[] = [];
  assert.equal(await enrichVehiclesWithLqip(empty), empty);

  const dummyUri = "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
  const vehicles = Array.from({ length: 5 }, (_, i) => makeVehicle(i));
  const seen: string[] = [];
  const enriched = await enrichVehiclesWithLqip(vehicles, {
    limit: 3,
    resolver: async (url) => {
      seen.push(url);
      return url.includes("carro-1") ? undefined : dummyUri;
    },
  });

  assert.equal(seen.length, 3);
  assert.equal(enriched[0].photos[0].lqip, dummyUri);
  assert.equal(enriched[1].photos[0].lqip, undefined);
  assert.equal(enriched[2].photos[0].lqip, dummyUri);
  assert.equal(enriched[3].photos[0].lqip, undefined);
  assert.equal(enriched[4].photos[0].lqip, undefined);
});

test("cardImageLoadingPlan e VehicleGrid aplicam high nas 2 primeiras (preload só na 1ª), eager/auto na 1ª dobra e lazy/low no resto", () => {
  assert.equal(STOCK_PRIORITY_COUNT, 6);
  assert.equal(HOME_PRIORITY_COUNT, 4);

  assert.deepEqual(cardImageLoadingPlan(0, STOCK_PRIORITY_COUNT), {
    preload: true,
    priority: true,
    eager: false,
    loading: "eager",
    fetchPriority: "high",
    decoding: "sync",
  });
  assert.deepEqual(cardImageLoadingPlan(1, STOCK_PRIORITY_COUNT), {
    preload: false,
    priority: true,
    eager: false,
    loading: "eager",
    fetchPriority: "high",
    decoding: "async",
  });
  for (const idx of [2, 3, 4, 5]) {
    assert.deepEqual(cardImageLoadingPlan(idx, STOCK_PRIORITY_COUNT), {
      preload: false,
      priority: false,
      eager: true,
      loading: "eager",
      fetchPriority: "auto",
      decoding: "async",
    });
  }
  assert.deepEqual(cardImageLoadingPlan(6, STOCK_PRIORITY_COUNT), {
    preload: false,
    priority: false,
    eager: false,
    loading: "lazy",
    fetchPriority: "low",
    decoding: "async",
  });
  assert.deepEqual(cardImageLoadingPlan(0, 0), {
    preload: false,
    priority: false,
    eager: false,
    loading: "lazy",
    fetchPriority: "low",
    decoding: "async",
  });

  const vehicles = Array.from({ length: 8 }, (_, i) => makeVehicle(i));
  const html = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleGrid, { vehicles, priorityCount: STOCK_PRIORITY_COUNT }),
    ),
  );
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(imgs.length, 8);
  assert.match(imgs[0], /fetchpriority="high"/i);
  assert.match(imgs[0], /loading="eager"/);
  assert.match(imgs[0], /decoding="sync"/);

  assert.match(imgs[1], /fetchpriority="high"/i);
  assert.match(imgs[1], /loading="eager"/);
  assert.match(imgs[1], /decoding="async"/);

  for (const idx of [2, 3, 4, 5]) {
    assert.match(imgs[idx], /fetchpriority="auto"/i);
    assert.match(imgs[idx], /loading="eager"/);
  }
  for (const idx of [6, 7]) {
    assert.match(imgs[idx], /fetchpriority="low"/i);
    assert.match(imgs[idx], /loading="lazy"/);
  }
});

test("VehicleCard renderiza LQIP seguro atrás do <img>, nunca oculta foto no SSR e não usa bg-asphalt chapado", () => {
  const validLqip = "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
  const htmlWithLqip = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleCard, { vehicle: makeVehicle(0, validLqip) }),
    ),
  );
  assert.match(htmlWithLqip, /data-photo-lqip=""/);
  assert.match(htmlWithLqip, /background-image:url\(/);
  assert.doesNotMatch(htmlWithLqip, /listing-card-photo[^>]*bg-asphalt/);
  // Sem JS o atributo data-photo-state="loading" não aparece no HTML SSR.
  assert.doesNotMatch(htmlWithLqip, /data-photo-state="loading"/);
  assert.match(htmlWithLqip, /vehicle-photo-fade/);

  // Valor malicioso em lqip é descartado.
  const htmlUnsafeLqip = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleCard, { vehicle: makeVehicle(1, '") ; background: red; ("') }),
    ),
  );
  assert.doesNotMatch(htmlUnsafeLqip, /data-photo-lqip/);

  const css = readSrc("app/globals.css");
  assert.match(css, /\.listing-card-photo\s*\{[\s\S]*?linear-gradient\(/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.vehicle-photo-fade\s*\{\s*transition:\s*none;/);

  const remoteFill = readSrc("components/NativeRemoteFillImage.tsx");
  assert.match(remoteFill, /PHOTO_FADE_FALLBACK_MS/);
  assert.match(remoteFill, /addEventListener\("pageshow"/);

  const siteLayout = readSrc("app/(site)/layout.tsx");
  assert.match(siteLayout, /preconnect\(publicPhotoR2Origin\(\)\)/);
  assert.doesNotMatch(siteLayout, /preconnect\(publicPhotoR2Origin\(\),\s*\{[^}]*crossOrigin/);

  // CARD_SIZES corresponde à grade real de 4 colunas no desktop e 2 no celular.
  assert.match(CARD_SIZES, /\(min-width:\s*1440px\)\s*335px/);
  assert.match(CARD_SIZES, /\(min-width:\s*1024px\)\s*calc\(\(100vw - 100px\) \/ 4\)/);
  assert.match(CARD_SIZES, /calc\(\(100vw - 42px\) \/ 2\)/);
});
