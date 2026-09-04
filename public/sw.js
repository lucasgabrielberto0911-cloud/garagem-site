/*
 * Service worker do site da Garagem.
 *
 * Assets versionados (/_next/static) = cache-first.
 * Navegação = mostra o HTML em cache na hora e atualiza atrás
 * (stale-while-revalidate). Sem cache, busca a rede; se falhar, /offline.
 *
 * Admin e API ficam fora. `/?utm_source=pwa` e `/` compartilham a mesma
 * entrada — senão a abertura do app instalado nunca acerta o cache.
 */
const VERSION = "garagem-v4";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE_LIMIT = 80;
const PAGE_CACHE_LIMIT = 40;
const TRACKING_PARAM =
  /^(utm_|fbclid|gclid|gbraid|wbraid|msclkid|_vercel|ttclid)/i;

const SHELL_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/branding/logo-wordmark.webp",
];

const WARM_PAGES = ["/", "/estoque"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
  void warmStartPages();
});

function pageCacheKey(request) {
  const url = new URL(request.url);
  for (const name of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(name)) url.searchParams.delete(name);
  }
  const search = url.searchParams.toString();
  return search ? `${url.pathname}?${search}` : url.pathname;
}

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/branding/") ||
    /\.(?:png|jpg|jpeg|webp|avif|svg|woff2)$/.test(url.pathname)
  );
}

function isNavigate(request) {
  if (request.headers.get("RSC") === "1") return false;
  if (request.headers.get("Next-Router-Prefetch")) return false;
  return (
    request.mode === "navigate" ||
    (request.destination === "document" &&
      (request.headers.get("accept") || "").includes("text/html"))
  );
}

function shellFingerprint(html) {
  const match = html.match(/\/_next\/static\/(?:chunks\/)?[^"'\\\s]+/);
  return match ? match[0] : "";
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((request) => cache.delete(request)),
  );
}

async function matchPage(cache, request) {
  const key = pageCacheKey(request);
  return (await cache.match(key)) || (await cache.match(request));
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
    trimCache(cacheName, ASSET_CACHE_LIMIT).catch(() => undefined);
  }
  return response;
}

async function warmStartPages() {
  const cache = await caches.open(PAGE_CACHE);
  await Promise.all(
    WARM_PAGES.map(async (path) => {
      try {
        const response = await fetch(path, { credentials: "same-origin" });
        if (response && response.ok) await cache.put(path, response);
      } catch {
        /* ignore */
      }
    }),
  );
}

async function fetchFreshPage(event, request) {
  try {
    const preloaded = await event.preloadResponse;
    const response = preloaded || (await fetch(request));
    if (response && response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(pageCacheKey(request), response.clone());
      trimCache(PAGE_CACHE, PAGE_CACHE_LIMIT).catch(() => undefined);
    }
    return response && response.ok ? response : null;
  } catch {
    return null;
  }
}

async function maybeReloadIfShellChanged(cached, fresh) {
  try {
    const [oldHtml, newHtml] = await Promise.all([
      cached.clone().text(),
      fresh.clone().text(),
    ]);
    const previous = shellFingerprint(oldHtml);
    const next = shellFingerprint(newHtml);
    if (!previous || !next || previous === next) return;
    const windows = await self.clients.matchAll({ type: "window" });
    for (const client of windows) {
      client.postMessage({ type: "GARAGEM_RELOAD" });
    }
  } catch {
    /* ignore */
  }
}

async function staleWhileRevalidatePage(event) {
  const { request } = event;
  const cache = await caches.open(PAGE_CACHE);
  const cached = await matchPage(cache, request);
  const networkPromise = fetchFreshPage(event, request);

  if (cached) {
    event.waitUntil(
      networkPromise.then((fresh) => {
        if (fresh) return maybeReloadIfShellChanged(cached, fresh);
        return undefined;
      }),
    );
    return cached;
  }

  const fresh = await networkPromise;
  if (fresh) return fresh;

  const shell = await caches.open(SHELL_CACHE);
  const offline = await shell.match("/offline");
  if (offline) return offline;
  return Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/_next/image")
  ) {
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (isNavigate(request)) {
    event.respondWith(staleWhileRevalidatePage(event));
  }
});
