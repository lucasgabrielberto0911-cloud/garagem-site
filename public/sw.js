/*
 * Service worker do site público da Sua Garagem (garagem-v8).
 *
 * HTML de navegação: rede com prazo de 2,5s; se falhar ou demorar, o cache.
 * Assim o desktop em rede boa recebe a página nova, e a home/estoque abrem
 * offline ou com sinal ruim. A ficha (`/estoque/[slug]`) não é cacheada —
 * preço e status pedem rede; sem rede, cai em /offline.
 *
 * `/_next/static` = cache-first (arquivo com hash).
 * Admin, API, atalhos externos e `/_next/image` ficam fora.
 * RSC do App Router não entra no cache (o payload é parcial e quebra depois
 * do deploy). No offline o cliente força navegação completa para este HTML.
 *
 * Atualização: `skipWaiting` deixa o SW novo ativo, mas `clients.claim()` só
 * roda na primeira instalação. Num deploy, a aba aberta continua no SW antigo
 * até o próximo carregamento — sem misturar HTML novo com chunks velhos.
 *
 * `/?utm_source=pwa` e `/` compartilham a mesma entrada de cache.
 * Regras de rota espelham `src/lib/pwa-page-key.ts`.
 */
const VERSION = "garagem-v8";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE_LIMIT = 80;
const PAGE_CACHE_LIMIT = 40;
const NETWORK_TIMEOUT_MS = 2500;
const TRACKING_PARAM =
  /^(utm_|fbclid|gclid|gbraid|wbraid|msclkid|_vercel|ttclid)/i;

const SHELL_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/branding/logo-wordmark.webp",
];

const PRECACHE_PAGES = ["/", "/estoque", "/favoritos"];

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const keys = await caches.keys();
      const previous = keys.filter((key) => !key.startsWith(VERSION));
      await Promise.all(previous.map((key) => caches.delete(key)));
      await warmStartPages();
      if (previous.length === 0) {
        await self.clients.claim();
      }
    })(),
  );
});

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function isVehicleDetailPath(pathname) {
  const path = normalizePathname(pathname);
  return path.startsWith("/estoque/") && path !== "/estoque";
}

function pageCacheKey(request) {
  const url = new URL(request.url);
  url.searchParams.delete("_rsc");
  for (const name of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(name)) url.searchParams.delete(name);
  }
  const pathname = normalizePathname(url.pathname);
  const search = url.searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
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
  if (request.headers.get("Next-Router-Segment-Prefetch")) return false;
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

function isHtmlDocument(response) {
  if (!response || !response.ok) return false;
  if (response.type === "opaque" || response.type === "opaqueredirect") return false;
  const type = response.headers.get("content-type") || "";
  return type.includes("text/html");
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
  return (
    (await cache.match(key, { ignoreVary: true })) ||
    (await cache.match(request, { ignoreVary: true }))
  );
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

async function addIfOk(cache, url) {
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    if (response && response.ok) await cache.put(url, response);
  } catch {
    /* ignora — um asset em falta não pode impedir o SW de instalar */
  }
}

async function precache() {
  const shell = await caches.open(SHELL_CACHE);
  const pages = await caches.open(PAGE_CACHE);
  await Promise.all([
    ...SHELL_URLS.map((url) => addIfOk(shell, url)),
    ...PRECACHE_PAGES.map((url) => addIfOk(pages, url)),
  ]);
}

async function warmStartPages() {
  const cache = await caches.open(PAGE_CACHE);
  await Promise.all(PRECACHE_PAGES.map((path) => addIfOk(cache, path)));
}

async function fetchFreshPage(event, request) {
  try {
    let response = null;
    if (event) {
      try {
        response = await event.preloadResponse;
      } catch {
        response = null;
      }
    }
    if (!response) response = await fetch(request);
    if (!response) return null;
    if (isHtmlDocument(response)) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(pageCacheKey(request), response.clone());
      trimCache(PAGE_CACHE, PAGE_CACHE_LIMIT).catch(() => undefined);
    }
    return response;
  } catch {
    return null;
  }
}

async function maybeReloadIfShellChanged(cached, fresh, clientId) {
  try {
    const [oldHtml, newHtml] = await Promise.all([
      cached.clone().text(),
      fresh.clone().text(),
    ]);
    const previous = shellFingerprint(oldHtml);
    const next = shellFingerprint(newHtml);
    if (!previous || !next || previous === next) return;
    const client = clientId ? await self.clients.get(clientId) : null;
    if (!client || client.url.includes("/admin")) return;
    client.postMessage({ type: "GARAGEM_RELOAD" });
  } catch {
    /* ignore */
  }
}

async function offlineResponse() {
  const shell = await caches.open(SHELL_CACHE);
  const offline =
    (await shell.match("/offline", { ignoreVary: true })) ||
    (await caches.open(PAGE_CACHE).then((cache) => cache.match("/offline", { ignoreVary: true })));
  if (offline) return offline;
  return new Response("Sem conexão", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function networkOnlyPage(event) {
  try {
    let response = null;
    try {
      response = await event.preloadResponse;
    } catch {
      response = null;
    }
    if (!response) response = await fetch(event.request);
    if (response) return response;
  } catch {
    /* sem rede */
  }
  return offlineResponse();
}

async function networkTimeoutPage(event) {
  const cache = await caches.open(PAGE_CACHE);
  const cached = await matchPage(cache, event.request);
  const freshPromise = fetchFreshPage(event, event.request);

  if (!cached) {
    const fresh = await freshPromise;
    if (fresh) return fresh;
    return offlineResponse();
  }

  let timer = 0;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve("timeout"), NETWORK_TIMEOUT_MS);
  });
  const raced = await Promise.race([
    freshPromise.then((response) => ({ type: "fresh", response })),
    timeout.then(() => ({ type: "timeout" })),
  ]);
  clearTimeout(timer);

  if (raced.type === "fresh") {
    if (raced.response) return raced.response;
    return cached;
  }

  const cachedSnapshot = cached.clone();
  event.waitUntil(
    freshPromise.then((fresh) => {
      if (fresh) return maybeReloadIfShellChanged(cachedSnapshot, fresh, event.clientId);
      return undefined;
    }),
  );
  return cached;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/atalho") ||
    url.pathname.startsWith("/_next/image")
  ) {
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (!isNavigate(request)) return;

  if (isVehicleDetailPath(url.pathname)) {
    event.respondWith(networkOnlyPage(event));
    return;
  }

  // Home, /estoque e o resto do HTML público. A ficha já saiu acima.
  event.respondWith(networkTimeoutPage(event));
});
