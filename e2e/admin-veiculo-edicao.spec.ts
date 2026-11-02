import { test as base, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import samples from "./public-samples.json";
import { conferirRodapeDoAnuncio } from "./admin-form-footer";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
const localDatabase =
  process.env.E2E_TEST === "1" &&
  ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) &&
  ["/ci", "/garagem_e2e"].includes(database.pathname);
const prisma = new PrismaClient();

type EditFixture = {
  vehicleId: string;
  modelName: string;
};

const test = base.extend<{ fixture: EditFixture }>({
  fixture: async ({ page, context, baseURL }, run) => {
    const id = randomUUID();
    const modelName = `Edicao M5 ${id.slice(0, 8)}`;
    const email = `edicao-m5-${id}@local.test`;
    const password = "edicao-m5-local-123";
    const admin = await prisma.admin.create({
      data: {
        name: "Teste Edição M5",
        email,
        passwordHash: await bcrypt.hash(password, 4),
      },
    });
    const samplePhoto = samples[0].photos[0];
    const vehicle = await prisma.vehicle.create({
      data: {
        brand: "Honda",
        model: modelName,
        version: "EXL 2.0",
        category: "carro",
        year: 2021,
        yearModel: 2022,
        price: 58900,
        km: 32000,
        fuel: "Flex",
        transmission: "Automático",
        color: "Branco",
        status: "disponivel",
        locationCity: "linhares",
        description: "Veículo revisado e com garantia.",
        accessories: ["Conforto: Ar-condicionado", "Segurança: Airbags"],
        photos: {
          create: [
            {
              url: samplePhoto.url,
              thumbnailUrl: samplePhoto.thumbnailUrl,
              order: 0,
            },
          ],
        },
      },
    });

    try {
      const photoFixture = readFileSync("public/branding/placeholder-car.png");
      await page.route("**/fotos/**", (route) =>
        route.fulfill({ contentType: "image/png", body: photoFixture }),
      );
      await page.route("https://*.supabase.co/storage/**", (route) =>
        route.fulfill({ contentType: "image/png", body: photoFixture }),
      );
      await page.setExtraHTTPHeaders({
        "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}`,
      });
      await page.addInitScript(() =>
        localStorage.setItem("garagem_consent", "essential"),
      );
      const login = await page.request.post("/api/auth/login", {
        data: { email, password },
      });
      expect(login.ok()).toBeTruthy();
      const cookie = login.headers()["set-cookie"].split(";")[0];
      await context.addCookies([
        {
          name: "session",
          value: cookie.slice("session=".length),
          url: baseURL!,
          httpOnly: true,
          sameSite: "Lax",
          secure: false,
        },
      ]);
      await run({ vehicleId: vehicle.id, modelName });
    } finally {
      await prisma.vehicle.deleteMany({ where: { id: vehicle.id } });
      await prisma.adminAudit.deleteMany({ where: { adminId: admin.id } });
      await prisma.admin.delete({ where: { id: admin.id } });
    }
  },
});

