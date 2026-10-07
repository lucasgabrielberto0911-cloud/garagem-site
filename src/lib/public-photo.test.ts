import assert from "node:assert/strict";
import { test } from "node:test";
import { publicPhotoSrc, publicPhotoSrcSet, publicPhotoOriginal, publicPhotoUpstream, PUBLIC_PHOTO_VARIANTS, PHOTO_STORAGE_ORIGIN } from "./public-photo-url";
import { servePublicPhoto } from "./public-photo-http";
import { coverMobileSrcSet, galleryPreviewSrcSet, supabaseOriginalSrc } from "./stock-query";

const key = "1790028541547-df27c432-7b16-4456-8b26-48cdfaa28b27.webp";
const original = `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/${key}`;
const own = `/fotos/v1/original/${key}`;
const request = (path = own, method = "GET") => new Request("https://www.suagaragem.net" + path, { method });

test("foto e recortes do celular mantêm dimensões/qualidade e apontam para o site", () => {
  assert.equal(publicPhotoSrc(original), own);
  const mobile = publicPhotoSrcSet(coverMobileSrcSet([{ url: original }]));
  assert.equal(mobile, `/fotos/v1/480x360-cover-q74/${key} 480w`);
  assert.equal(publicPhotoSrcSet(galleryPreviewSrcSet({ id: "p", url: original })), `/fotos/v1/800-contain-q80/${key} 800w, ${own} 1280w`);
  for (const [variant, query] of Object.entries(PUBLIC_PHOTO_VARIANTS)) {
    const upstream = `${PHOTO_STORAGE_ORIGIN}/storage/v1/render/image/public/veiculos/${key}?${query}`;
    assert.equal(publicPhotoSrc(upstream), `/fotos/v1/${variant}/${key}`);
    assert.equal(publicPhotoUpstream(["v1", variant, key]), upstream);
    assert.equal(publicPhotoOriginal(`/fotos/v1/${variant}/${key}`), own);
    assert.equal(supabaseOriginalSrc(`https://www.suagaragem.net/fotos/v1/${variant}/${key}`), "https://www.suagaragem.net" + own);
  }
});

test("não transforma imagens externas, documentos privados nem recortes desconhecidos", () => {
  for (const url of ["/branding/placeholder-car.png", "https://cdn.example/photo.webp", original.replace("veiculos", "documentos"), original + "?token=private", original.replace("object/public", "object/sign"), original.replace("object/public", "render/image/public") + "?width=2000", original.replace("veiculos/", "veiculos/%2e%2e/")]) assert.equal(publicPhotoSrc(url), url);
  assert.equal(publicPhotoOriginal(own), null);
  for (const parts of [["v1", "original", "..", "secret.webp"], ["v1", "original", "%2fsecret.webp"], ["v1", "original", "document.pdf"], ["v1", "original", "https:", "example.webp"], ["v1", "constructor", key]]) assert.equal(publicPhotoUpstream(parts), null);
});

test("GET mantém os bytes e remove noindex, cookies e cache do Storage; HEAD é equivalente", async () => {
  const bytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);
  let calls = 0;
  const fetcher: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(url, original);
    assert.equal(options?.redirect, "error");
    assert.equal(options?.cache, "no-store");
    assert.deepEqual(options?.headers, { Accept: "image/webp,image/jpeg,image/png,image/gif" });
    return new Response(options?.method === "HEAD" ? null : bytes, { headers: { "Content-Type": "image/webp", "X-Robots-Tag": "none", "Set-Cookie": "secret=1", "Cache-Control": "no-cache", "ETag": '"photo"', "Vary": "Cookie" } });
  };
  const get = await servePublicPhoto(request(), ["v1", "original", key], fetcher);
  const head = await servePublicPhoto(request(own, "HEAD"), ["v1", "original", key], fetcher);
  assert.equal(calls, 2);
  assert.deepEqual(new Uint8Array(await get.arrayBuffer()), bytes);
  assert.equal(await head.text(), "");
  assert.deepEqual([...get.headers], [...head.headers]);
  assert.equal(get.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(get.headers.get("cdn-cache-control"), "public, s-maxage=31536000");
  for (const header of ["x-robots-tag", "set-cookie", "vary"]) assert.equal(get.headers.get(header), null);
});

test("miniatura substituível tem cache longo e revalidação", async () => {
  const response = await servePublicPhoto(request(), ["v1", "original", "car-card.webp"], async () => new Response("image", { headers: { "Content-Type": "image/webp" } }));
  assert.match(response.headers.get("cache-control")!, /max-age=604800/);
  assert.doesNotMatch(response.headers.get("cache-control")!, /immutable/);
});

test("erros, HTML, redirect e falhas de rede não ficam cacheados", async () => {
  for (const response of [new Response("missing", { status: 404 }), new Response("error", { status: 503 }), new Response("login", { headers: { "Content-Type": "text/html" } }), new Response("partial", { status: 206, headers: { "Content-Type": "image/webp" } })]) {
    const result = await servePublicPhoto(request(), ["v1", "original", key], async () => response);
    assert.equal(result.status, response.status === 404 ? 404 : 502);
    assert.equal(result.headers.get("cache-control"), "no-store");
  }
  const failed = await servePublicPhoto(request(), ["v1", "original", key], async () => { throw new Error("timeout"); });
  assert.equal(failed.status, 502);
  assert.equal(failed.headers.get("cache-control"), "no-store");
  const forbidden = async () => { throw new Error("não deveria buscar"); };
  assert.equal((await servePublicPhoto(request(own + "?width=9000"), ["v1", "original", key], forbidden)).status, 404);
  assert.equal((await servePublicPhoto(request(), ["v1", "9000-cover", key], forbidden)).status, 404);
});
