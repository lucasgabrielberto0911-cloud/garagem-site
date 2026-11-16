import { expect, test, type Page } from "@playwright/test";
import { E2E_PHOTO_FIXTURE } from "../src/lib/e2e-photo-stub";
import { stubPageFotos } from "./stub-fotos";

async function interceptNonBrandImages(page: Page) {
  await stubPageFotos(page);
  await page.route("**/*", (route) => {
    const req = route.request();
    if (req.resourceType() !== "image") return route.fallback();
    const url = req.url();
    if (url.startsWith("data:") || url.startsWith("blob:")) return route.fallback();
    try {
      const parsed = new URL(url);
      if (
        parsed.pathname.startsWith("/branding/") ||
        parsed.pathname.startsWith("/_next/static/") ||
        parsed.pathname.endsWith(".svg") ||
        parsed.pathname === "/favicon.png" ||
        parsed.pathname === "/apple-touch-icon.png"
      ) {
        return route.fallback();
      }
    } catch {
      return route.fallback();
    }
    return route.fulfill({ contentType: "image/png", path: E2E_PHOTO_FIXTURE });
  });
}

async function emulateStandaloneDisplayMode(page: Page) {
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (/\(\s*display-mode\s*:\s*(standalone|fullscreen)\s*\)/i.test(query)) {
        return {
          matches: true,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        } as MediaQueryList;
      }
      return originalMatchMedia(query);
    };

    try {
      Object.defineProperty(window.navigator, "standalone", {
        get: () => true,
        configurable: true,
      });
    } catch {
      /* ambiente bloqueou redefinição */
    }

    const patchStandaloneMediaRules = () => {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          if (
            rule instanceof CSSMediaRule &&
            /display-mode\s*:\s*(standalone|fullscreen)/i.test(rule.media.mediaText)
          ) {
            try {
              if (!Array.from(rule.media).includes("all")) {
                rule.media.appendMedium("all");
              }
            } catch {
              /* ignora regra protegida */
            }
          }
        }
      }
    };

    window.addEventListener("DOMContentLoaded", patchStandaloneMediaRules);
    window.addEventListener("load", patchStandaloneMediaRules);
    const observer = new MutationObserver(patchStandaloneMediaRules);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

test.beforeEach(async ({ page }) => {
  await interceptNonBrandImages(page);
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("home 390x844 (normal e standalone): hero inteiro abaixo do header, barra inferior uniforme sem invadir conteúdo e sem splash tardio", async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width !== 390, "teste dedicado a 390x844");

  await emulateStandaloneDisplayMode(page);
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  const standaloneState = await page.evaluate(() => ({
    standaloneMedia: window.matchMedia("(display-mode: standalone)").matches,
    navigatorStandalone: Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  }));
  expect(standaloneState.standaloneMedia).toBe(true);
  expect(standaloneState.navigatorStandalone).toBe(true);

  const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewportMeta).toContain("viewport-fit=cover");

  const header = page.getByRole("banner");
  const h1 = page.locator("h1");
  await expect(header).toBeVisible();
  await expect(h1).toBeVisible();

  const headerBox = (await header.boundingBox())!;
  const h1Box = (await h1.boundingBox())!;
  expect(h1Box.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height + 12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const nav = page.locator("[data-mobile-bottom-nav]");
  await expect(nav).toBeVisible();
  const navBox = (await nav.boundingBox())!;
  expect(navBox.y + navBox.height).toBeLessThanOrEqual(844 + 1);

  const waLink = nav.getByRole("link", { name: "Abrir WhatsApp da Garagem" });
  const waBox = (await waLink.boundingBox())!;
  expect(waBox.height).toBeGreaterThanOrEqual(44);
  expect(waBox.width).toBeGreaterThanOrEqual(44);

  const waPillBox = (await nav.locator(".whatsapp-pulse").boundingBox())!;
  expect(waPillBox.y).toBeGreaterThanOrEqual(navBox.y - 1);

  const navItemHeights = await nav.locator("li > a").evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().height)),
  );
  expect(navItemHeights.length).toBe(5);
  for (const h of navItemHeights) {
    expect(Math.abs(h - navItemHeights[0])).toBeLessThanOrEqual(1);
    expect(h).toBeGreaterThanOrEqual(44);
  }

  const navStyles = await nav.evaluate((el) => {
    const css = getComputedStyle(el);
    const label = el.querySelector("span.font-display");
    return {
      backdrop: css.backdropFilter || (css as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || "",
      labelFont: label ? getComputedStyle(label).fontFamily : "",
    };
  });
  expect(navStyles.backdrop).toContain("blur");
  expect(navStyles.labelFont.toLowerCase()).toContain("sora");

  // Sem BootSplash tardio por cima da página já pintada.
  await page.waitForTimeout(2000);
  await expect(page.locator(".brand-splash")).toHaveCount(0);

  // Menu mobile modal dentro do viewport standalone
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menuDialog = page.getByRole("dialog", { name: "Menu principal" });
  await expect(menuDialog).toBeVisible();
  const menuPanel = menuDialog.locator("> div").nth(1);
  await expect
    .poll(async () => {
      const box = (await menuPanel.boundingBox())!;
      return box.y >= headerBox.y + headerBox.height - 1 && box.y + box.height <= 844 + 1;
    })
    .toBe(true);
  await page.getByRole("button", { name: "Fechar", exact: true }).click();

  // Chat modal dentro do viewport standalone
  await page.getByRole("button", { name: "Ajuda para escolher" }).first().click();
  const chatPanel = page.locator(".site-chat-panel");
  await expect(chatPanel).toBeVisible();
  await expect
    .poll(async () => {
      const box = (await chatPanel.boundingBox())!;
      return box.y >= 0 && box.y + box.height <= 844 + 1;
    })
    .toBe(true);
  await page.getByRole("button", { name: "Fechar chat" }).click();

  // Rodapé não fica coberto pela barra inferior ao rolar até o fim
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
  );
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const f = document.querySelector("footer")!.getBoundingClientRect();
        const n = document.querySelector("[data-mobile-bottom-nav]")!.getBoundingClientRect();
        return f.bottom <= n.top + 1;
      });
    })
    .toBe(true);
});