test.skip(!localDatabase, "Requer banco local dedicado e E2E_TEST=1.");
test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("edição M5: etapas com acesso direto, salvar sempre visível e ações do anúncio", () => {
  test("M9: rodapé único acompanha altura, rolagem e navegação", async ({ page, fixture }, testInfo) => {
    for (const [screen, path] of [
      ["criacao", "/admin/veiculos/novo"],
      ["edicao", `/admin/veiculos/${fixture.vehicleId}`],
    ]) {
      await page.goto(path);
      await conferirRodapeDoAnuncio(page);
      const footer = page.getByRole("navigation", { name: "Etapas do anúncio" });
      await page.screenshot({ path: testInfo.outputPath(`${screen}.png`), fullPage: true });
      const before = (await footer.boundingBox())!.height;
      // Simula uma área segura maior, que altera a altura do rodapé.
      await footer.evaluate(element => {
        element.style.paddingBottom = "34px";
      });
      await expect.poll(async () => (await footer.boundingBox())!.height).toBeGreaterThan(before);
      await conferirRodapeDoAnuncio(page);
      console.log(`M9 ${screen} ${page.viewportSize()!.width}px: rodapé ${before}px; com área segura 34px: ${(await footer.boundingBox())!.height}px`);
    }
    await page.goto(`/admin/veiculos/${fixture.vehicleId}?view=operacao`);
    await expect(page.locator("#vehicle-form")).toHaveCount(0);
    if (page.viewportSize()!.width < 1024) {
      await expect(page.getByRole("navigation", { name: "Atalhos do painel" })).toBeVisible();
    }
    await page.goto("/admin/veiculos/rascunhos");
    if (page.viewportSize()!.width < 1024) {
      await expect(page.getByRole("navigation", { name: "Atalhos do painel" })).toBeVisible();
    }
  });

  test("muda preço direto na etapa 3 sem 3 Próximo, mantém Salvar visível e expõe Ver no site, Kit, Iniciar venda e Excluir", async ({
    page,
    fixture,
  }) => {
    await page.goto(`/admin/veiculos/${fixture.vehicleId}`);
    const title = page.locator("#wizard-title");
    const nav = page.getByRole("navigation", { name: "Etapas do anúncio" });
    const saveButton = nav.getByRole("button", {
      name: "Salvar alterações",
      exact: true,
    });
    const moreButton = nav.getByRole("button", {
      name: "Mais ações do anúncio",
      exact: true,
    });

    await expect(title).toContainText("Etapa 1 de 4");
    await conferirRodapeDoAnuncio(page);
    if (page.viewportSize()!.width < 1024) {
      await page.getByRole("button", { name: "Menu do painel", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Menu do painel" })).toBeVisible();
      await page.getByRole("button", { name: "Fechar menu" }).click();
    }
    await expect(
      page.locator('#secao-fotos input[type="file"]'),
    ).toBeEnabled();

    // Salvar alterações e menu "⋯" sempre visíveis já na etapa 1, com alvo >= 44px e sem overflow horizontal.
    await expect(saveButton).toBeVisible();
    await expect(moreButton).toBeVisible();
    expect((await saveButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await moreButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();

    // Acesso direto à etapa 3 (Preço) com 1 clique, sem precisar de 3 "Próximo".
    await nav.getByRole("button", { name: /^3\./ }).click();
    await expect(title).toContainText("Etapa 3 de 4");
    await conferirRodapeDoAnuncio(page);
    const priceInput = page.locator('[name="priceDisplay"]');
    await expect(priceInput).toBeVisible();
    await priceInput.fill("64.800,00");

    // Salva direto da etapa 3, sem precisar avançar para a etapa 4.
    await saveButton.click();
    await expect
      .poll(
        async () =>
          (
            await prisma.vehicle.findUniqueOrThrow({
              where: { id: fixture.vehicleId },
              select: { price: true },
            })
          ).price,
      )
      .toBe(64800);
    await expect(title).toContainText("Etapa 3 de 4");

    // Acesso direto às demais etapas (2, 4 e 1) e Salvar sempre visível em todas.
    await nav.getByRole("button", { name: /^2\./ }).click();
    await expect(title).toContainText("Etapa 2 de 4");
    await conferirRodapeDoAnuncio(page);
    await expect(saveButton).toBeVisible();

    await nav.getByRole("button", { name: /^4\./ }).click();
    await expect(title).toContainText("Etapa 4 de 4");
    await conferirRodapeDoAnuncio(page);
    await expect(saveButton).toBeVisible();

    // Menu "⋯" expõe Ver no site, Kit de divulgação, Iniciar venda e Excluir.
    await moreButton.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();

    const viewOnSiteLink = sheet.getByRole("link", { name: /Ver no site/i });
    await expect(viewOnSiteLink).toBeVisible();
    await expect(viewOnSiteLink).toHaveAttribute("target", "_blank");
    await expect(viewOnSiteLink).toHaveAttribute("href", /\/estoque\//);

    // Kit de divulgação abre o modal e fecha.
    await sheet.getByRole("button", { name: /Kit de divulgação/i }).click();
    const promoDialog = page.getByRole("dialog", { name: "Kit de Divulgação" });
    await expect(promoDialog).toBeVisible();
    await expect(
      promoDialog.getByRole("button", {
        name: "Copiar texto do WhatsApp",
        exact: true,
      }),
    ).toBeVisible();
    await promoDialog
      .getByRole("button", { name: "Fechar", exact: true })
      .click();
    await expect(promoDialog).toBeHidden();

    // Iniciar venda leva ao fluxo de venda após confirmação.
    await moreButton.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Iniciar venda/i })
      .click();
    const soldDialog = page.getByRole("dialog", { name: "Iniciar venda" });
    await expect(soldDialog).toBeVisible();
    await soldDialog
      .getByRole("button", { name: "Iniciar venda", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/vendas/nova\\?veiculo=${fixture.vehicleId}`),
    );

    // Volta à edição e testa Excluir definitivamente.
    await page.goto(`/admin/veiculos/${fixture.vehicleId}`);
    await expect(title).toContainText("Etapa 1 de 4");
    await moreButton.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Excluir definitivamente/i })
      .click();
    const deleteDialog = page.getByRole("dialog", {
      name: "Excluir definitivamente",
    });
    await expect(deleteDialog).toBeVisible();
    const confirmInput = deleteDialog.locator("input");
    if (await confirmInput.isVisible()) {
      await confirmInput.fill("EXCLUIR");
    }
    await deleteDialog
      .getByRole("button", { name: "Excluir definitivamente", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/veiculos$/);
    await expect
      .poll(async () =>
        prisma.vehicle.count({ where: { id: fixture.vehicleId } }),
      )
      .toBe(0);
  });
});
