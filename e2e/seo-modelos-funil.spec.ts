import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { sessionFingerprint } from "../src/lib/admin-session-fingerprint";
import { BUYING_GUIDES } from "../src/lib/buying-guides";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";
const prisma = new PrismaClient();
test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
  await page.addInitScript(() => { if (!localStorage.getItem("garagem_consent")) localStorage.setItem("garagem_consent", "essential"); });
});
test.afterAll(async () => { await prisma.$disconnect(); });
async function noOverflow(page: import("@playwright/test").Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
test("landings, histórico sem preço, 404 inexistente e descoberta no sitemap", async ({ page, request }) => {
  await page.goto("/modelo/honda-civic");
  await expect(page.getByRole("heading", { name: "Honda Civic seminovo", exact: true })).toBeVisible();
  await expect(page.locator("article.listing-card")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /Civic 2015 · vendido/ })).toBeVisible();
  const sold = page.getByRole("heading", { name: "Já passaram pela Garagem" }).locator("..");
  await expect(sold).not.toContainText("74.900");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.suagaragem.net/modelo/honda-civic");
  expect(await page.locator("main").textContent()).not.toContain("locationCity");
  await noOverflow(page);
  await page.goto("/marca/honda");
  await expect(page.locator("article.listing-card")).toHaveCount(2);
  await noOverflow(page);
  await expect(page.getByRole("link", { name: "Pedir Honda", exact: true })).toHaveAttribute("href", "/pedido?q=Honda");
  const missing = await page.goto("/modelo/sem-carro-nem-historico");
  expect(missing?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
  await expect(page.locator("article.listing-card")).toHaveCount(0);
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("/modelo/honda-civic");
  expect(xml).not.toContain("/modelo/sem-carro-nem-historico");
});
test("cidades ligam estoque real, modelos e cidades, com FAQ e breadcrumb", async ({ page }, info) => {
  await page.goto("/seminovos/sooretama");
  await expect(page.locator("article.listing-card")).toHaveCount(3);
  await expect(page.getByRole("navigation", { name: "Outras cidades atendidas" }).getByRole("link", { name: "São Mateus", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Modelos disponíveis" }).getByRole("link", { name: "Honda Civic" })).toHaveAttribute("href", "/modelo/honda-civic");
  const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(raw => JSON.parse(raw));
  expect(schemas.some(schema => schema["@type"] === "FAQPage")).toBe(true);
  expect(schemas.some(schema => schema["@type"] === "BreadcrumbList")).toBe(true);
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath("cidade.png"), fullPage: true });
});
test("cinco guias têm fontes oficiais, estoque real e WhatsApp", async ({ page, request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  await page.goto("/guias");
  await expect(page.locator('main a[href^="/guias/"]')).toHaveCount(5);
  for (const guide of BUYING_GUIDES) {
    await page.goto(`/guias/${guide.slug}`);
    await expect(page.getByRole("heading", { name: guide.title, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver estoque", exact: true }).first()).toHaveAttribute("href", "/estoque");
    await expect(page.getByRole("link", { name: "Falar no WhatsApp", exact: true })).toHaveAttribute("href", /wa.me/);
    await expect(page.locator("article.listing-card")).toHaveCount(3);
    expect(xml).toContain(`/guias/${guide.slug}`);
    await noOverflow(page);
  }
});
test("visita e clique consentidos chegam ao diário e ao funil autenticado", async ({ page, context, baseURL }, info) => {
  const events: string[] = [];
  page.on("request", req => { if (req.url().endsWith("/api/funil")) events.push(req.postData() || ""); });
  await page.goto(vehiclePath(samples[0]));
  await page.waitForTimeout(300);
  expect(events).toHaveLength(0);
  await page.evaluate(() => localStorage.setItem("garagem_consent", "accepted"));
  const measured = page.waitForResponse(response => response.url().endsWith("/api/funil") && response.request().postDataJSON().event === "visita");
  await page.goto(`${vehiclePath(samples[0])}?utm_source=google`);
  expect((await measured).status()).toBe(204);
  const click = page.waitForResponse(response => response.url().endsWith("/api/funil") && response.request().postDataJSON().event === "whatsapp");
  if (page.viewportSize()!.width < 1024) await page.getByRole("link", { name: /^Tenho interesse no WhatsApp/ }).click();
  else await page.locator('main a[href*="wa.me"]:visible').filter({ hasText: "Tenho interesse" }).first().click();
  expect((await click).status()).toBe(204);
  expect(events.map(raw => JSON.parse(raw).origin)).toContain("google");
  const recorded = await prisma.adminAudit.findFirst({ where: { entityId: samples[0].id, action: "site:whatsapp", adminId: "site:google" } });
  expect(recorded).not.toBeNull();
  const admin = await prisma.admin.create({ data: { name: "Teste local funil", email: `funil-${Date.now()}@local.test`, passwordHash: "apenas-fixture-local" } });
  try {
    const fingerprint = sessionFingerprint(admin.passwordHash, admin.email);
    const token = await new SignJWT({ adminId: admin.id, email: admin.email, fingerprint }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode("garagem-e2e-local-sem-acesso-externo"));
    await context.addCookies([{ name: "session", value: token, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    await page.goto("/admin/leads");
    await expect(page.getByText("Funil por origem e veículo", { exact: true })).toBeVisible();
    await page.getByText("Funil por origem e veículo", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Por origem", exact: true }).first()).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: info.outputPath("funil.png"), fullPage: true });
  } finally { await prisma.admin.delete({ where: { id: admin.id } }); }
});

test("orçamento mobile de JS inicial: até 220 KiB por rota", async ({ page }) => {
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.fallback() : route.abort());
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  let bytes = 0;
  const scripts = new Set<string>();
  cdp.on("Network.responseReceived", response => { if (response.type === "Script") scripts.add(response.requestId); });
  cdp.on("Network.loadingFinished", response => { if (scripts.has(response.requestId)) bytes += response.encodedDataLength; });
  for (const route of ["/", "/estoque", "/seminovos/linhares"]) {
    bytes = 0; scripts.clear();
    await page.goto(route, { waitUntil: "load" });
    expect(bytes, `${route}: scripts efetivamente medidos`).toBeGreaterThan(0);
    expect(bytes, `${route}: JS transferido até load`).toBeLessThanOrEqual(220 * 1024);
  }
});
