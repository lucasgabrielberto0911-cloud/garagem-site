import { test as base, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
const localDatabase =
  process.env.E2E_TEST === "1" &&
  ["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) &&
  ["/ci", "/garagem_e2e"].includes(database.pathname);

const db = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

type FixtureData = {
  tag: string;
  completeId: string;
  consignedId: string;
  missingPurchaseId: string;
  pendingId: string;
  parked68Id: string;
  parked48Id: string;
  parked35Id: string;
};

const test = base.extend<{ seed: FixtureData }>({
  seed: async ({ page, context, baseURL }, provide) => {
    const tag = `AUD${randomInt(1000, 9999)}`;
    const email = `admin-carros-${randomUUID().slice(0, 8)}@garagem.local`;
    const password = `Carros-${randomUUID().slice(0, 10)}`;
    const admin = await db.admin.create({
      data: {
        name: "Admin Carros Teste",
        email,
        passwordHash: await bcrypt.hash(password, 4),
      },
    });

    const createdIds: string[] = [];
    try {
      const sixPhotos = [0, 1, 2, 3, 4, 5].map((order) => ({
        url: "/branding/placeholder-car.png",
        order,
      }));

      const complete = await db.vehicle.create({
        data: {
          brand: tag,
          model: "Completo",
          year: 2023,
          yearModel: 2024,
          km: 18000,
          price: 118900,
          purchasePrice: 98000,
          consigned: false,
          color: "Preto",
          transmission: "Automático",
          fuel: "Flex",
          description:
            "Seminovo revisado com manual e chave reserva pronto para rodar.",
          status: "disponivel",
          createdAt: daysAgo(10),
          photos: { create: sixPhotos },
        },
      });
      createdIds.push(complete.id);

      const consigned = await db.vehicle.create({
        data: {
          brand: tag,
          model: "ConsignadoOk",
          year: 2022,
          yearModel: 2023,
          km: 24000,
          price: 109900,
          purchasePrice: null,
          consigned: true,
          color: "Azul",
          transmission: "Automático",
          fuel: "Flex",
          description: "Consignado revisado e completo com procedência.",
          status: "disponivel",
          createdAt: daysAgo(12),
          photos: { create: sixPhotos },
        },
      });
      createdIds.push(consigned.id);

      const missingPurchase = await db.vehicle.create({
        data: {
          brand: tag,
          model: "SemCompra",
          year: 2022,
          yearModel: 2022,
          km: 33000,
          price: 89900,
          purchasePrice: null,
          consigned: false,
          color: "Branco",
          transmission: "Automático",
          fuel: "Flex",
          description: "Carro próprio completo de anúncio mas sem custo de compra.",
          status: "disponivel",
          createdAt: daysAgo(14),
          photos: { create: sixPhotos },
        },
      });
      createdIds.push(missingPurchase.id);

      const pending = await db.vehicle.create({
        data: {
          brand: tag,
          model: "Pendente",
          year: 2021,
          yearModel: 2022,
          km: 42000,
          price: 0,
          purchasePrice: null,
          consigned: false,
          color: "Prata",
          transmission: "Manual",
          fuel: "Flex",
          description: "",
          status: "disponivel",
          createdAt: daysAgo(15),
        },
      });
      createdIds.push(pending.id);

      const parked68 = await db.vehicle.create({
        data: {
          brand: tag,
          model: "Parado68",
          year: 2020,
          yearModel: 2021,
          km: 61000,
          price: 88000,
          purchasePrice: 74000,
          fipePrice: 80000,
          color: "Branco",
          transmission: "Automático",
          fuel: "Flex",
          description: "Sedan revisado pronto para entrega imediata.",
          status: "disponivel",
          createdAt: daysAgo(68),
          photos: {
            create: [{ url: "/branding/placeholder-car.png", order: 0 }],
          },
        },
      });
      createdIds.push(parked68.id);

      const parked48 = await db.vehicle.create({
        data: {
          brand: tag,
          model: "Parado48",
          year: 2021,
          yearModel: 2021,
          km: 52000,
          price: 74900,
          purchasePrice: 62000,
          fipePrice: null,
          color: "Cinza",
          transmission: "Manual",
          fuel: "Flex",
          description: "Hatch econômico em ótimo estado.",
          status: "disponivel",
          createdAt: daysAgo(48),
          photos: {
            create: [{ url: "/branding/placeholder-car.png", order: 0 }],
          },
        },
      });
      createdIds.push(parked48.id);

      const parked35 = await db.vehicle.create({
        data: {
          brand: tag,
          model: "Parado35",
          year: 2022,
          yearModel: 2023,
          km: 31000,
          price: 92900,
          purchasePrice: 79000,
          fipePrice: 95000,
          color: "Vermelho",
          transmission: "Automático",
          fuel: "Flex",
          description: "SUV revisado com procedência garantida.",
          status: "disponivel",
          createdAt: daysAgo(35),
          photos: {
            create: [{ url: "/branding/placeholder-car.png", order: 0 }],
          },
        },
      });
      createdIds.push(parked35.id);

      // 12 visitas nos últimos 30d (3 nos últimos 7d) e 0 cliques -> "Muita visita e pouco clique"
      // + 1 visita antiga (> 30d) que não deve entrar na janela de 30d
      await db.adminAudit.createMany({
        data: [
          ...Array.from({ length: 3 }, () => ({
            adminId: "site:direto",
            entityId: parked68.id,
            action: "site:visita",
            changes: { origin: "direto" },
            createdAt: daysAgo(2),
          })),
          ...Array.from({ length: 9 }, () => ({
            adminId: "site:direto",
            entityId: parked68.id,
            action: "site:visita",
            changes: { origin: "direto" },
            createdAt: daysAgo(15),
          })),
          {
            adminId: "site:direto",
            entityId: parked68.id,
            action: "site:visita",
            changes: { origin: "direto" },
            createdAt: daysAgo(45),
          },
        ],
      });

      await context.route("**/fotos/**", (route) =>
        route.fulfill({
          path: "public/branding/placeholder-car.png",
          contentType: "image/png",
        }),
      );
      await context.route("**/*.supabase.co/storage/**", (route) =>
        route.abort(),
      );

      const login = await page.request.post("/api/auth/login", {
        data: { email, password },
      });
      expect(login.status()).toBe(200);
      const setCookie = login.headers()["set-cookie"];
      if (setCookie && baseURL) {
        const cookiePair = setCookie.split(";")[0];
        await context.addCookies([
          {
            name: "session",
            value: cookiePair.slice("session=".length),
            url: baseURL,
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
      }

      await provide({
        tag,
        completeId: complete.id,
        consignedId: consigned.id,
        missingPurchaseId: missingPurchase.id,
        pendingId: pending.id,
        parked68Id: parked68.id,
        parked48Id: parked48.id,
        parked35Id: parked35.id,
      });
    } finally {
      if (createdIds.length > 0) {
        await db.adminAudit.deleteMany({
          where: { entityId: { in: createdIds } },
        });
        await db.photo.deleteMany({
          where: { vehicleId: { in: createdIds } },
        });
        await db.vehicle.deleteMany({ where: { id: { in: createdIds } } });
      }
      await db.admin.delete({ where: { id: admin.id } }).catch(() => {});
    }
  },
});

test.skip(!localDatabase, "Requer banco local dedicado e E2E_TEST=1.");
test.afterAll(async () => {
  await db.$disconnect();
});

async function assertCleanLayout(page: Page) {
  const report = await page.evaluate(() => {
    const docOverflow =
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth;
    const main = document.querySelector("main") ?? document.body;
    const interactive = Array.from(
      main.querySelectorAll("a[href], button, input, select, summary"),
    );
    const smallTargets: Array<{ tag: string; text: string; w: number; h: number }> = [];
    for (const el of interactive) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.getAttribute("type") === "checkbox") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.height < 43.5 || rect.width < 43.5) {
        smallTargets.push({
          tag: el.tagName.toLowerCase(),
          text: (el.getAttribute("aria-label") || el.textContent || "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 45),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    }
    return { docOverflow, smallTargets };
  });

  expect(report.docOverflow, "Sem overflow horizontal").toBe(0);
  expect(report.smallTargets, "Todos os alvos tocáveis >= 44px").toEqual([]);
}

for (const vp of [
  { name: "360x780", width: 360, height: 780 },
  { name: "1280x800", width: 1280, height: 800 },
]) {
  test(`Veículos e Carros parados limpos e funcionais em ${vp.name}`, async ({
    page,
    seed,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const isMobile = vp.width < 640;
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // 1. /admin/veiculos: cards limpos, selos só quando faltar algo, consignado sem "Sem compra"
    await page.goto(`/admin/veiculos?q=${seed.tag}`);
    await expect(
      page.getByRole("heading", { name: "Veículos", exact: true }),
    ).toBeVisible();
    await assertCleanLayout(page);

    const completeCard = page.locator("li", { hasText: `${seed.tag} Completo` });
    await expect(completeCard).toBeVisible();
    await expect(completeCard).not.toContainText(
      /Sem preço|Sem foto|Poucas fotos|Sem legenda|Sem capa|Sem compra/i,
    );

    // Barra de ações no celular: só Editar, Alterar preço e ⋯ (Destacar fica oculto no celular)
    const featureBtn = completeCard.getByRole("button", {
      name: new RegExp(`^Destacar: ${seed.tag} Completo`),
    });
    if (isMobile) {
      await expect(featureBtn).toBeHidden();
    } else {
      await expect(featureBtn).toBeVisible();
    }

    const consignedCard = page.locator("li", {
      hasText: `${seed.tag} ConsignadoOk`,
    });
    await expect(consignedCard).toBeVisible();
    await expect(consignedCard).not.toContainText(
      /Sem preço|Sem foto|Poucas fotos|Sem legenda|Sem capa|Sem compra/i,
    );

    const missingPurchaseCard = page.locator("li", {
      hasText: `${seed.tag} SemCompra`,
    });
    await expect(missingPurchaseCard).toBeVisible();
    await expect(missingPurchaseCard).toContainText("Sem compra");
    await expect(missingPurchaseCard).not.toContainText(
      /Sem preço|Sem foto|Poucas fotos|Sem legenda|Sem capa/i,
    );

    const pendingCard = page.locator("li", { hasText: `${seed.tag} Pendente` });
    await expect(pendingCard).toContainText("Sem preço");
    await expect(pendingCard).toContainText("Sem foto");
    await expect(pendingCard).toContainText("Sem legenda");
    await expect(pendingCard).toContainText("Sem compra");

    // Filtro Com pendência no servidor (inclui Pendente e SemCompra, exclui Completo e ConsignadoOk)
    await page
      .getByRole("group", { name: "Filtros rápidos" })
      .getByRole("button", { name: /Com pendência/ })
      .click();
    await expect(page).toHaveURL(/pendencia=com-pendencia/);
    await expect(pendingCard).toBeVisible();
    await expect(missingPurchaseCard).toBeVisible();
    await expect(completeCard).toHaveCount(0);
    await expect(consignedCard).toHaveCount(0);
    await assertCleanLayout(page);

    // API paginada com pendencia=com-pendencia respeita o mesmo filtro no servidor
    const apiPage1 = await page.request.get(
      `/api/admin/veiculos?q=${encodeURIComponent(seed.tag)}&tab=estoque&pendencia=com-pendencia&page=1&pageSize=2`,
    );
    expect(apiPage1.status()).toBe(200);
    const body1 = (await apiPage1.json()) as {
      total: number;
      hasMore: boolean;
      vehicles: Array<{ id: string }>;
    };
    // Pendente + SemCompra + Parado68 + Parado48 + Parado35 (1 foto cada < 6) = 5 com pendência
    expect(body1.total).toBe(5);
    expect(body1.vehicles.length).toBe(2);
    expect(body1.hasMore).toBe(true);

    // Filtro Parados (+30d)
    await page
      .getByRole("group", { name: "Filtros rápidos" })
      .getByRole("button", { name: /Parados \(\+30d\)/ })
      .click();
    await expect(page).toHaveURL(/pendencia=parados/);
    await expect(
      page.locator("li", { hasText: `${seed.tag} Parado68` }),
    ).toBeVisible();
    await expect(completeCard).toHaveCount(0);
    await assertCleanLayout(page);

    // Edição rápida de preço em /admin/veiculos
    await page.goto(`/admin/veiculos?q=${seed.tag}+Completo`);
    await page.getByRole("button", { name: "Alterar preço" }).first().click();
    await page.getByLabel("Preço à vista (R$)").fill("117.500,00");
    await page.getByRole("button", { name: "Salvar preço" }).click();
    await expect(
      page.locator("li", { hasText: `${seed.tag} Completo` }),
    ).toContainText("117.500");

    // 2. /admin/parados: faixas, sugestões, métricas reais (7d/30d), leitura simples e ações rápidas
    await page.goto("/admin/parados");
    await expect(
      page.getByRole("heading", { name: "Carros parados", exact: true }),
    ).toBeVisible();
    await assertCleanLayout(page);

    await expect(page.getByRole("heading", { name: "60+ dias" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "46–60 dias" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "31–45 dias" })).toBeVisible();
    await expect(page.locator("main")).toContainText(
      "Decidir: vender no preço ou repassar",
    );
    await expect(page.locator("main")).toContainText("Baixar preço e divulgar");
    await expect(page.locator("main")).toContainText(
      "Rever preço e trocar capa",
    );

    const card68 = page.locator("li", { hasText: `${seed.tag} Parado68` });
    await expect(card68).toContainText("+10% da FIPE");
    await expect(card68).toContainText("Visitas (30d)");
    await expect(card68).toContainText("12");
    await expect(card68).toContainText("3 nos últimos 7d");
    await expect(card68).toContainText("Cliques WhatsApp (30d)");
    await expect(card68).toContainText(
      "Muita visita e pouco clique → rever preço ou fotos",
    );
    await expect(
      card68.getByRole("link", { name: "Trocar capa" }),
    ).toHaveAttribute("href", `/admin/veiculos/${seed.parked68Id}?view=fotos`);

    const card48 = page.locator("li", { hasText: `${seed.tag} Parado48` });
    await expect(card48).not.toContainText("FIPE");
    await expect(card48).toContainText("Pouca visita → divulgar mais");

    // Edição rápida de preço em /admin/parados
    await card68.getByRole("button", { name: "Alterar preço" }).click();
    await card68.getByLabel("Preço à vista (R$)").fill("84.000,00");
    await card68.getByRole("button", { name: "Salvar preço" }).click();
    await expect(card68).toContainText("84.000");
    await expect(card68).toContainText("+5% da FIPE");

    // Link Abrir ficha do carro
    await card68.getByRole("link", { name: "Abrir ficha do carro" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/veiculos/${seed.parked68Id}$`));

    expect(consoleErrors, "Zero erros de console").toEqual([]);
    expect(pageErrors, "Zero erros de página").toEqual([]);
  });
}
