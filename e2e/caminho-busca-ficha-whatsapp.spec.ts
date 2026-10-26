import { test as base, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import samples from "./public-samples.json";

const civic = samples[0];
const duster = samples[1];

const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (msg) => {
        if (
          msg.type() === "error" &&
          /hydration|React error|did not match/i.test(msg.text())
        ) {
          errors.push(msg.text());
        }
      });

      // Fixtures locais: imagens e fotos interceptadas sem requisições externas.
      const image = readFileSync("public/branding/placeholder-car.png");
      await page.route("**/fotos/**", (route) =>
        route.fulfill({ contentType: "image/png", body: image }),
      );

      // Bloquear chamadas externas acidentais (sem produção)
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (
          url.includes("supabase.co") ||
          url.includes("google-analytics") ||
          url.includes("facebook.net")
        ) {
          return route.abort();
        }
        return route.continue();
      });

      // Consentimento de cookies pré-definido para não obstruir cliques
      await page.addInitScript(() =>
        localStorage.setItem("garagem_consent", "essential"),
      );

      await use(errors);
      expect(errors, "Erros de JS/hidratação no percurso").toEqual([]);
    },
    { auto: true },
  ],
});

test.describe("Caminho busca -> página do carro -> botão WhatsApp", () => {
  test("desktop: busca na home, abre ficha e valida botão WhatsApp oficial", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name.startsWith("mobile"),
      "Cenário exclusivo para desktop",
    );

    // 1. Busca na home
    await page.goto("/");
    const searchInput = page
      .locator(".hero-search")
      .getByRole("searchbox", { name: "Buscar por marca ou modelo" });
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Civic");

    const searchButton = page
      .locator(".hero-search")
      .getByRole("button", { name: "Buscar", exact: true });
    await searchButton.click();

    // 2. Navegação para listagem e seleção do veículo
    await expect(page).toHaveURL(/\/estoque\?q=Civic/);
    const cards = page.locator("article.listing-card");
    await expect(cards.first()).toBeVisible();

    const civicCard = cards.filter({
      has: page.getByRole("heading", { name: /Civic/i }),
    });
    await expect(civicCard).toBeVisible();
    await expect(civicCard).toContainText("Honda");
    await expect(civicCard).toContainText("Civic");
    await expect(civicCard).toContainText("74.900");

    // Clica no card para abrir a ficha do carro
    await civicCard.locator("[data-stock-card]").click();
    await expect(page).toHaveURL(new RegExp(civic.id));

    // 3. Ficha do carro: título, dados e tipografia (Sora nos títulos, Inter nos textos)
    const aside = page.locator("[data-ficha-page] aside");
    await expect(aside).toBeVisible();

    const vehicleTitle = aside.locator("p.font-display").first();
    await expect(vehicleTitle).toBeVisible();
    await expect(vehicleTitle).toContainText("Civic");
    await expect(vehicleTitle).toHaveClass(/font-display/);

    const vehiclePrice = aside.locator("p.font-display").nth(1);
    await expect(vehiclePrice).toBeVisible();
    await expect(vehiclePrice).toContainText("74.900");
    await expect(vehiclePrice).toHaveClass(/font-display/);

    // Valida texto descritivo com Inter (font-body)
    const note = aside.getByText("Abre o WhatsApp com este anúncio", {
      exact: false,
    });
    await expect(note).toBeVisible();
    const noteFont = await note.evaluate((el) =>
      getComputedStyle(el).fontFamily.toLowerCase(),
    );
    expect(
      noteFont.includes("inter") || noteFont.includes("sans-serif"),
    ).toBe(true);

    // 4. Botão de WhatsApp no desktop (aside lateral)
    const desktopWaButton = aside.locator('a[href*="wa.me"]').first();
    await expect(desktopWaButton).toBeVisible();
    await expect(desktopWaButton).toContainText("Falar no WhatsApp");

    // Validação da cor da marca: vermelho da loja (bg-brand), nunca dourado
    const buttonClass = (await desktopWaButton.getAttribute("class")) || "";
    expect(buttonClass).toContain("bg-brand");
    expect(buttonClass).toContain("text-cream");
    expect(buttonClass).not.toContain("gold");
    expect(buttonClass).not.toContain("yellow");

    const buttonBg = await desktopWaButton.evaluate((el) =>
      getComputedStyle(el).backgroundColor,
    );
    // bg-brand resolve para tom de vermelho da loja (RGB alto em R, baixo em G e B)
    const matchRgb = buttonBg.match(/\d+/g);
    if (matchRgb) {
      const [r, g, b] = matchRgb.map(Number);
      expect(r).toBeGreaterThan(180);
      expect(g).toBeLessThan(50);
      expect(b).toBeLessThan(50);
    }

    // Validação do link do WhatsApp e mensagem pré-preenchida com dados do carro
    const href = (await desktopWaButton.getAttribute("href")) || "";
    expect(href).toMatch(/^https:\/\/wa\.me\/5527996330706\?/);
    const decodedUrl = decodeURIComponent(href);
    expect(decodedUrl).toContain("Civic");
    expect(decodedUrl).toContain("2015");
    expect(decodedUrl).toContain("74.900");

    // Validações adicionais de conversão: botões rápidos de troca, financiamento e vídeo
    const quickActions = aside.locator('a[href*="wa.me"]');
    expect(await quickActions.count()).toBeGreaterThan(1);
  });

  test("mobile: busca na home, abre ficha e valida botão WhatsApp na barra fixa", async ({
    page,
  }, info) => {
    test.skip(
      !info.project.name.startsWith("mobile"),
      "Cenário exclusivo para mobile",
    );

    // 1. Busca na home
    await page.goto("/");
    const searchInput = page
      .locator(".hero-search")
      .getByRole("searchbox", { name: "Buscar por marca ou modelo" });
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Civic");

    const searchButton = page
      .locator(".hero-search")
      .getByRole("button", { name: "Buscar", exact: true });
    await searchButton.click();

    // 2. Navegação e seleção do carro na listagem
    await expect(page).toHaveURL(/\/estoque\?q=Civic/);
    const civicCard = page.locator("article.listing-card").filter({
      has: page.getByRole("heading", { name: /Civic/i }),
    });
    await expect(civicCard).toBeVisible();

    await civicCard.locator("[data-stock-card]").click();
    await expect(page).toHaveURL(new RegExp(civic.id));

    // 3. Ficha do carro no mobile (resumo e tipografia)
    const mobileSummary = page.locator(".ficha-mobile-sheet");
    await expect(mobileSummary).toBeVisible();

    const mobileTitle = mobileSummary.locator("p.font-display").first();
    await expect(mobileTitle).toBeVisible();
    await expect(mobileTitle).toContainText("Civic");
    await expect(mobileTitle).toHaveClass(/font-display/);

    // 4. Barra fixa inferior no mobile (VehicleMobileBar)
    const mobileBar = page.locator("[data-vehicle-mobile-bar]");
    await expect(mobileBar).toBeVisible();

    // Valida que o preço está visível na barra móvel
    await expect(mobileBar).toContainText("74.900");
    await expect(mobileBar).toContainText("Civic");

    // Botão principal de WhatsApp na barra fixa
    const mobileWaButton = mobileBar.locator("#ficha-whatsapp");
    await expect(mobileWaButton).toBeVisible();
    await expect(mobileWaButton).toContainText("Tenho interesse");
    await expect(mobileWaButton).toContainText("no WhatsApp");

    // Validação da cor da marca: vermelho da loja (bg-brand), nunca dourado
    const mobileButtonClass =
      (await mobileWaButton.getAttribute("class")) || "";
    expect(mobileButtonClass).toContain("bg-brand");
    expect(mobileButtonClass).toContain("text-cream");
    expect(mobileButtonClass).not.toContain("gold");
    expect(mobileButtonClass).not.toContain("yellow");

    const mobileButtonBg = await mobileWaButton.evaluate((el) =>
      getComputedStyle(el).backgroundColor,
    );
    const matchRgb = mobileButtonBg.match(/\d+/g);
    if (matchRgb) {
      const [r, g, b] = matchRgb.map(Number);
      expect(r).toBeGreaterThan(180);
      expect(g).toBeLessThan(50);
      expect(b).toBeLessThan(50);
    }

    // Validação do link do WhatsApp oficial com parâmetros e mensagem do carro
    const href = (await mobileWaButton.getAttribute("href")) || "";
    expect(href).toMatch(/^https:\/\/wa\.me\/5527996330706\?/);
    const decodedUrl = decodeURIComponent(href);
    expect(decodedUrl).toContain("Civic");
    expect(decodedUrl).toContain("2015");
    expect(decodedUrl).toContain("74.900");

    // Validação do menu secundário de opções na barra mobile (financiamento, troca, vídeo)
    const optionsTrigger = mobileBar.getByRole("button", {
      name: "Financiamento, troca ou vídeo",
    });
    if (await optionsTrigger.isVisible()) {
      await optionsTrigger.click();
      await expect(
        mobileBar.getByRole("button", { name: "Fechar opções" }),
      ).toBeVisible();

      const financeLink = mobileBar.locator('a[aria-label*="financiamento"]');
      await expect(financeLink).toBeVisible();
      const financeHref = (await financeLink.getAttribute("href")) || "";
      expect(financeHref).toContain("wa.me/5527996330706");
      expect(decodeURIComponent(financeHref)).toContain("financiamento");
    }

    // Sem rolagem horizontal no mobile
    const fitsViewport = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fitsViewport).toBe(true);
  });

  test("busca direta no catálogo (/estoque) e abertura de ficha com CTA de contato", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/estoque");

    // Campo de busca no catálogo
    const searchInput = page.getByRole("searchbox", {
      name: "Buscar por marca, modelo ou versão",
    });
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Duster");
    await searchInput.press("Enter");

    await expect(page).toHaveURL(/q=Duster/);

    // Localiza e abre o card da Duster
    const dusterCard = page.locator("article.listing-card").filter({
      has: page.getByRole("heading", { name: /Duster/i }),
    });
    await expect(dusterCard).toBeVisible();
    await expect(dusterCard).toContainText("54.900");

    await dusterCard.locator("[data-stock-card]").click();
    await expect(page).toHaveURL(new RegExp(duster.id));

    // Ficha da Duster
    await expect(page.locator("[data-ficha-page]")).toContainText("Duster");
    await expect(page.locator("[data-ficha-page]")).toContainText("54.900");

    // Valida botão WhatsApp correspondente à viewport
    if (isMobile) {
      const mobileWa = page.locator(
        "[data-vehicle-mobile-bar] #ficha-whatsapp",
      );
      await expect(mobileWa).toBeVisible();
      const href = (await mobileWa.getAttribute("href")) || "";
      expect(href).toContain("wa.me/5527996330706");
      expect(decodeURIComponent(href)).toContain("Duster");
    } else {
      const desktopWa = page
        .locator("[data-ficha-page] aside a[href*='wa.me']")
        .first();
      await expect(desktopWa).toBeVisible();
      const href = (await desktopWa.getAttribute("href")) || "";
      expect(href).toContain("wa.me/5527996330706");
      expect(decodeURIComponent(href)).toContain("Duster");
    }
  });
});
