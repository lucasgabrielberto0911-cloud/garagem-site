import { test as base, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";
import samples from "./public-samples.json";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
const localDatabase = process.env.E2E_TEST === "1"
  && ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
  && ["/ci", "/garagem_e2e"].includes(database.pathname);
const prisma = new PrismaClient();
const test = base.extend<{ modelName: string }>({
  modelName: async ({ page, context, baseURL }, executar) => {
    const id = randomUUID();
    const modelName = `Wizard ${id}`;
    const email = `wizard-${id}@local.test`;
    const password = "wizard-local-123";
    const admin = await prisma.admin.create({ data: {
      name: "Teste do wizard", email, passwordHash: await bcrypt.hash(password, 4),
    } });
    try {
      page.on("dialog", dialog => dialog.accept());
      await page.setExtraHTTPHeaders({ "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}` });
      await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
      const login = await page.request.post("/api/auth/login", { data: { email, password } });
      expect(login.ok()).toBeTruthy();
      const cookie = login.headers()["set-cookie"].split(";")[0];
      await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax", secure: false }]);
      await executar(modelName);
    } finally {
      await prisma.vehicle.deleteMany({ where: { model: modelName } });
      await prisma.adminAudit.deleteMany({ where: { adminId: admin.id } });
      await prisma.admin.delete({ where: { id: admin.id } });
    }
  },
});
test.skip(!localDatabase, "Requer banco local dedicado e E2E_TEST=1.");
test.afterAll(async () => { await prisma.$disconnect(); });

const next = (page: Page) => page.getByRole("navigation", { name: "Etapas do anúncio" }).getByRole("button", { name: "Próximo", exact: true });
const back = (page: Page) => page.getByRole("navigation", { name: "Etapas do anúncio" }).getByRole("button", { name: "Voltar", exact: true });
const title = (page: Page) => page.locator("#wizard-title");

async function uploadPhotos(page: Page) {
  let release!: () => void;
  const uploading = new Promise<void>(resolve => { release = resolve; });
  let count = 0;
  await page.route("**/api/upload/master/sign", route => route.fulfill({ status: 503, json: {} }));
  await page.route("**/api/upload", async route => {
    await uploading;
    const photo = samples.flatMap(sample => sample.photos)[count++ % 2];
    await route.fulfill({ json: { url: photo.url, thumbnailUrl: photo.thumbnailUrl } });
  });
  try {
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
      const drawing = canvas.getContext("2d")!;
      drawing.fillStyle = "#777777";
      drawing.fillRect(0, 0, 800, 600);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const input = page.locator('#secao-fotos input[type="file"]');
    await expect(input).toBeEnabled();
    await input.setInputFiles([1, 2].map(index => ({ name: `foto-${index}.png`, mimeType: "image/png", buffer: Buffer.from(png, "base64") })));
    await expect(page.getByRole("progressbar", { name: "Progresso do envio das fotos" })).toBeVisible();
    await next(page).click();
    await expect(title(page)).toContainText("Etapa 1 de 4");
  } finally {
    release();
  }
  await expect.poll(async () => JSON.parse(await page.locator('[name="photoUrls"]').inputValue()).length).toBe(2);
  await expect(page.getByRole("progressbar", { name: "Progresso do envio das fotos" })).toHaveAttribute("aria-valuenow", "100");
}

async function fillVehicle(page: Page, modelName: string) {
  await page.locator('[name="brand"]').fill("Honda");
  await page.locator('[name="model"]').fill(modelName);
  await page.locator('[name="color"]').fill("Prata");
  await page.locator('[name="year"]').fill("2020");
  await page.locator('[name="yearModel"]').fill("2021");
  await page.locator('[name="kmDisplay"]').fill("45.000");
  await page.locator('[name="fuel"]').selectOption({ label: "Flex" });
  await page.locator('[name="transmission"]').selectOption({ label: "Automático" });
}

for (const width of [390, 1440]) {
  test.describe(`wizard em ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("cria anúncio, bloqueia etapas inválidas e preserva campos ao voltar", async ({ page, modelName }) => {
      await page.goto("/admin/veiculos/novo");
      await expect(title(page)).toContainText("Etapa 1 de 4");
      await expect(back(page)).toBeDisabled();
      expect((await next(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await next(page).click();
      await expect(page.getByText("Adicione pelo menos uma foto.", { exact: true })).toBeVisible();
      await uploadPhotos(page);
      const original = JSON.parse(await page.locator('[name="photoUrls"]').inputValue());
      if (width < 1024) await page.getByRole("button", { name: "Mais ações da foto 2", exact: true }).click();
      await page.getByRole("button", { name: "Definir como capa", exact: true }).last().click();
      const reordered = JSON.parse(await page.locator('[name="photoUrls"]').inputValue());
      expect(reordered[0].url).toBe(original[1].url);
      await page.locator('[name="hasVideo"]').check();
      await next(page).click();
      await expect(title(page)).toContainText("Etapa 2 de 4");
      await next(page).click();
      await expect(title(page)).toContainText("Etapa 2 de 4");
      await expect(page.locator('[name="brand"]')).toBeFocused();
      await expect(page.locator('[aria-current="step"]')).toContainText("(erro)");
      await fillVehicle(page, modelName);
      await next(page).click();
      await expect(title(page)).toContainText("Etapa 3 de 4");
      await next(page).click();
      await expect(page.locator('[name="priceDisplay"]')).toBeFocused();
      await page.locator('[name="priceDisplay"]').fill("59.900,00");
      const form = page.locator("#vehicle-form");
      await form.locator('[name="description"]').fill("Preço R$ 69.900,00.");
      await next(page).click();
      await expect(title(page)).toContainText("Etapa 3 de 4");
      await form.locator('[name="description"]').fill("Veículo revisado e bem cuidado.");
      await expect(page.getByLabel("Colar legenda", { exact: true })).toBeVisible();
      await page.getByLabel("Colar legenda", { exact: true }).fill("✅ Ar-condicionado");
      await page.getByRole("button", { name: "Analisar", exact: true }).click();
      await page.getByRole("button", { name: "Aplicar", exact: true }).click();
      await expect(form.getByRole("checkbox", { name: "Ar-condicionado", exact: true })).toBeChecked();
      await form.locator('[name="status"]').selectOption("reservado");
      await next(page).click();
      await expect(page.getByText("Cadastre como disponível antes de reservar o veículo.", { exact: true })).toBeVisible();
      await form.locator('[name="status"]').selectOption("disponivel");
      await back(page).click();
      await expect(page.locator('[name="model"]')).toHaveValue(modelName);
      await next(page).click();
      await expect(form.locator('[name="description"]')).toHaveValue("Veículo revisado e bem cuidado.");
      await expect(form.getByRole("checkbox", { name: "Ar-condicionado", exact: true })).toBeChecked();
      await next(page).click();
      await expect(title(page)).toContainText("Etapa 4 de 4");
      await page.getByRole("button", { name: "Cadastrar veículo", exact: true }).click();
      await expect(page.getByText("Selecione a cidade onde o veículo está.", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Linhares ES", exact: true }).click();
      await page.locator('[name="featured"]').check();
      await back(page).click();
      await next(page).click();
      await expect(page.locator('[name="featured"]')).toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.getByRole("button", { name: "Cadastrar veículo", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/veiculos\/(?!novo$)[^/?]+$/);
      await expect.poll(() => prisma.vehicle.findFirst({ where: { model: modelName } })).not.toBeNull();
      const saved = await prisma.vehicle.findFirstOrThrow({ where: { model: modelName }, include: { photos: { orderBy: { order: "asc" } } } });
      expect(saved.price).toBe(59900);
      expect(saved.accessories).toContain("Ar-condicionado");
      expect(saved.hasVideo).toBe(true);
      expect(saved.featured).toBe(true);
      expect(saved.photos.map(photo => photo.url)).toEqual(reordered.map((photo: { url: string }) => photo.url));
      await page.goto("/admin/veiculos");
      await expect(page.getByText(modelName, { exact: false }).first()).toBeVisible();
    });

    test("retoma a etapa e os campos do rascunho após reload", async ({ page, modelName }) => {
      await page.goto("/admin/veiculos/novo");
      await uploadPhotos(page);
      await next(page).click();
      await fillVehicle(page, modelName);
      await next(page).click();
      const form = page.locator("#vehicle-form");
      await form.locator('[name="description"]').fill("Texto preservado no rascunho.");
      await page.getByRole("button", { name: "Guardar rascunho", exact: true }).click();
      await expect(page.getByRole("button", { name: "Guardar rascunho", exact: true })).toBeEnabled();
      await page.reload();
      await page.getByRole("button", { name: "Retomar rascunho", exact: true }).click();
      await page.getByRole("button", { name: "Retomar", exact: true }).click();
      await expect(title(page)).toContainText("Etapa 3 de 4");
      await expect(form.locator('[name="description"]')).toHaveValue("Texto preservado no rascunho.");
      await back(page).click();
      await expect(page.locator('[name="model"]')).toHaveValue(modelName);
      expect(JSON.parse(await page.locator('[name="photoUrls"]').inputValue())).toHaveLength(2);
    });

    test("edição usa wizard e atalho de fotos abre a primeira etapa", async ({ page, modelName }) => {
      const original = await prisma.vehicle.findUniqueOrThrow({ where: { id: samples[0].id }, select: { model: true } });
      try {
        await page.goto(`/admin/veiculos/${samples[0].id}?view=anuncio`);
        await expect(title(page)).toContainText("Etapa 1 de 4");
        await next(page).click();
        await expect(title(page)).toContainText("Etapa 2 de 4");
        await page.locator('[name="model"]').fill(modelName);
        await page.locator('a[data-vehicle-tab="fotos"]').click();
        await expect(title(page)).toContainText("Etapa 1 de 4");
        await next(page).click();
        await expect(page.locator('[name="model"]')).toHaveValue(modelName);
        await page.goto(`/admin/veiculos/${samples[0].id}?view=fotos`);
        await expect(title(page)).toContainText("Etapa 1 de 4");
        await expect(page.locator("#secao-fotos")).toBeVisible();
      } finally {
        await prisma.vehicle.updateMany({ where: { id: samples[0].id, model: modelName }, data: { model: original.model } });
      }
    });
  });
}
