import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

const readSrc = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

test("páginas públicas de estoque usam TTL de 1 h (a invalidação vem do painel)", () => {
  for (const file of [
    "app/(catalog)/page.tsx",
    "app/(catalog)/estoque/page.tsx",
    "app/(vehicle)/estoque/[id]/page.tsx",
    "app/(catalog)/marca/[slug]/page.tsx",
    "app/(catalog)/modelo/[slug]/page.tsx",
    "app/(site)/modelos/page.tsx",
    "app/(site)/seminovos/page.tsx",
    "app/(site)/seminovos/[cidade]/page.tsx",
    "app/(site)/guias/page.tsx",
    "app/(site)/guias/[slug]/page.tsx",
    "app/(site)/faq/page.tsx",
    "app/(site)/sobre/page.tsx",
    "app/(site)/contato/page.tsx",
    "app/(site)/vender/page.tsx",
  ]) {
    assert.match(readSrc(file), /export const revalidate = 3600;/, file);
  }
  assert.match(readSrc("lib/vehicles.ts"), /PUBLIC_CACHE[^]*?revalidate: 3600/);
  assert.match(readSrc("lib/vehicles.ts"), /TESTIMONIALS_CACHE[^]*?revalidate: 3600/);
  assert.match(readSrc("lib/stock-landing-data.ts"), /revalidate: 3600,\s*tags:\s*\[VEHICLES_PUBLIC_CACHE_TAG\]/);
  assert.doesNotMatch(readSrc("lib/stock-landing-data.ts"), /catch\s*\(/);
  assert.match(readSrc("app/sitemap.ts"), /unstable_cache\(loadPublicSitemapVehicles[^]*?revalidate: 3600,\s*tags:\s*\[VEHICLES_PUBLIC_CACHE_TAG\]/);
});

test("revalidatePublicStock expira a tag na hora e só a ficha daquele veículo", () => {
  const source = readSrc("lib/public-stock-revalidate.ts");
  assert.match(source, /updateTag\(VEHICLES_PUBLIC_CACHE_TAG\)/);
  assert.doesNotMatch(source, /revalidateTag\(/);
  // O único revalidatePath de ficha em lote fica em revalidateAllPublicFichas.
  assert.equal(source.match(/^\s+revalidatePath\("\/estoque\/\[id\]"/gm)?.length, 1);
  assert.match(source, /function revalidateAllPublicFichas[^]*revalidatePath\("\/estoque\/\[id\]", "page"\)/);
});

test("quem chama revalidatePublicStock é Server Action (updateTag não roda fora delas)", () => {
  for (const file of [
    "app/admin/veiculos/actions.ts",
    "app/admin/veiculos/ops-actions.ts",
    "app/admin/veiculos/verified-actions.ts",
    "app/admin/vendas/actions.ts",
    "app/admin/site/cleanup-actions.ts",
  ]) {
    assert.match(readSrc(file), /^"use server";/, file);
  }
});

test("operação do veículo (chave reserva, manual, na loja) revalida a ficha pública", () => {
  const source = readSrc("app/admin/veiculos/ops-actions.ts");
  const update = source.slice(source.indexOf("export async function updateVehicleOps"), source.indexOf("export async function addVehicleCost"));
  assert.match(update, /await revalidatePublicStock\(vehicleId\)/);
  // Custos e documentos são internos: não derrubam o cache público.
  const internal = source.slice(source.indexOf("export async function addVehicleCost"));
  assert.doesNotMatch(internal, /revalidatePublicStock/);
});

test("depoimentos atualizam a home na hora", () => {
  const source = readSrc("app/admin/depoimentos/actions.ts");
  assert.doesNotMatch(source, /revalidateTag\(/);
  assert.equal(source.match(/updateTag\(TESTIMONIALS_CACHE_TAG\)/g)?.length, 3);
});
