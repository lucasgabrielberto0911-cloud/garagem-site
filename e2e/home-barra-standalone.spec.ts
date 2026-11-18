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

test("home: três botões grandes no topo; assistente é um botão vermelho que abre o chat", async ({
  page,
}) => {
  await page.goto("/");

  const whatsapp = page.locator(".hero-cta").getByRole("link", { name: "Falar no WhatsApp" });
  const stock = page.locator(".hero-cta").getByRole("link", { name: "Ver estoque", exact: true });
  const assistant = page.locator(".hero-cta").getByRole("button", { name: "Pergunte ao assistente" });
  const boxes = [] as { x: number; y: number; width: number; height: number }[];
  for (const button of [whatsapp, stock, assistant]) {
    await expect(button).toBeVisible();
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(56);
    boxes.push(box);
  }
  if (page.viewportSize()!.width >= 1024) {
    // Desktop: lado a lado, na mesma linha.
    expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(2);
    expect(Math.abs(boxes[1].y - boxes[2].y)).toBeLessThan(2);
  } else {
    // Celular: empilhados e de largura total (mesma largura).
    expect(boxes[0].y).toBeLessThan(boxes[1].y);
    expect(boxes[1].y).toBeLessThan(boxes[2].y);
    expect(Math.abs(boxes[0].width - boxes[2].width)).toBeLessThan(2);
  }

  // Botão de verdade: fundo vermelho cheio, texto branco, sem sublinhado.
  const style = await assistant.evaluate((el) => {
    const css = getComputedStyle(el);
    return { bg: css.backgroundColor, color: css.color, deco: css.textDecorationLine, radius: css.borderTopLeftRadius };
  });
  expect(style.bg).toBe("rgb(232, 24, 28)");
  expect(style.color).toBe("rgb(255, 255, 255)");
  expect(style.deco).toBe("none");
  expect(parseFloat(style.radius)).toBeGreaterThan(0);

  // Nada de campo de pergunta, balão flutuante nem busca na home.
  await expect(page.locator("#home-assistant-input")).toHaveCount(0);
  await expect(page.locator(".site-chat-launcher")).toHaveCount(0);
  await expect(page.locator(".hero-search")).toHaveCount(0);

  if (page.viewportSize()!.width >= 1024) {
    // Desktop: o botão verde flutuante do WhatsApp continua.
    await expect(page.locator("[data-support-whatsapp]")).toBeVisible();
    await expect(page.locator("[data-support-whatsapp]")).toHaveAttribute("href", /wa\.me/);
  }

  await assistant.click();
  await expect(page.locator(".site-chat-panel")).toBeVisible();
  await page.getByRole("button", { name: "Fechar chat" }).click();
});

test("home desktop 1280x800: botão do WhatsApp e aviso de cookies não cobrem Salvar dos cards", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    await interceptNonBrandImages(page);
    await page.goto(baseURL!);
    const whatsappBox = (await page.locator("[data-support-whatsapp]").boundingBox())!;
    const consentBox = (await page.locator(".site-consent").boundingBox())!;
    expect(whatsappBox.height).toBeGreaterThanOrEqual(44);
    expect(whatsappBox.width).toBeGreaterThanOrEqual(44);
    const overlaps = (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number },
    ) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
    expect(consentBox.x + consentBox.width).toBeLessThan(whatsappBox.x);
    expect(overlaps(consentBox, whatsappBox)).toBe(false);
    const saveBoxes = await page
      .locator("article.listing-card .vehicle-card-favorite button")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
    for (const save of saveBoxes) {
      expect(overlaps(whatsappBox, save)).toBe(false);
      expect(overlaps(consentBox, save)).toBe(false);
    }
  } finally {
    await context.close();
  }
});

test("estoque: só a lista de carros, sem filtros, e links antigos com filtro não quebram", async ({
  page,
}) => {
  await page.goto("/estoque");
  await expect(page.locator("article.listing-card").first()).toBeVisible();
  for (const hidden of [
    "[data-stock-filters]",
    "#painel-filtros",
    "#desktop-marca",
    "#desktop-modelo",
    "#desktop-cambio",
    "#desktop-km",
  ]) {
    await expect(page.locator(hidden)).toHaveCount(0);
  }
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Filtros/ })).toHaveCount(0);

  if (page.viewportSize()!.width < 1024 && page.viewportSize()!.width >= 390) {
    const navTop = (await page.locator("[data-mobile-bottom-nav]").boundingBox())!.y;
    const firstCardBox = (await page.locator("article.listing-card").first().boundingBox())!;
    expect(firstCardBox.y).toBeLessThan(navTop);
  }

  const total = await page.locator("article.listing-card").count();
  await page.goto("/estoque?brand=Marca-que-nao-existe&body=suv&maxPrice=1&q=xyz");
  await expect(page.locator("article.listing-card")).toHaveCount(total);
  await expect(page.locator("[data-stock-empty]")).toHaveCount(0);
});
