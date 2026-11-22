import { test, expect } from "@playwright/test";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";
import { stubPageFotos } from "./stub-fotos";

test.describe("Links antigos de carros vendidos/apagados", () => {
  test.beforeEach(async ({ page }) => {
    await stubPageFotos(page);
    await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  });

  test("slug de carro inexistente responde 404 noindex sem canonical, mostra vendido + WhatsApp + até 4 parecidos", async ({
    page,
    request,
  }) => {
    const slug =
      "/estoque/toyota-yaris-xl-plus-connect-1-5-flex-automatico-2022-cmshv22g9000fl204fk6qz9l2";

    for (const userAgent of ["Mozilla/5.0", "Googlebot"]) {
      const apiRes = await request.get(slug, { headers: { "User-Agent": userAgent } });
      expect(apiRes.status()).toBe(404);
      const html = await apiRes.text();
      expect(html).toContain("noindex");
      expect(html).toContain("Toyota Yaris 2022");
      expect(html).not.toMatch(/<link[^>]+rel=["']canonical["']/i);
    }

    const response = await page.goto(slug);
    expect(response?.status()).toBe(404);

    // SEO: sempre noindex, follow; nunca indexável nem canonical para URL morta.
    const robotsValues = await page
      .locator('meta[name="robots"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("content") ?? ""));
    expect(robotsValues.length).toBeGreaterThan(0);
    for (const content of robotsValues) {
      expect(content).toContain("noindex");
      expect(content).not.toMatch(/(^|,\s*)index\b/i);
    }
    expect(robotsValues.some((content) => content.includes("follow"))).toBe(true);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);

    // Sem duplicação de layout.
    await expect(page.locator("header.site-header, body > div > header").first()).toBeVisible();
    await expect(page.locator("footer")).toHaveCount(1);

    // Conteúdo principal amigável.
    const root = page.locator("[data-sold-link-fallback]");
    await expect(root.locator("h1")).toHaveText("Esse carro já foi vendido");
    await expect(root).toContainText("Toyota Yaris 2022");

    // Botão WhatsApp verde #25D366 com texto escuro e mensagem pré-preenchida.
    const whatsapp = root.getByRole("link", { name: /WhatsApp/i }).first();
    await expect(whatsapp).toBeVisible();
    const href = (await whatsapp.getAttribute("href")) ?? "";
    expect(href).toMatch(/^https:\/\/wa\.me\//);
    const decodedHref = decodeURIComponent(href);
    expect(decodedHref).toContain(
      "Oi! Vi que o Toyota Yaris 2022 já foi vendido no site da Garagem e quero ver opções parecidas no estoque.",
    );
    const styles = await whatsapp.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    });
    expect(styles.bg).toBe("rgb(37, 211, 102)");
    expect(styles.color).toBe("rgb(13, 13, 15)");

    // Grade de parecidos: até 4 disponíveis, sem vendidos, sem filtros.
    const similarSection = page.locator("[data-sold-similar-vehicles]");
    await expect(similarSection.locator("#sold-similar-heading")).toHaveText(
      "Carros parecidos no estoque",
    );
    const cards = similarSection.locator("article.listing-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(4);
    await expect(similarSection).not.toContainText("Vendido");

    // Link "Ver todo o estoque".
    const stockLink = root.getByRole("link", { name: "Ver todo o estoque" });
    await expect(stockLink).toHaveAttribute("href", "/estoque");

    // Sem overflow horizontal.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("mobile 390x844 exibe grade par sem card esticado na largura inteira", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(
      "/estoque/toyota-yaris-xl-plus-connect-1-5-flex-automatico-2022-cmshv22g9000fl204fk6qz9l2",
    );
    expect(response?.status()).toBe(404);

    const grid = page.locator("[data-sold-similar-vehicles] .listing-card-grid");
    const gridBox = await grid.boundingBox();
    expect(gridBox).not.toBeNull();

    const cards = grid.locator("article.listing-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    if (count > 1) {
      expect(count % 2).toBe(0);
    }

    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThan(gridBox!.width * 0.6);
    }

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("prioriza carros da mesma marca nos parecidos quando há correspondência no estoque", async ({
    page,
  }) => {
    const response = await page.goto(
      "/estoque/honda-civic-lxr-2-0-flexone-2014-cmshv22g9000fl204fk6qz9l2",
    );
    expect(response?.status()).toBe(404);

    const root = page.locator("[data-sold-link-fallback]");
    await expect(root.locator("h1")).toHaveText("Esse carro já foi vendido");
    await expect(root).toContainText("Honda Civic 2014");

    const cardBrands = await page
      .locator("[data-sold-similar-vehicles] article.listing-card .listing-card-brand")
      .allTextContents();
    expect(cardBrands.length).toBeGreaterThanOrEqual(2);
    expect(cardBrands[0].trim()).toMatch(/^Honda$/i);
    expect(cardBrands[1].trim()).toMatch(/^Honda$/i);
  });

  test("slug de lixo ou marca + palavra arbitrária devolve 404 genérico sem refletir termo sujo", async ({
    page,
    request,
  }) => {
    for (const { slug, forbidden } of [
      { slug: "/estoque/asdfgh-lixo-123", forbidden: /asdfgh|lixo/i },
      { slug: "/estoque/toyota-lixo-2022", forbidden: /lixo|Toyota/i },
      { slug: "/estoque/volkswagen-abc1d23-2021", forbidden: /abc1d23|Volkswagen/i },
    ]) {
      expect((await request.get(slug)).status()).toBe(404);

      const response = await page.goto(slug);
      expect(response?.status()).toBe(404);

      const title = await page.title();
      expect(title).not.toMatch(forbidden);
      const description =
        (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
      expect(description).not.toMatch(forbidden);

      const robotsValues = await page
        .locator('meta[name="robots"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute("content") ?? ""));
      expect(robotsValues.length).toBeGreaterThan(0);
      for (const content of robotsValues) {
        expect(content).toContain("noindex");
        expect(content).not.toMatch(/(^|,\s*)index\b/i);
      }
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);

      const root = page.locator("[data-sold-link-fallback]");
      await expect(root.locator("h1")).toHaveText("Esse anúncio não está mais disponível");
      await expect(root).not.toContainText(forbidden);

      const whatsapp = root.getByRole("link", { name: /WhatsApp/i }).first();
      const href = decodeURIComponent((await whatsapp.getAttribute("href")) ?? "");
      expect(href).toMatch(/^https:\/\/wa\.me\//);
      expect(href).not.toMatch(forbidden);

      await expect(root.getByRole("link", { name: "Ver todo o estoque" })).toHaveAttribute(
        "href",
        "/estoque",
      );

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  });

  test("não regride ficha de vendido no banco (200) nem retired-listings (redirect para /estoque)", async ({
    page,
    request,
  }) => {
    const soldPath = vehiclePath({ ...samples[0]!, id: "ce2esold000000000000000001" });
    const soldRes = await page.goto(soldPath);
    expect(soldRes?.status()).toBe(200);
    await expect(page.getByText("Este veículo já foi vendido")).toBeVisible();
    await expect(page.locator("[data-ficha-price]")).toContainText("Já vendido");

    const retiredRes = await request.get(
      "/estoque/toyota-etios-xs-xs-1-5-16v-flex-automatico-2017-cmturwtw30000l804s8700mu4",
      { maxRedirects: 0 },
    );
    expect([301, 308]).toContain(retiredRes.status());
    expect(retiredRes.headers()["location"]).toMatch(/\/estoque$/);
  });
});
