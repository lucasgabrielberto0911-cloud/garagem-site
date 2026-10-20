import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

const prisma = new PrismaClient();
test.afterAll(async () => { await prisma.$disconnect(); });

test.beforeEach(async ({ page }) => {
  // Cada percurso representa um cliente distinto; a proteção contra spam continua ativa.
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}` });
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("ficha: quatro campos, máscara e layout sem rolagem lateral", async ({ page }, info) => {
  await page.goto(vehiclePath(samples[0]));
  const form = page.locator("[data-missing-model-form] form");
  const inputs = form.locator("input:not([type=hidden]):not([type=checkbox]):not([name=website])");
  await expect(inputs).toHaveCount(4);
  expect(await inputs.evaluateAll(fields => fields.map(field => field.getAttribute("name")))).toEqual(["phone", "name", "model", "priceMax"]);
  await expect(form.getByRole("checkbox", { name: /Autorizo/ })).toHaveCount(1);
  await form.getByLabel("Valor máximo").fill("95000");
  await expect(form.getByLabel("Valor máximo")).toHaveValue("R$ 95.000");
  const boxes = await inputs.evaluateAll(fields => fields.map(field => {
    const rect = field.getBoundingClientRect(); return { x: rect.x, y: rect.y };
  }));
  if (info.project.name === "desktop") {
    expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(2);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
    expect(Math.abs(boxes[2].y - boxes[3].y)).toBeLessThan(2);
  } else {
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].x).toBe(boxes[0].x);
      expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await form.getByRole("button", { name: "Enviar pedido", exact: true }).click();
  await expect(form.getByText("Informe um telefone com DDD.")).toBeVisible();
  await expect(form.getByLabel("Telefone com DDD")).toBeFocused();
});

test("envio sem e-mail salva orçamento no banco e exibe no admin", async ({ page }, info) => {
  const name = `Pedido compacto ${info.project.name}`;
  const email = `pedido-${info.project.name}@local.test`;
  const password = "pedido-local-123";
  const admin = await prisma.admin.create({ data: { name: "Admin de teste", email, passwordHash: await bcrypt.hash(password, 10) } });
  try {
    await page.goto(vehiclePath(samples[0]));
    const form = page.locator("[data-missing-model-form] form");
    await form.getByLabel("Telefone com DDD").fill("27988887766");
    await form.getByRole("textbox", { name: "Nome", exact: true }).fill(name);
    await form.getByLabel("Veículo que procura").fill("Honda Civic");
    await form.getByLabel("Valor máximo").fill("95000");
    await form.getByRole("checkbox", { name: /Autorizo/ }).check();
    await form.getByRole("button", { name: "Enviar pedido", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Pedido recebido" })).toBeVisible();
    const lead = await prisma.leadVenda.findFirstOrThrow({ where: { name }, orderBy: { createdAt: "desc" } });
    expect(lead.source).toBe("nao-encontrou");
    expect(lead.phone).toBe("27988887766");
    expect(lead.interestVehicleId).toBe(samples[0].id);
    expect(lead.notes).toMatch(/Preço: até R\$\s*95\.000/);
    expect(lead.notes).not.toMatch(/E-mail:|Ano:|Km:/);
    const login = await page.request.post("/api/auth/login", { data: { email, password }, headers: { Origin: String(info.project.use.baseURL) } });
    expect(login.ok()).toBeTruthy();
    await page.goto("/admin/leads");
    const card = page.locator(`#lead-${lead.id}`);
    await card.getByRole("button", { name: "Detalhes" }).click();
    await expect(card.locator("dl")).toContainText("Valor máximo");
    await expect(card.locator("dl")).toContainText(/R\$\s*95\.000/);
    await expect(card.locator("dl")).not.toContainText("E-mail");
  } finally {
    await prisma.leadVenda.deleteMany({ where: { name } });
    await prisma.admin.deleteMany({ where: { id: admin.id } });
  }
});

test("pedido: rascunho recupera valor máximo e envio aceita orçamento vazio", async ({ page }, info) => {
  const name = `Pedido sem orçamento ${info.project.name}`;
  try {
    await page.goto("/pedido?q=Corolla");
    let form = page.locator("[data-missing-model-form] form");
    await form.getByLabel("Telefone com DDD").fill("27988887766");
    await form.getByRole("textbox", { name: "Nome", exact: true }).fill(name);
    await form.getByLabel("Valor máximo").fill("80000");
    await expect.poll(() => page.evaluate(() => {
      const raw = sessionStorage.getItem("garagem:pedido:rascunho:v1");
      return raw ? JSON.parse(raw).fields.priceMax.replace(/\D/g, "") : null;
    })).toBe("80000");
    await page.reload();
    form = page.locator("[data-missing-model-form] form");
    await expect(form.getByLabel("Valor máximo")).toHaveValue("R$ 80.000");
    await form.getByLabel("Valor máximo").fill("");
    await form.getByRole("checkbox", { name: /Autorizo/ }).check();
    await form.getByRole("button", { name: "Enviar pedido", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Pedido recebido" })).toBeVisible();
    const lead = await prisma.leadVenda.findFirstOrThrow({ where: { name } });
    expect(lead.vehicleInfo).toBe("Corolla");
    expect(lead.notes).not.toMatch(/E-mail:|Ano:|Preço:|Km:/);
    expect(await page.evaluate(() => sessionStorage.getItem("garagem:pedido:rascunho:v1"))).toBeNull();
  } finally { await prisma.leadVenda.deleteMany({ where: { name } }); }
});
