import { test as base, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";
import { PHOTO_BLOB_ORIGIN } from "../src/lib/public-photo-url";

const prisma = new PrismaClient();

const test = base.extend<{
  fixture: {
    prefix: string;
    inCatalogId: string;
    consignedId: string;
    noPhotoId: string;
    noPriceId: string;
    soldVehicleId: string;
    saleId: string;
  };
}>({
  fixture: [
    async ({ page }, executar) => {
      const prefix = `CatE2E-${randomUUID().slice(0, 8)}`;
      const email = `cat-${randomUUID()}@local.test`;
      const password = "senha-local-catalogo-123";
      const admin = await prisma.admin.create({
        data: {
          name: "Teste Catálogo",
          email,
          passwordHash: await bcrypt.hash(password, 4),
        },
      });
      const blobUrl = `${PHOTO_BLOB_ORIGIN}/veiculos/${prefix}/capa.jpg`;
      const inCatalog = await prisma.vehicle.create({
        data: {
          brand: "Toyota",
          model: `${prefix} Proprio`,
          version: "XEi 2.0",
          year: 2021,
          yearModel: 2021,
          km: 41000,
          price: 98900,
          fuel: "Flex",
          transmission: "Automático",
          status: "disponivel",
          consigned: false,
          photos: { create: [{ url: blobUrl, order: 0 }] },
        },
      });
      const consigned = await prisma.vehicle.create({
        data: {
          brand: "Honda",
          model: `${prefix} Consignado`,
          version: "EX 1.5",
          year: 2020,
          yearModel: 2020,
          km: 55000,
          price: 89900,
          fuel: "Flex",
          transmission: "Automático",
          status: "disponivel",
          consigned: true,
          photos: { create: [{ url: blobUrl, order: 0 }] },
        },
      });
      const noPhoto = await prisma.vehicle.create({
        data: {
          brand: "Fiat",
          model: `${prefix} SemFoto`,
          year: 2022,
          yearModel: 2022,
          km: 28000,
          price: 67900,
          fuel: "Flex",
          transmission: "Manual",
          status: "disponivel",
          consigned: false,
        },
      });
      const noPrice = await prisma.vehicle.create({
        data: {
          brand: "Chevrolet",
          model: `${prefix} SemPreco`,
          year: 2022,
          yearModel: 2022,
          km: 22000,
          price: 0,
          fuel: "Flex",
          transmission: "Manual",
          status: "disponivel",
          consigned: false,
          photos: { create: [{ url: blobUrl, order: 0 }] },
        },
      });
      const soldVehicle = await prisma.vehicle.create({
        data: {
          brand: "Nissan",
          model: `${prefix} Vendido`,
          year: 2021,
          yearModel: 2021,
          km: 39000,
          price: 85900,
          fuel: "Flex",
          transmission: "Automático",
          status: "vendido",
          consigned: false,
        },
      });
      const sale = await prisma.sale.create({
        data: {
          vehicleId: soldVehicle.id,
          salePrice: 84900,
          paymentMethod: "pix",
          saleDate: new Date(),
        },
      });
      const vehicleIds = [
        inCatalog.id,
        consigned.id,
        noPhoto.id,
        noPrice.id,
        soldVehicle.id,
      ];

      try {
        await page.setExtraHTTPHeaders({
          "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}`,
        });
        await page.addInitScript(() =>
          localStorage.setItem("garagem_consent", "essential"),
        );
        await page.route(`${PHOTO_BLOB_ORIGIN}/**`, (route) =>
          route.fulfill({
            path: "public/branding/placeholder-car.png",
            contentType: "image/png",
          }),
        );
        const login = await page.request.post("/api/auth/login", {
          data: { email, password },
        });
        expect(login.status()).toBe(200);
        const cookie = (await page.context().cookies()).find(
          (item) => item.name === "session",
        );
        expect(cookie).toBeTruthy();
        await page.context().addCookies([{ ...cookie!, secure: false }]);
        await executar({
          prefix,
          inCatalogId: inCatalog.id,
          consignedId: consigned.id,
          noPhotoId: noPhoto.id,
          noPriceId: noPrice.id,
          soldVehicleId: soldVehicle.id,
          saleId: sale.id,
        });
      } finally {
        await prisma.sale.deleteMany({ where: { id: sale.id } });
        await prisma.photo.deleteMany({
          where: { vehicleId: { in: vehicleIds } },
        });
        await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
        await prisma.adminAudit.deleteMany({ where: { adminId: admin.id } });
        await prisma.admin.delete({ where: { id: admin.id } });
      }
    },
    { auto: true },
  ],
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("catálogo Meta lista próprios dentro e consignado/sem foto/sem preço fora com link copiável", async ({
  page,
  fixture,
}) => {
  await page.goto("/admin/catalogo");
  await expect(
    page.getByRole("heading", { level: 1, name: "Catálogo Meta" }),
  ).toBeVisible();

  await expect(page.getByText("/api/meta/catalog.csv")).toBeVisible();
  const copyButton = page.getByRole("button", { name: "Copiar link" });
  await expect(copyButton).toBeVisible();
  const copyBox = await copyButton.boundingBox();
  expect(copyBox!.height).toBeGreaterThanOrEqual(44);

  const inCard = page.locator("section", {
    has: page.getByRole("heading", { name: /^No catálogo \(/ }),
  });
  const outCard = page.locator("section", {
    has: page.getByRole("heading", { name: /^Fora do catálogo \(/ }),
  });

  await expect(
    inCard.locator(`a[href="/admin/veiculos/${fixture.inCatalogId}"]`),
  ).toContainText(`${fixture.prefix} Proprio`);
  await expect(
    inCard.locator(`a[href="/admin/veiculos/${fixture.inCatalogId}"]`),
  ).toContainText("1 foto no feed");
  await expect(
    inCard.locator(`a[href="/admin/veiculos/${fixture.consignedId}"]`),
  ).toHaveCount(0);

  const consignedLink = outCard.locator(
    `a[href="/admin/veiculos/${fixture.consignedId}"]`,
  );
  await expect(consignedLink).toContainText("Consignado (nunca entra)");

  const noPhotoLink = outCard.locator(
    `a[href="/admin/veiculos/${fixture.noPhotoId}"]`,
  );
  await expect(noPhotoLink).toContainText("Sem foto");

  const noPriceLink = outCard.locator(
    `a[href="/admin/veiculos/${fixture.noPriceId}"]`,
  );
  await expect(noPriceLink).toContainText("Sem preço");

  await expect(
    page.getByRole("button", { name: /incluir no catálogo/i }),
  ).toHaveCount(0);

  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("toque >= 44px em cadastro/edição de veículo, vendas e folga de rolagem em Dados do site", async ({
  page,
  fixture,
}) => {
  const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024;

  // 1. /admin/veiculos/novo e /admin/veiculos/:id — Rascunho automático >= 44px
  for (const route of ["/admin/veiculos/novo", `/admin/veiculos/${fixture.inCatalogId}`]) {
    await page.goto(route);
    const draftButton = page
      .locator("button[aria-expanded]")
      .filter({ hasText: /Rascunho automático|Salvo às|Salvando/ })
      .first();
    await expect(draftButton).toBeVisible();
    const draftBox = await draftButton.boundingBox();
    expect(draftBox!.height).toBeGreaterThanOrEqual(44);
  }

  // 2. /admin/vendas — alvos de toque >= 44px sem overflow lateral
  await page.goto("/admin/vendas");
  await expect(
    page.getByRole("heading", { level: 1, name: "Vendas" }),
  ).toBeVisible();

  const verVendas = page.getByRole("link", { name: "Ver vendas" });
  if (await verVendas.isVisible()) {
    const box = await verVendas.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  if (isDesktop) {
    const row = page
      .locator("table tbody tr")
      .filter({ hasText: `${fixture.prefix} Vendido` })
      .first();
    await expect(row).toBeVisible();
    for (const locator of [
      row.locator(`a[href="/admin/veiculos/${fixture.soldVehicleId}?view=operacao"]`),
      row.getByRole("button", { name: "Editar venda" }),
      row.getByRole("button", { name: "Gerar contrato" }),
      row.getByRole("button", { name: "Desfazer venda" }),
    ]) {
      const box = await locator.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  }

  const vendasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(vendasOverflow).toBeLessThanOrEqual(0);

  // 3. /admin/site — sem input 1x1 visível e último bloco livre acima da barra inferior
  await page.goto("/admin/site");
  await expect(
    page.getByRole("heading", { level: 1, name: "Dados do site" }),
  ).toBeVisible();

  const measureSite = () =>
    page.evaluate(async () => {
      const tinyInputs: string[] = [];
      for (const el of document.querySelectorAll("input")) {
        if (el.type === "hidden" || el.type === "checkbox" || el.type === "radio") continue;
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) <= 0.05) {
          continue;
        }
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40)) {
          tinyInputs.push(`${el.type}:${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }

      window.scrollTo({
        top: document.scrollingElement!.scrollHeight,
        behavior: "instant",
      });
      await new Promise((r) => setTimeout(r, 50));

      const vh = window.innerHeight;
      const fixedBottom = [...document.querySelectorAll("body *")].filter((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return (
          s.position === "fixed" &&
          r.height > 20 &&
          r.bottom >= vh - 2 &&
          r.top > vh / 2 &&
          s.display !== "none" &&
          s.visibility !== "hidden"
        );
      });
      const barTop = fixedBottom.length
        ? Math.min(...fixedBottom.map((el) => el.getBoundingClientRect().top))
        : vh;
      const maintenanceSummary = [...document.querySelectorAll("summary")].find(
        (el) => el.textContent?.includes("Manutenção de fotos"),
      );
      const lastBottom = maintenanceSummary
        ? maintenanceSummary.getBoundingClientRect().bottom
        : 0;
      return {
        overflow: Math.round(document.documentElement.scrollWidth - window.innerWidth),
        tinyInputs,
        coveredPx: Math.round(lastBottom - barTop),
        barTop: Math.round(barTop),
      };
    });

  const cleanSite = await measureSite();
  expect(cleanSite.overflow).toBeLessThanOrEqual(0);
  expect(cleanSite.tinyInputs).toEqual([]);
  expect(cleanSite.coveredPx).toBeLessThanOrEqual(0);

  // Marca o formulário como alterado para ativar a barra fixa no celular e confirmar folga
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const regionInput = page.locator('input[name="region"]');
  await regionInput.fill(`${await regionInput.inputValue()} `);
  const dirtySite = await measureSite();
  expect(dirtySite.coveredPx).toBeLessThanOrEqual(0);
});