test("home desktop: assistente visível com animação respeitando prefers-reduced-motion", async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width < 1024, "launcher flutuante visível no desktop");
  await page.goto("/");

  const launcher = page.locator(".site-chat-launcher");
  await expect(launcher).toBeVisible();
  const heroAssistant = page.getByRole("button", { name: "Pergunte ao assistente" });
  await expect(heroAssistant).toBeVisible();
  const heroPlaceholder = page.locator("[data-assistant-placeholder]");
  await expect(heroPlaceholder).toBeVisible();
  await expect(heroPlaceholder).toHaveAttribute("data-motion", "animated");

  const animNormal = await page.evaluate(() => ({
    launcherAfter: getComputedStyle(document.querySelector(".site-chat-launcher")!, "::after").animationName,
    caretAnim: getComputedStyle(document.querySelector(".assistant-placeholder-caret")!).animationName,
  }));
  expect(animNormal.launcherAfter).not.toBe("none");
  expect(animNormal.caretAnim).not.toBe("none");

  await expect(page.locator('label[for="home-assistant-input"]')).toHaveText(
    "Pergunte qualquer coisa sobre nossos carros",
  );
  await expect(heroPlaceholder).toHaveText("Carros até R$ 60 mil", { timeout: 5000 });

  const assistantInput = page.locator("#home-assistant-input");
  await assistantInput.focus();
  await expect(heroPlaceholder).toHaveAttribute("data-motion", "static");
  await assistantInput.fill("Civic");
  await expect(heroPlaceholder).toHaveCount(0);
  await assistantInput.fill("");
  await assistantInput.blur();
  await expect(heroPlaceholder).toBeVisible();
  await expect(heroPlaceholder).toHaveAttribute("data-motion", "animated");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(heroPlaceholder).toHaveAttribute("data-motion", "static");
  await expect(heroPlaceholder).toHaveText("Qual o mais econômico?");
  const animReduced = await page.evaluate(() => ({
    launcherAfter: getComputedStyle(document.querySelector(".site-chat-launcher")!, "::after").animationName,
    caretCount: document.querySelectorAll(".assistant-placeholder-caret").length,
  }));
  expect(animReduced.launcherAfter).toBe("none");
  expect(animReduced.caretCount).toBe(0);
});

