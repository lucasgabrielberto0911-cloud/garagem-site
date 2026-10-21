import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as filesPost } from "../app/api/admin/files/route";
import { POST as filesSignPost } from "../app/api/admin/files/sign/route";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const srcRoot = join(process.cwd(), "src");
function readSrc(relPath: string) {
  return readFileSync(join(srcRoot, relPath), "utf8");
}

test("Item 23: rotas /api/admin/files rejeitam origem inválida com 403 e Cache-Control no-store", async () => {
  // Teste de origem inválida em /api/admin/files (POST)
  const crossOriginReq = new Request("https://garagem.test/api/admin/files", {
    method: "POST",
    headers: { host: "garagem.test", origin: "https://atacante.test" },
  });
  const crossOriginRes = await filesPost(crossOriginReq);
  assert.equal(crossOriginRes.status, 403);
  assert.equal(crossOriginRes.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await crossOriginRes.json(), { error: "Origem inválida." });

  // Teste de origem inválida em /api/admin/files/sign (POST)
  const signCrossOriginReq = new Request("https://garagem.test/api/admin/files/sign", {
    method: "POST",
    headers: { host: "garagem.test", origin: "https://atacante.test" },
  });
  const signCrossOriginRes = await filesSignPost(signCrossOriginReq);
  assert.equal(signCrossOriginRes.status, 403);
  assert.equal(signCrossOriginRes.headers.get("Cache-Control"), "private, no-store");
});

test("Item 23: rotas /api/admin/files definem Cache-Control: private, no-store em todas as respostas", () => {
  const filesRoute = readSrc("app/api/admin/files/route.ts");
  const signRoute = readSrc("app/api/admin/files/sign/route.ts");
  const viewRoute = readSrc("app/api/admin/files/view/route.ts");

  for (const src of [filesRoute, signRoute, viewRoute]) {
    assert.match(src, /const headers = \{ "Cache-Control": "private, no-store" \};/);
  }

  // Verifica que files/view inclui no-store nos redirects
  assert.match(viewRoute, /res\.headers\.set\("Cache-Control", "private, no-store"\);/);
});

test("Item 23: /api/admin/files não devolve mensagens cruas de erro do Supabase", () => {
  const filesRouteCode = readSrc("app/api/admin/files/route.ts");
  assert.doesNotMatch(filesRouteCode, /error\.message/);
  assert.match(filesRouteCode, /Não foi possível enviar o arquivo\. Tente novamente\./);
});

test("Item 25: getVehicleByParam não engole erro de banco como veículo inexistente", () => {
  const vehiclesCode = readSrc("lib/vehicles.ts");
  const getVehicleByParamBlock = vehiclesCode.slice(
    vehiclesCode.indexOf("export const getVehicleByParam"),
    vehiclesCode.indexOf("async function findRelatedCardPool"),
  );
  assert.doesNotMatch(getVehicleByParamBlock, /safeQuery/);
  assert.match(getVehicleByParamBlock, /return loadVehicleDetailCached\(id\)/);
});

test("Item 25: leitura de depoimentos não escreve no banco", () => {
  const vehiclesCode = readSrc("lib/vehicles.ts");
  const testimonialsBlock = vehiclesCode.slice(
    vehiclesCode.indexOf("async function fetchPublishedTestimonials"),
    vehiclesCode.indexOf("const loadTestimonialsCached"),
  );
  assert.doesNotMatch(testimonialsBlock, /prisma\.testimonial\.update/);
  assert.doesNotMatch(testimonialsBlock, /hasDirty/);
});

test("Item 25: site-settings e site-content não cacheiam fallback por 1 hora em falha", () => {
  const siteSettingsCode = readSrc("lib/site-settings.ts");
  const cachedSettings = siteSettingsCode.slice(
    siteSettingsCode.indexOf("const loadPublicSiteCached = unstable_cache"),
    siteSettingsCode.indexOf("export const getPublicSite"),
  );
  assert.doesNotMatch(cachedSettings, /catch\s*\(/);

  const siteContentCode = readSrc("lib/site-content.ts");
  const cachedContent = siteContentCode.slice(
    siteContentCode.indexOf("const loadSiteContentCached = unstable_cache"),
    siteContentCode.indexOf("export const getSiteContent"),
  );
  assert.doesNotMatch(cachedContent, /catch\s*\(/);
});
