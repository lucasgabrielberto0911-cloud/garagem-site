import { expect, test } from "@playwright/test";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await page.route("**/api/fotos/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
});

test("venda aceita mais de três fotos e permite adicionar outro lote", async ({ page }) => {
  let uploads = 0;
  await page.route("**/api/vender/photos", route => route.fulfill({
    json: { url: `private://documentos/vender/foto-${++uploads}.webp` },
  }));
  await page.goto("/vender");
  await page.getByText("Complementar com placa, km ou fotos (opcional)", { exact: true }).click();
  const upload = page.locator("[data-sell-photo-upload]");
  await upload.locator('input[type="file"]').setInputFiles(Array(5).fill("public/branding/placeholder-car.png"));
  await expect(upload.locator('[data-photo-phase="done"]')).toHaveCount(5);
  await expect(upload.locator('input[type="file"]')).toBeEnabled();
  await upload.locator('input[type="file"]').setInputFiles("public/branding/placeholder-car.png");
  await expect(upload.locator('[data-photo-phase="done"]')).toHaveCount(6);
  await expect(upload.locator('input[name="photoUrls"]')).toHaveCount(6);
  expect(uploads).toBe(6);
});

test("buscar mantém alvo de toque maior sem transbordar", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Buscar", exact: true });
  const box = await button.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(51.9); // tolerância de subpixel (51,99997 no CI)
  expect(box!.width).toBeGreaterThanOrEqual(71.9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("falha do chat fica junto ao campo com WhatsApp e mensagem preservada", async ({ page }) => {
  await page.route("**/api/chat", route => route.fulfill({ status: 503, json: { error: "Atendimento temporariamente indisponível." } }));
  await page.goto("/estoque");
  await page.getByRole("button", { name: "Ajuda para escolher", exact: true }).first().click();
  const dialog = page.locator(".site-chat-panel");
  const input = dialog.locator("textarea");
  await input.fill("Quero um carro automático");
  await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
  const alert = dialog.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(input).toHaveValue("Quero um carro automático");
  await expect(alert.getByRole("link", { name: "Falar no WhatsApp", exact: true })).toHaveAttribute("href", /wa\.me|whatsapp/);
  const bounds = await alert.boundingBox();
  const composer = await dialog.locator("[data-chat-composer]").boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(composer!.y + 1);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await alert.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12);
  await alert.getByRole("button", { name: "Rever mensagem" }).click();
  await expect(input).toBeFocused();
});

test("ficha evita balão sobre a barra e sitemap exclui vendido", async ({ page, request }) => {
  await page.goto(vehiclePath(samples[0]));
  await expect(page.locator(".site-chat-launcher")).toBeHidden();
  const missing = await page.locator("main img").evaluateAll(images => images.filter(image => {
    const style = getComputedStyle(image);
    return (!image.getAttribute("width") || !image.getAttribute("height")) && style.position !== "absolute";
  }).map(image => image.getAttribute("src")));
  expect(missing).toEqual([]);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain(samples[0].id);
  expect(xml).not.toContain("ce2esold000000000000000001");
  await page.goto(vehiclePath({ ...samples[0], id: "ce2esold000000000000000001" }));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
