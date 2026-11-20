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

test.describe("Caminho lista -> página do carro -> botão WhatsApp", () => {
  test("desktop: lista do estoque, abre ficha e valida botão WhatsApp oficial", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name.startsWith("mobile"),
      "Cenário exclusivo para desktop",
    );

    // 1. Lista do estoque (sem busca: só a lista de carros)
    await page.goto("/estoque");
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

    const vehicleTitle = aside.getByRole("heading", { level: 1 });
    await expect(vehicleTitle).toBeVisible();
    await expect(vehicleTitle).toContainText("Civic");
    await expect(vehicleTitle).toHaveClass(/font-display/);

    const vehiclePrice = aside.locator("[data-ficha-price]");
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

    // Validação da cor do CTA principal de WhatsApp: verde #25D366 com texto escuro, nunca dourado
    const buttonClass = (await desktopWaButton.getAttribute("class")) || "";
    expect(buttonClass).toContain("bg-[#25D366]");
    expect(buttonClass).toContain("text-asphalt");
    expect(buttonClass).not.toContain("gold");
    expect(buttonClass).not.toContain("yellow");

    // Remove o ponteiro do botão antes de medir a cor base (#25D366; hover é #1FB858).
    await page.mouse.move(0, 0);
    await expect
      .poll(() =>
        desktopWaButton.evaluate((el) => {
          const css = getComputedStyle(el);
          return { bg: css.backgroundColor, color: css.color };
        }),
      )
      .toEqual({ bg: "rgb(37, 211, 102)", color: "rgb(13, 13, 15)" });

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

  test("mobile: lista do estoque, abre ficha e valida botão WhatsApp na barra fixa", async ({
    page,
  }, info) => {
    test.skip(
      !info.project.name.startsWith("mobile"),
      "Cenário exclusivo para mobile",
    );

    // 1. Lista do estoque (sem busca: só a lista de carros)
    await page.goto("/estoque");
    const civicCard = page.locator("article.listing-card").filter({
      has: page.getByRole("heading", { name: /Civic/i }),
    });
    await expect(civicCard).toBeVisible();

    await civicCard.locator("[data-stock-card]").click();
    await expect(page).toHaveURL(new RegExp(civic.id));

    // 3. Ficha do carro no mobile (resumo e tipografia)
    const mobileSummary = page.locator(".ficha-mobile-sheet");
    await expect(mobileSummary).toBeVisible();

    const mobileTitle = mobileSummary.locator("h1").first();
    await expect(mobileTitle).toBeVisible();
    await expect(mobileTitle).toContainText("Civic");
    await expect(mobileTitle).toHaveClass(/font-display/);

    // 4. Barra fixa inferior no mobile (VehicleMobileBar)
    const mobileBar = page.locator("[data-vehicle-mobile-bar]");
    await expect(mobileBar).toBeVisible();

    // Valida que o preço está visível na barra móvel
    await expect(mobileBar).toContainText("74.900");
    await expect(mobileBar).not.toContainText("Agendar visita");

    // Botão principal de WhatsApp na barra fixa
    const mobileWaButton = mobileBar.locator("#ficha-whatsapp");
    await expect(mobileWaButton).toBeVisible();
    await expect(mobileWaButton).toContainText("Chamar no WhatsApp");

    // Verde WhatsApp com texto escuro, nunca o vermelho da marca nem dourado
    const mobileButtonClass =
      (await mobileWaButton.getAttribute("class")) || "";
    expect(mobileButtonClass).toContain("bg-[#25D366]");
    expect(mobileButtonClass).toContain("text-asphalt");
    expect(mobileButtonClass).not.toContain("gold");
    expect(mobileButtonClass).not.toContain("yellow");

    const mobileButtonColors = await mobileWaButton.evaluate((el) => {
      const css = getComputedStyle(el);
      return { bg: css.backgroundColor, color: css.color };
    });
    expect(mobileButtonColors).toEqual({
      bg: "rgb(37, 211, 102)",
      color: "rgb(13, 13, 15)",
    });

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

  test("lista do catálogo (/estoque) e abertura de ficha com CTA de contato", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/estoque");

    // Só a lista: sem campo de busca nem filtros
    await expect(page.getByRole("searchbox")).toHaveCount(0);

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