test("estoque: 6 atalhos na ordem certa, Carroceria nos selects, painel 1280x800 <= 790 e gaveta sem duplicar preço", async ({
  page,
}) => {
  const width = page.viewportSize()!.width;
  await page.goto("/estoque");
  await page.evaluate(() => document.fonts.ready);

  const expectedShortcuts = ["Até R$ 60 mil", "Automático", "Manual", "Carros", "Motos", "SUV"];

  if (width >= 1024) {
    await page.setViewportSize({ width: 1280, height: 800 });
    const aside = page.locator("aside");
    const filterCard = aside.locator("[data-pending]").first();
    const shortcutsGroup = filterCard.getByRole("group", { name: "Atalhos" });
    const labels = await shortcutsGroup.locator("button").allInnerTexts();
    expect(labels.map((item) => item.trim())).toEqual(expectedShortcuts);

    for (const label of expectedShortcuts) {
      await expect(shortcutsGroup.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await expect(shortcutsGroup.getByRole("button", { name: "Sedan", exact: true })).toHaveCount(0);
    await expect(shortcutsGroup.getByRole("button", { name: "Até R$ 30 mil", exact: true })).toHaveCount(0);

    const asideStyle = await aside.evaluate((el) => getComputedStyle(el).overflowY);
    expect(asideStyle).not.toBe("auto");
    expect(asideStyle).not.toBe("scroll");

    const asideBox = (await aside.boundingBox())!;
    const cardBox = (await filterCard.boundingBox())!;
    const moreSummary = filterCard.locator("details > summary");
    const summaryBox = (await moreSummary.boundingBox())!;

    expect(asideBox.y + asideBox.height).toBeLessThanOrEqual(790);
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(790);
    expect(summaryBox.y + summaryBox.height).toBeLessThanOrEqual(790);
    expect(summaryBox.height).toBeLessThanOrEqual(44);

    for (const fieldId of [
      "#desktop-marca",
      "#desktop-modelo",
      "#desktop-tipo",
      "#desktop-carroceria",
      "#desktop-preco-min",
      "#desktop-preco-max",
      "#desktop-ano-min",
      "#desktop-ano-max",
      "#desktop-cambio",
      "#desktop-km",
    ]) {
      const box = (await page.locator(fieldId).boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(790);
    }

    await page.locator("#desktop-carroceria").selectOption("sedan");
    await expect(page).toHaveURL(/body=sedan/);
    await expect(page.locator("article.listing-card")).toHaveCount(1);
    await page.locator("#desktop-carroceria").selectOption("");

    await shortcutsGroup.getByRole("button", { name: "Até R$ 60 mil", exact: true }).click();
    await expect(page).toHaveURL(/maxPrice=60000/);
    await expect(page.locator("article.listing-card")).toHaveCount(1);

    await shortcutsGroup.getByRole("button", { name: "Manual", exact: true }).click();
    await expect(page).toHaveURL(/transmission=manual/);
  } else {
    const mobileBar = page.locator("[data-stock-filters]");
    const shortcutsGroup = mobileBar.getByRole("group", { name: "Atalhos" });
    const labels = await shortcutsGroup.locator("button").allInnerTexts();
    expect(labels.map((item) => item.trim())).toEqual(expectedShortcuts);

    for (const label of expectedShortcuts) {
      const btn = shortcutsGroup.getByRole("button", { name: label, exact: true });
      await expect(btn).toBeVisible();
      expect(await btn.getAttribute("aria-hidden")).toBeNull();
      expect(await btn.getAttribute("tabindex")).toBeNull();
      const box = (await btn.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole("button", { name: "Carros", exact: true }).click();
    await expect(page).toHaveURL(/category=carro/);
    await page.locator('button[aria-controls="painel-filtros"]').click();
    const drawer = page.getByRole("dialog", { name: "Filtrar veículos" });
    await expect(drawer).toBeVisible();
    await expect
      .poll(async () => {
        const box = (await drawer.boundingBox())!;
        return box.y >= 0 && box.y + box.height <= page.viewportSize()!.height + 1;
      })
      .toBe(true);

    await expect(drawer.getByText("Faixa de preço", { exact: true })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "Até R$ 30 mil" })).toHaveCount(0);
    await expect(drawer.getByLabel("Preço mínimo", { exact: true })).toBeVisible();
    await expect(drawer.getByLabel("Preço máximo", { exact: true })).toBeVisible();
    await drawer.getByLabel("Carroceria", { exact: true }).selectOption("suv");
    await drawer.getByRole("button", { name: /^Ver (\d+ )?veículos$/ }).click();
    await expect(page).toHaveURL(/body=suv/);
    await expect(page.locator("article.listing-card")).toHaveCount(2);
  }
});
