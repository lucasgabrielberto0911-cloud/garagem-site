import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomInt } from "node:crypto";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

const prisma = new PrismaClient();
test.afterAll(async () => { await prisma.$disconnect(); });
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}` });
  await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
});

test("contato inicial de venda dispensa placa e mantém dados em erro", async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await page.goto(`/vender?interesse=${samples[0].id}`);
  const name = `Lote site ${Date.now()} ${info.project.name}`;
  const form = page.locator("form").filter({ has: page.locator('[name="plate"]') });
  try {
    await expect(form.locator('[name="plate"]')).toBeHidden();
    for (const [field, value] of Object.entries({ name, phone: "27988887766", brand: "Honda", model: "Civic", year: "2020" })) {
      await form.locator(`[name="${field}"]`).fill(value);
    }
    await form.getByText("Complementar com placa, km ou fotos (opcional)", { exact: true }).click();
    await form.locator('[name="plate"]').fill("ABC12");
    await form.getByRole("button", { name: "Solicitar avaliação", exact: true }).click();
    await expect(form.locator("#plate-error")).toBeVisible();
    await expect(form.locator('[name="name"]')).toHaveValue(name);
    expect(await prisma.leadVenda.count({ where: { name } })).toBe(0);
    await form.locator('[name="plate"]').clear();
    await form.getByRole("button", { name: "Solicitar avaliação", exact: true }).click();
    await expect(page.locator("#sell-form-receipt-heading")).toBeVisible();
    await expect.poll(() => prisma.leadVenda.count({ where: { name } })).toBe(1);
    const lead = await prisma.leadVenda.findFirstOrThrow({ where: { name } });
    expect(lead).toMatchObject({ plate: "", vehicleInfo: "Honda Civic 2020", interestVehicleId: samples[0].id, source: "vender" });
    await expect(page.getByText("Placa e outros detalhes podem ser combinados no atendimento.", { exact: false })).toBeVisible();
  } finally {
    await prisma.leadVenda.deleteMany({ where: { name } });
  }
});

test("cookies compactos preservam escolhas, privacidade e alvos de toque", async ({ page }, info) => {
  await page.goto(vehiclePath(samples[0]));
  const consent = page.getByRole("dialog", { name: "Consentimento de cookies" });
  await expect(consent).toBeVisible();
  const bounds = await consent.boundingBox();
  if (info.project.name !== "desktop") expect(bounds!.height).toBeLessThan(100);
  for (const name of ["Aceitar", "Só o essencial"]) {
    const box = await consent.getByRole("button", { name, exact: true }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(consent.getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/privacidade");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await consent.getByRole("button", { name: "Só o essencial", exact: true }).click();
  await expect(consent).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("garagem_consent"))).toBe("essential");
  await page.reload();
  await expect(consent).toHaveCount(0);
  await page.evaluate(() => localStorage.removeItem("garagem_consent"));
  await page.reload();
  await consent.getByRole("button", { name: "Aceitar", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("garagem_consent"))).toBe("accepted");
});

test("modelo só vendido mantém histórico e pedido preenchido sem preço", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await page.goto("/modelo/honda-fit");
  await expect(page.getByRole("heading", { name: "Já passaram pela Garagem" })).toBeVisible();
  await expect(page.locator("article.listing-card")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("54.321");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Sem Honda Fit disponível/);
  await page.getByRole("link", { name: "Pedir Honda Fit", exact: true }).click();
  await expect(page.locator('[name="model"]')).toHaveValue("Honda Fit");
  await expect(page.locator('[name="priceMax"]')).toHaveValue("");
});
