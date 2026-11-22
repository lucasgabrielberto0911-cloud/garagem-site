import { test as base, expect, type Locator } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const grupos = {
  Carros: [
    ["Central", "/admin"],
    ["Veículos", "/admin/veiculos"],
    ["Compra", "/admin/compra"],
    ["Em preparação", "/admin/em-preparacao"],
    ["Carros parados", "/admin/parados"],
  ],
  Vendas: [
    ["Vendas", "/admin/vendas"],
    ["Promissórias", "/admin/promissorias"],
  ],
  Site: [
    ["Dados do site", "/admin/site"],
    ["Catálogo Meta", "/admin/catalogo"],
    ["Depoimentos", "/admin/depoimentos"],
    ["Ajuda", "/admin/ajuda"],
  ],
};

const test = base.extend<{ sessao: void }>({
  sessao: [async ({ page }, executar) => {
    const email = `menu-${randomUUID()}@local.test`;
    const password = "senha-local-navegacao-123";
    const admin = await prisma.admin.create({
      data: {
        name: "Teste do menu",
        email,
        passwordHash: await bcrypt.hash(password, 4),
      },
    });
    try {
      await page.setExtraHTTPHeaders({
        "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}`,
      });
      await page.addInitScript(() =>
        localStorage.setItem("garagem_consent", "essential"),
      );
      await page.route("**/api/admin/badge", (route) =>
        route.fulfill({ json: { carWarnings: 1, costWarnings: 2, notifications: 3 } }),
      );
      expect(
        (await page.request.post("/api/auth/login", { data: { email, password } })).status(),
      ).toBe(200);
      const cookie = (await page.context().cookies()).find(
        (item) => item.name === "session",
      );
      expect(cookie).toBeTruthy();
      await page.context().addCookies([{ ...cookie!, secure: false }]);
      await executar();
    } finally {
      await prisma.adminAudit.deleteMany({ where: { adminId: admin.id } });
      await prisma.admin.delete({ where: { id: admin.id } });
    }
  }, { auto: true }],
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function conferirGrupos(menu: Locator) {
  await expect(menu.getByRole("heading")).toHaveText(Object.keys(grupos));
  for (const [grupo, links] of Object.entries(grupos)) {
    const secao = menu.getByRole("group", { name: grupo, exact: true });
    await expect(secao.getByRole("link")).toHaveCount(links.length);
    for (const [rotulo, href] of links) {
      await expect(secao.getByRole("link", { name: new RegExp(rotulo) })).toHaveAttribute(
        "href",
        href,
      );
    }
  }
}

test("menu agrupado mantém todas as rotas e indica a página atual", async ({ page }) => {
  await page.goto("/admin/veiculos");
  const mobile = page.viewportSize()!.width < 1024;
  const atalhos = page.getByRole("navigation", { name: "Atalhos do painel" });
  const mais = atalhos.getByRole("button", { name: "Mais", exact: true });
  if (mobile) {
    await expect(atalhos.getByRole("link")).toHaveText([
      /Central/,
      /Veículos/,
      /Parados/,
    ]);
    await expect(atalhos.getByRole("button")).toHaveCount(2);
    await expect(atalhos.getByRole("link", { name: "Veículos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await mais.click();
  } else {
    await expect(atalhos).toBeHidden();
  }

  await conferirGrupos(
    page.getByRole("navigation", { name: "Menu do painel", exact: true }),
  );
  const container = mobile
    ? page.getByRole("dialog", { name: "Menu do painel", exact: true })
    : page.locator("aside").first();
  await expect(container.getByRole("heading", { name: "Conta", exact: true })).toBeVisible();
  await expect(container.getByRole("link", { name: "Minha conta" })).toHaveAttribute(
    "href",
    "/admin/conta",
  );
  await expect(container.getByRole("link", { name: "Ver o site" })).toHaveAttribute(
    "target",
    "_blank",
  );
  await expect(container.getByRole("button", { name: "Sair", exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("menu-agrupado.png") });

  for (const href of [
    "/admin/vendas",
    "/admin/compra",
    "/admin/em-preparacao",
    "/admin/parados",
    "/admin/promissorias",
    "/admin/depoimentos",
    "/admin/site",
    "/admin/catalogo",
    "/admin/ajuda",
    "/admin/conta",
    "/admin/veiculos",
    "/admin",
  ]) {
    if (mobile && !(await container.isVisible())) await mais.click();
    const destino =
      href === "/admin"
        ? container.getByRole("link", { name: "Central", exact: true })
        : container.locator(`a[href="${href}"]`);
    await destino.click();
    await expect(page).toHaveURL(href);
    await expect(page.locator("main").getByRole("heading", { level: 1 })).toBeVisible();
    if (mobile) {
      await expect(container).toBeHidden();
      await expect(mais).toHaveAttribute("aria-expanded", "false");
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
      if (["/admin", "/admin/veiculos", "/admin/parados"].includes(href)) {
        await expect(atalhos.locator(`a[href="${href}"]`)).toHaveAttribute(
          "aria-current",
          "page",
        );
        await expect(mais).not.toHaveClass(/(?:^|\s)text-cream(?:\s|$)/);
      } else {
        await expect(mais).toHaveClass(/(?:^|\s)text-cream(?:\s|$)/);
        await mais.click();
        await expect(destino).toHaveAttribute("aria-current", "page");
      }
    } else {
      await expect(destino).toHaveAttribute("aria-current", "page");
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});

test("Mais e botão + mantêm foco e fecham corretamente no celular", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, "A barra inferior é exclusiva do celular.");
  await page.goto("/admin/vendas");
  const atalhos = page.getByRole("navigation", { name: "Atalhos do painel" });
  const quickBtn = atalhos.getByRole("button", { name: "Ações de carro", exact: true });
  await quickBtn.click();
  const sheet = page.getByRole("dialog", { name: "Ações de carro", exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: /Cadastrar carro/ })).toHaveAttribute(
    "href",
    "/admin/veiculos/novo",
  );
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  const mais = atalhos.getByRole("button", { name: "Mais", exact: true });
  const drawer = page.getByRole("dialog", { name: "Menu do painel", exact: true });
  const fechar = drawer.getByRole("button", { name: "Fechar menu" });
  await mais.focus();
  await page.keyboard.press("Enter");
  await expect(fechar).toBeFocused();
  await expect(mais).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.getByRole("link", { name: "Garagem", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.getByRole("button", { name: "Sair", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(drawer.getByRole("link", { name: "Garagem", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(mais).toBeFocused();
  await mais.click();
  await page.mouse.click(page.viewportSize()!.width - 5, 100);
  await expect(drawer).toBeHidden();
  await mais.click();
  await drawer.getByRole("link", { name: /^Vendas$/ }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL("/admin/vendas");
  await mais.click();
  await fechar.click();
  await expect(drawer).toBeHidden();
});
