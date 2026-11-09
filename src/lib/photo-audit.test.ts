import assert from "node:assert/strict";
import { test } from "node:test";
import { auditPhotos, parseAuditVehicle, photoIdentity, probePhotoHead, type AuditVehicle } from "./photo-audit";

const base = "https://www.suagaragem.net";
const blob = "https://exemplo.public.blob.vercel-storage.com";
test("consulta fotos só por HEAD, sem redirects, credenciais, download ou fallback GET", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    assert.ok(String(url).startsWith(base + "/fotos/"));
    assert.equal(init?.method, "HEAD");
    assert.equal(init?.redirect, "manual");
    assert.equal(init?.headers, undefined);
    return new Response(null, { status: 502 });
  };
  const result = await probePhotoHead("https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/foto.webp", base, fetcher);
  assert.equal(result.status, 502);
  assert.equal(calls, 1);
  assert.equal((await probePhotoHead("https://privado.exemplo/foto.webp", base, fetcher)).status, 0);
  assert.equal((await probePhotoHead(`${base}/api/catalog-jpg/veiculo/foto`, base, fetcher)).status, 0);
  assert.equal(calls, 1);
  const redirect = await probePhotoHead(`${blob}/foto.jpg`, base, async () => new Response(null, { status: 302, headers: { location: "https://privado.exemplo" } }));
  assert.equal(redirect.status, 302);
});

test("extrai somente a galeria do veículo, sem confundir foto da loja", () => {
  const html = '<script type="application/ld+json">' + JSON.stringify({ "@graph": [
    { "@type": "AutoDealer", image: "loja.png" },
    { "@type": "Car", sku: "carro-a", name: "Carro A", image: ["a.jpg", { url: "b.jpg" }] },
  ] }) + "</script>";
  assert.deepEqual(parseAuditVehicle(html, base).photos, ["a.jpg", "b.jpg"]);
  assert.throws(() => parseAuditVehicle("<html></html>", base), /sem JSON-LD/);
});

test("compara variantes sem tratar o id da foto como id do veículo", () => {
  assert.equal(photoIdentity("/fotos/v1/original/carro/foto.webp", base), photoIdentity("/fotos/v1/480x360-cover-q65/carro/foto-card.webp", base));
  assert.equal(photoIdentity("/fotos/v1/original/carro/foto.jpg", base), photoIdentity("/fotos/v1/original/carro/foto-card-x500y500z100-hd.webp", base));
  const photo = `${blob}/estoque/carro-a/o00-id-da-foto.jpg`;
  const vehicle = { id: "carro-a", name: "A", page: base, cover: photo, photos: [photo] };
  const issues = auditPhotos([vehicle], new Map([[photo, { status: 200, type: "image/jpeg", bytes: 120000 }]]));
  assert.deepEqual(issues.get("carro-a"), []);
});

test("relata capa, repetição, HTTP, tamanho, resolução, ordem e pasta divergente", () => {
  const a = `${blob}/estoque/carro-a/primeira.jpg`;
  const b = `${blob}/estoque/carro-b/segunda.jpg`;
  const vehicles: AuditVehicle[] = [
    { id: "carro-a", name: "A", page: base, cover: b, photos: [a, b] },
    { id: "carro-b", name: "B", page: base, cover: b, photos: [b] },
    { id: "carro-c", name: "C", page: base, photos: [] },
  ];
  const issues = auditPhotos(vehicles, new Map([
    [a, { status: 404, type: "text/html" }],
    [b, { status: 200, type: "image/jpeg", bytes: 500, width: 320, height: 200 }],
  ]));
  const text = issues.get("carro-a")!.join("\n");
  for (const term of ["Ordem estranha", "repetida", "outro veículo", "HTTP 404", "muito pequeno", "Baixa resolução"]) assert.ok(text.includes(term), term);
  assert.match(issues.get("carro-c")!.join(), /Capa ausente/);
});

test("200 HTML e ausência de resposta nunca passam como foto válida", () => {
  const photo = `${blob}/foto.jpg`;
  const vehicle = { id: "a", name: "A", page: base, cover: photo, photos: [photo] };
  assert.match(auditPhotos([vehicle], new Map([[photo, { status: 200, type: "text/html" }]])).get("a")!.join(), /não é imagem/);
  assert.match(auditPhotos([vehicle], new Map()).get("a")!.join(), /não verificado/);
  assert.match(auditPhotos([{ ...vehicle, photos: ["http://"], cover: "http://" }], new Map()).get("a")!.join(), /URL de foto inválida/);
});

test("cache 200 não esconde dependência legada do Storage na verificação manual", () => {
  const photo = `${base}/fotos/v1/1280-contain-q78/foto.webp`;
  const vehicle = { id: "a", name: "A", page: base, cover: photo, photos: [photo] };
  const issues = auditPhotos([vehicle], new Map([[photo, { status: 200, type: "image/webp" }]]));
  assert.match(issues.get("a")!.join(), /Supabase Storage/);
});
