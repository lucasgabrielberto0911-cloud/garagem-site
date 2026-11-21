import { test, expect } from "@playwright/test";
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
      "Oi! Vi o anúncio do Toyota Yaris 2022 que já foi vendido. Tem algum parecido?",
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

  test("slug de lixo devolve 404 amigável genérico sem inventar modelo", async ({
    page,
    request,
  }) => {
    const slug = "/estoque/asdfgh-lixo-123";
    expect((await request.get(slug)).status()).toBe(404);

    const response = await page.goto(slug);
    expect(response?.status()).toBe(404);

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
    await expect(root).not.toContainText(/asdfgh|lixo/i);

    const whatsapp = root.getByRole("link", { name: /WhatsApp/i }).first();
    const href = decodeURIComponent((await whatsapp.getAttribute("href")) ?? "");
    expect(href).toMatch(/^https:\/\/wa\.me\//);
    expect(href).not.toMatch(/asdfgh|lixo/i);

    await expect(root.getByRole("link", { name: "Ver todo o estoque" })).toHaveAttribute(
      "href",
      "/estoque",
    );

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
