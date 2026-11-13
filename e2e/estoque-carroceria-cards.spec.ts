import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", route => route.fulfill({
    contentType: "image/png", path: "public/branding/placeholder-car.png",
  }));
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("chips de carroceria filtram o estoque e somem com a carroceria ao trocar para motos", async ({ page }) => {
  await page.goto("/estoque");
  const cards = page.locator("article.listing-card");
  await expect(cards).not.toHaveCount(0);
  // No celular a fileira rola e o chip pode ficar parcialmente fora da tela (aria-hidden, depende da fonte do runner):
  // dispara o clique direto no botão em vez de procurar pelo papel.
  await page.locator("button", { hasText: /^SUV$/ }).first().dispatchEvent("click");
  await expect(page).toHaveURL(/body=suv/);
  await expect(page).toHaveURL(/category=carro/);
  await expect(cards.filter({ has: page.getByRole("heading", { name: "Civic", exact: true }) })).toHaveCount(0);
  await expect(cards.filter({ has: page.getByRole("heading", { name: "HR-V", exact: true }) })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Remover Carroceria: SUV", exact: true }).first()).toBeVisible();

  // Chips fora da tela no celular ficam ocultos da árvore de acessibilidade: abre pela URL.
  await page.goto("/estoque?category=carro&body=sedan");
  await expect(cards.filter({ has: page.getByRole("heading", { name: "Civic", exact: true }) })).toHaveCount(1);
  await expect(cards.filter({ has: page.getByRole("heading", { name: "HR-V", exact: true }) })).toHaveCount(0);

  // No celular a fileira rola até o chip ativo e "Motos" pode estar fora da tela.
  await page.locator("button", { hasText: /^Motos$/ }).first().dispatchEvent("click");
  await expect(page).toHaveURL(/category=moto/);
  await expect(page).not.toHaveURL(/body=/);
});

test("card do estoque: WhatsApp largo com 44 px e coração com rótulo Salvar", async ({ page }) => {
  await page.goto("/estoque");
  const card = page.locator("article.listing-card").first();
  const whatsapp = card.locator(".listing-card-interest a");
  const cardBox = (await card.boundingBox())!;
  const waBox = (await whatsapp.boundingBox())!;
  expect(waBox.height).toBeGreaterThanOrEqual(44);
  expect(waBox.width).toBeGreaterThanOrEqual(cardBox.width - 2);
  expect(await whatsapp.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
  const save = card.getByRole("button", { name: /^Salvar/ });
  await expect(save).toHaveText("Salvar");
  expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  await save.click();
  await expect(card.getByRole("button", { name: /^Remover/ })).toHaveText("Salvo");
});

test("celular: textos do card e da barra de baixo com pelo menos 12 px", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, "barra de baixo só no celular");
  await page.goto("/estoque");
  const sizes = await page.evaluate(() => {
    const pick = (selector: string) => Array.from(document.querySelectorAll(selector))
      .filter(el => (el.textContent ?? "").trim())
      .map(el => parseFloat(getComputedStyle(el).fontSize));
    return [
      ...pick("[data-mobile-bottom-nav] span"),
      ...pick(".listing-card-brand"),
      ...pick(".listing-card-badges span"),
    ];
  });
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(12);
});

test("celular: selos do card ficam no alto da foto, um só, sem cobrir o carro", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 640, "selos no alto só no celular");
  await page.goto("/estoque");
  const photo = page.locator(".listing-card-photo").first();
  const badges = photo.locator(".listing-card-badges > span:visible");
  expect(await badges.count()).toBeLessThanOrEqual(1);
  const photoBox = (await photo.boundingBox())!;
  const badgeBox = await badges.first().boundingBox();
  if (badgeBox) {
    expect(badgeBox.y + badgeBox.height).toBeLessThan(photoBox.y + photoBox.height * 0.4);
    expect(badgeBox.width).toBeLessThan(photoBox.width * 0.55);
  }
});

test("home no celular: WhatsApp, Ver estoque e números da loja logo no topo, sem assistente", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 640, "layout só do celular");
  await page.goto("/");
  const hero = page.locator(".hero-cta");
  await expect(hero.getByRole("link", { name: "Falar no WhatsApp" })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Ver estoque" })).toBeVisible();
  await expect(hero.getByRole("button", { name: "Pergunte ao assistente" })).toBeHidden();
  const stats = page.locator(".hero-stats");
  await expect(stats).toBeVisible();
  const box = (await stats.boundingBox())!;
  expect(box.y).toBeLessThan(page.viewportSize()!.height * 1.5);
});
