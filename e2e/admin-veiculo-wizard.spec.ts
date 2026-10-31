import { test as base, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import samples from "./public-samples.json";

async function guardarAgora(page: Page) {
  const guardar = page.getByRole("button", { name: "Guardar agora", exact: true });
  if (!(await guardar.isVisible())) {
    await page.locator("button[aria-expanded]").filter({ hasText: /Rascunho automático|Salvo às|Salvando|Sem conexão|Outra aba/ }).click();
  }
  await guardar.click();
}

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
      const photoFixture = readFileSync("public/branding/placeholder-car.png");
      await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", body: photoFixture }));
      await page.route("https://*.supabase.co/storage/**", route => route.fulfill({ contentType: "image/png", body: photoFixture }));
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
  await expect(page.getByText("Adicione pelo menos uma foto.", { exact: true })).toBeHidden();
  await expect(page.getByText("Espere o envio ou o borrão das fotos terminar.", { exact: true })).toBeHidden();
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

test.describe("wizard nos tamanhos configurados", () => {

    test("cria anúncio, bloqueia etapas inválidas e preserva campos ao voltar", async ({ page, modelName }) => {
      await page.goto("/admin/veiculos/novo");
      await expect(title(page)).toContainText("Etapa 1 de 4");
      await expect(back(page)).toBeDisabled();
      expect((await next(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await next(page).click();
      await expect(page.getByText("Adicione pelo menos uma foto.", { exact: true })).toBeVisible();
      await uploadPhotos(page);
      const original = JSON.parse(await page.locator('[name="photoUrls"]').inputValue());
      const order = async () => (JSON.parse(await page.locator('[name="photoUrls"]').inputValue()) as { url: string }[]).map(photo => photo.url);
      const dragSecondOntoFirst = async () => {
        const handleButton = page.getByRole("button", { name: /^Reordenar foto 2\./ });
        const targetItem = page.locator('[data-photo-index="0"]');
        // O mouse do Playwright usa coordenadas da janela: as duas fotos precisam estar visíveis.
        // Centralizado, longe das bordas onde o arraste rola a página sozinho; "instant" porque o html tem scroll-behavior: smooth.
        await targetItem.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
        const handle = (await handleButton.boundingBox())!;
        const target = (await targetItem.boundingBox())!;
        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
        await page.mouse.down();
        await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 });
        await page.mouse.up();
      };
      await dragSecondOntoFirst();
      expect(await order()).toEqual([original[1].url, original[0].url]);
      await dragSecondOntoFirst();
      expect(await order()).toEqual(original.map((photo: { url: string }) => photo.url));
      await page.getByRole("button", { name: /^Reordenar foto 1\./ }).focus();
      await page.keyboard.press("ArrowRight");
      expect(await order()).toEqual([original[1].url, original[0].url]);
      // O foco acompanha a foto movida: a mesma alça volta com ArrowLeft.
      await page.keyboard.press("ArrowLeft");
      expect(await order()).toEqual(original.map((photo: { url: string }) => photo.url));
      if (page.viewportSize()!.width < 1024) await page.getByRole("button", { name: "Mais ações da foto 2", exact: true }).click();
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
      await form.getByLabel("Colar legenda", { exact: true }).fill("Preço R$ 69.900,00.");
      await next(page).click();
      await expect(title(page)).toContainText("Etapa 3 de 4");
      await form.getByLabel("Colar legenda", { exact: true }).fill("Veículo revisado e bem cuidado.");
      await expect(page.getByLabel("Colar legenda", { exact: true })).toBeVisible();
      await page.getByLabel("Colar legenda", { exact: true }).fill("Veículo revisado e bem cuidado.\n\nConforto:\n✅ Ar-condicionado");
      await expect(form.getByRole("button", { name: "Remover Ar-condicionado", exact: true })).toBeVisible();
      await form.locator('[name="status"]').selectOption("reservado");
      await next(page).click();
      await expect(page.getByText("Cadastre como disponível antes de reservar o veículo.", { exact: true })).toBeVisible();
      await form.locator('[name="status"]').selectOption("disponivel");
      await back(page).click();
      await expect(page.locator('[name="model"]')).toHaveValue(modelName);
      await next(page).click();
      await expect(form.locator('[name="description"]')).toHaveValue("Veículo revisado e bem cuidado.");
      await expect(form.getByRole("button", { name: "Remover Ar-condicionado", exact: true })).toBeVisible();
      // Cidade e destaque ficam em "Mais detalhes" na etapa 3; o erro (já disparado ao tentar avançar sem preço) abre a seção sozinho.
      await next(page).click();
      await expect(title(page)).toContainText("Etapa 3 de 4");
      await expect(page.getByText("Selecione a cidade onde o veículo está.", { exact: true }).first()).toBeVisible();
      await expect(page.locator("#vehicle-more-details")).toHaveAttribute("open", "");
      await page.getByRole("button", { name: "Linhares ES", exact: true }).click();
      await page.locator('[name="featured"]').check();
      await next(page).click();
      await expect(title(page)).toContainText("Etapa 4 de 4");
      await expect(page.getByRole("button", { name: "Linhares ES", exact: true })).toBeHidden();
      await back(page).click();
      await expect(page.locator('[name="featured"]')).toBeChecked();
      await next(page).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.getByRole("button", { name: "Cadastrar veículo", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/veiculos\/(?!novo$)[^/?]+$/);
      await expect.poll(() => prisma.vehicle.findFirst({ where: { model: modelName } })).not.toBeNull();
      const saved = await prisma.vehicle.findFirstOrThrow({ where: { model: modelName }, include: { photos: { orderBy: { order: "asc" } } } });
      expect(saved.price).toBe(59900);
      expect(saved.accessories).toContain("Conforto: Ar-condicionado");
      expect(saved.hasVideo).toBe(true);
      expect(saved.featured).toBe(true);
      expect(saved.photos.map(photo => photo.url)).toEqual(reordered.map((photo: { url: string }) => photo.url));
      await page.goto("/admin/veiculos");
      await expect(page.getByText(modelName, { exact: false }).first()).toBeVisible();
    });

    test("tela inicial limpa: status do rascunho em texto e detalhes recolhidos; guarda e sai", async ({ page, modelName }) => {
      await page.goto("/admin/veiculos/novo");
      await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeHidden();
      await expect(page.getByRole("button", { name: "Guardar agora", exact: true })).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await uploadPhotos(page);
      await next(page).click();
      await expect(page.locator("details:visible", { hasText: "Mais detalhes (opcional)" })).not.toHaveAttribute("open", "");
      await expect(page.locator('[name="engine"]')).toBeHidden();
      await fillVehicle(page, modelName);
      await next(page).click();
      await expect(page.locator("#vehicle-more-details")).not.toHaveAttribute("open", "");
      await expect(page.locator('[name="purchasePrice"]')).toBeHidden();
      const status = page.locator("button[aria-expanded]").filter({ hasText: /Rascunho automático|Salvo às|Salvando/ });
      await status.click();
      await page.getByRole("button", { name: "Guardar e sair", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/veiculos$/);
    });

    test("retoma a etapa e os campos do rascunho após reload", async ({ page, modelName }) => {
      await page.goto("/admin/veiculos/novo");
      await uploadPhotos(page);
      await next(page).click();
      await fillVehicle(page, modelName);
      await next(page).click();
      const form = page.locator("#vehicle-form");
      await form.getByLabel("Colar legenda", { exact: true }).fill("Texto preservado no rascunho.");
      await guardarAgora(page);
      await expect(page.getByRole("button", { name: "Guardar agora", exact: true })).toBeEnabled();
      await page.reload();
      await page.getByRole("button", { name: "Continuar", exact: true }).click();
      await page.getByRole("button", { name: "Retomar", exact: true }).click();
      await expect(title(page)).toContainText("Etapa 3 de 4");
      await expect(form.locator('[name="description"]')).toHaveValue("Texto preservado no rascunho.");
      await back(page).click();
      await expect(page.locator('[name="model"]')).toHaveValue(modelName);
      expect(JSON.parse(await page.locator('[name="photoUrls"]').inputValue())).toHaveLength(2);
    });

    for (const invalid of ["model", "description", "status"] as const) {
      test(`rascunho na revisão retorna à etapa do erro em ${invalid}`, async ({ page, modelName }) => {
        const description = invalid === "description" ? "Preço R$ 69.900,00." : "Veículo revisado.";
        const payload = {
          step: 4,
          fields: { description },
          brand: "Honda", model: invalid === "model" ? "" : modelName,
          color: "Prata", year: "2020", yearModel: "2021",
          fuel: "Flex", transmission: "Automático", locationCity: "linhares",
          status: invalid === "status" ? "vendido" : "disponivel", category: "carro", description,
          values: { price: "59.900,00", km: "45.000" },
          photos: samples[0].photos,
        };
        await page.route("**/api/admin/drafts?**", route => route.fulfill({
          json: { draft: { payload, updatedAt: new Date().toISOString() } },
        }));
        let submissions = 0;
        page.on("request", request => {
          // O painel também chama uma action automática para expirar reservas.
          if (request.headers()["next-action"] && request.headers()["content-type"]?.startsWith("multipart/form-data")) submissions++;
        });
        await page.goto("/admin/veiculos/novo");
        await page.getByRole("button", { name: "Continuar", exact: true }).click();
        await page.getByRole("button", { name: "Retomar", exact: true }).click();
        await expect(title(page)).toContainText("Etapa 4 de 4");
        await page.getByRole("button", { name: "Cadastrar veículo", exact: true }).click();
        await expect(title(page)).toContainText(`Etapa ${invalid === "model" ? 2 : 3} de 4`);
        const form = page.locator("#vehicle-form");
        if (invalid === "model") await expect(form.locator('[name="model"]')).toBeFocused();
        else if (invalid === "status") {
          await expect(form.locator('[name="status"]')).toBeFocused();
          await expect(page.getByText("Cadastre como disponível antes de iniciar a venda.", { exact: true })).toBeVisible();
        }
        else {
          await expect(form.getByLabel("Colar legenda", { exact: true })).toBeFocused();
          await expect(form.getByTestId("description-price-mismatch")).toBeVisible();
        }
        expect(submissions).toBe(0);
        expect(await prisma.vehicle.count({ where: { model: modelName } })).toBe(0);
      });
    }

    test("edição preserva etapa em Anúncio e atalho de fotos abre a primeira", async ({ page, modelName }) => {
      const original = await prisma.vehicle.findUniqueOrThrow({ where: { id: samples[0].id }, select: { model: true } });
      try {
        await page.goto(`/admin/veiculos/${samples[0].id}?view=anuncio`);
        await expect(title(page)).toContainText("Etapa 1 de 4");
        // O input só habilita após a hidratação e a recuperação da fila de fotos.
        await expect(page.locator('#secao-fotos input[type="file"]')).toBeEnabled();
        await next(page).click();
        await expect(title(page)).toContainText("Etapa 2 de 4");
        await page.locator('[name="model"]').fill(modelName);
        await page.locator('a[data-vehicle-tab="anuncio"]').click();
        await expect(title(page)).toContainText("Etapa 2 de 4");
        await expect(page.locator('[name="model"]')).toHaveValue(modelName);
        await page.locator('a[data-vehicle-tab="fotos"]').click();
        await expect(title(page)).toContainText("Etapa 1 de 4");
        await next(page).click();
        await expect(title(page)).toContainText("Etapa 2 de 4");
        await expect(page.locator('[name="model"]')).toHaveValue(modelName);
        await page.goto(`/admin/veiculos/${samples[0].id}?view=fotos`);
        await expect(page.locator('#secao-fotos input[type="file"]')).toBeEnabled();
        await expect(title(page)).toContainText("Etapa 1 de 4");
        await expect(page.locator("#secao-fotos")).toBeVisible();
      } finally {
        await prisma.vehicle.updateMany({ where: { id: samples[0].id, model: modelName }, data: { model: original.model } });
      }
    });
});
