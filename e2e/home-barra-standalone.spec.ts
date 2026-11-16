import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", (route) =>
    route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }),
  );
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("home 390x844 (normal e standalone): hero inteiro abaixo do header, barra inferior estilizada e sem cortes", async ({
  page,
  context,
}) => {
  test.skip(page.viewportSize()!.width !== 390, "teste dedicado a 390x844");

  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "display-mode", value: "standalone" }],
  });

  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

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
  const heroAssistant = page.locator(".assistant-cta");
  await expect(heroAssistant).toBeVisible();

  const animNormal = await page.evaluate(() => ({
    launcherAfter: getComputedStyle(document.querySelector(".site-chat-launcher")!, "::after").animationName,
    heroAfter: getComputedStyle(document.querySelector(".assistant-cta")!, "::after").animationName,
  }));
  expect(animNormal.launcherAfter).not.toBe("none");
  expect(animNormal.heroAfter).not.toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const animReduced = await page.evaluate(() => ({
    launcherAfter: getComputedStyle(document.querySelector(".site-chat-launcher")!, "::after").animationName,
    heroAfter: getComputedStyle(document.querySelector(".assistant-cta")!, "::after").animationName,
  }));
  expect(animReduced.launcherAfter).toBe("none");
  expect(animReduced.heroAfter).toBe("none");
});

test("estoque: atalhos simplificados e filtros completos sem corte no desktop e mobile", async ({
  page,
}) => {
  const width = page.viewportSize()!.width;
  await page.goto("/estoque");

  const expectedShortcuts = ["Carros", "Motos", "SUV", "Automático", "Manual", "Até R$ 60 mil"];
  if (width >= 1024) {
    await page.setViewportSize({ width: 1280, height: 800 });
    const shortcutsGroup = page.getByRole("group", { name: "Atalhos" });
    for (const label of expectedShortcuts) {
      await expect(shortcutsGroup.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await expect(shortcutsGroup.getByRole("button", { name: "Sedan", exact: true })).toHaveCount(0);
    await expect(shortcutsGroup.getByRole("button", { name: "Até R$ 30 mil", exact: true })).toHaveCount(0);

    for (const fieldId of [
      "#desktop-marca",
      "#desktop-modelo",
      "#desktop-preco-min",
      "#desktop-preco-max",
      "#desktop-ano-min",
      "#desktop-ano-max",
      "#desktop-cambio",
      "#desktop-km",
    ]) {
      const box = (await page.locator(fieldId).boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(800);
    }

    await shortcutsGroup.getByRole("button", { name: "Até R$ 60 mil", exact: true }).click();
    await expect(page).toHaveURL(/maxPrice=60000/);
    await expect(page.locator("article.listing-card")).toHaveCount(1);

    await shortcutsGroup.getByRole("button", { name: "Manual", exact: true }).click();
    await expect(page).toHaveURL(/transmission=manual/);
  } else {
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
  }
});
