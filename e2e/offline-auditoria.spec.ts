import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomInt, randomUUID } from "node:crypto";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
if (process.env.E2E_TEST !== "1" || !["localhost", "127.0.0.1"].includes(database.hostname) || !["/ci", "/garagem_e2e"].includes(database.pathname)) throw new Error("Fila exige banco local descartável.");
const db = new PrismaClient();
test.afterAll(() => db.$disconnect());
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await context.setExtraHTTPHeaders({ "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}` });
  await context.route("**/fotos/**", route => route.fulfill({ path: "public/branding/placeholder-car.png", contentType: "image/png" }));
  await context.route("**/*.supabase.co/storage/**", route => route.abort());
});

async function pending(page: Page, input: { id: string; createdAt: number; whatsapp?: boolean }) {
  await page.evaluate(async ({ id, createdAt, whatsapp }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("garagem-offline", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("intents", { keyPath: "id" });
      open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("intents", "readwrite");
      tx.objectStore("intents").put(whatsapp ? { id, createdAt, type: "whatsapp", url: "https://wa.me/5500000000000?text=Recado%20ficticio" } : { id, createdAt, type: "sell", fields: { requestId: id, name: `Avaliação Fictícia ${id}`, phone: "27999990000", brand: "Fiat", model: "Modelo Fictício", year: "2022", source: "vender" } });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, input);
}
async function queueSize(page: Page) {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open("garagem-offline", 1);
    request.onsuccess = () => {
      const db = request.result;
      const count = db.transaction("intents", "readonly").objectStore("intents").count();
      count.onsuccess = () => { resolve(count.result); db.close(); }; count.onerror = () => reject(count.error);
    };
    request.onerror = () => reject(request.error);
  }));
}

test("duas abas e reconexões repetidas enviam uma avaliação uma única vez", async ({ page, context }) => {
  const id = randomUUID();
  const second = await context.newPage();
  await Promise.all([page.goto("/vender"), second.goto("/vender")]);
  await expect(page.locator('input[name="name"]')).toBeEnabled();
  await pending(page, { id, createdAt: Date.now() });
  try {
    await Promise.all([page.evaluate(() => { window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("online")); }), second.evaluate(() => window.dispatchEvent(new Event("online")))]);
    await expect.poll(() => db.leadVenda.count({ where: { requestId: id } })).toBe(1);
    await expect.poll(() => queueSize(page)).toBe(0);
    await Promise.all([page.reload(), second.reload()]);
    expect(await db.leadVenda.count({ where: { requestId: id } })).toBe(1);
  } finally { await db.leadVenda.deleteMany({ where: { requestId: id } }); await second.close(); }
});

test("avaliação antiga exige confirmação e permite descarte; pendência expirada não é enviada", async ({ page }) => {
  const old = randomUUID(); const expired = randomUUID();
  await page.goto("/vender");
  await pending(page, { id: old, createdAt: Date.now() - 86400000 });
  await pending(page, { id: expired, createdAt: Date.now() - 8 * 86400000 });
  await page.reload();
  const panel = page.getByRole("complementary", { name: "Pedidos pendentes" });
  await expect(panel.getByRole("button", { name: "Enviar avaliação" })).toBeVisible();
  await expect.poll(() => queueSize(page)).toBe(1);
  expect(await db.leadVenda.count({ where: { requestId: { in: [old, expired] } } })).toBe(0);
  await panel.getByRole("button", { name: "Descartar pedido" }).click();
  await expect(panel).toHaveCount(0);
  expect(await queueSize(page)).toBe(0);
});

test("recado de WhatsApp permanece recuperável após recarregar", async ({ page }) => {
  await page.goto("/vender");
  await pending(page, { id: randomUUID(), createdAt: Date.now(), whatsapp: true });
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Pedidos pendentes" }).getByRole("link", { name: "Abrir WhatsApp", exact: true })).toBeVisible();
  await page.reload();
  expect(await queueSize(page)).toBe(1);
  await expect(page.getByRole("complementary", { name: "Pedidos pendentes" }).getByRole("link", { name: "Abrir WhatsApp", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Descartar pedido" }).click();
  expect(await queueSize(page)).toBe(0);
});

test("IndexedDB bloqueado mostra recuperação sem rejeição não tratada", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { Object.defineProperty(indexedDB, "open", { value: () => { throw new DOMException("Bloqueado no teste", "SecurityError"); } }); });
  await page.goto("/vender");
  const panel = page.getByRole("complementary", { name: "Pedidos pendentes" });
  await expect(panel).toContainText("Pendências indisponíveis");
  await expect(panel.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("perda da resposta de avaliação guarda a chave e reenvia sem duplicar lead", async ({ page }) => {
  const name = `Avaliação Fictícia Perdida ${randomUUID()}`;
  await page.goto("/vender");
  const form = page.locator("form").filter({ has: page.locator('input[name="plate"]') });
  for (const [key, value] of Object.entries({ name, phone: "27999990000", brand: "Fiat", model: "Modelo Fictício", year: "2022" })) await form.locator(`[name="${key}"]`).fill(value);
  let lost = false;
  await page.route("**/vender", async route => {
    if (!lost && route.request().method() === "POST" && route.request().headers()["next-action"]) {
      lost = true; await route.fetch(); await route.abort("failed");
    } else await route.continue();
  });
  try {
    await form.getByRole("button", { name: "Solicitar avaliação", exact: true }).click();
    await expect.poll(() => db.leadVenda.count({ where: { name } })).toBe(1);
    await expect.poll(() => queueSize(page)).toBe(1);
    const lead = await db.leadVenda.findFirstOrThrow({ where: { name } });
    expect(lead.requestId).not.toBeNull();
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("garagem:envio:avaliacao:")).length)).toBe(0);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => queueSize(page)).toBe(0);
    expect(await db.leadVenda.count({ where: { name } })).toBe(1);
  } finally { await db.leadVenda.deleteMany({ where: { name } }); }
});
