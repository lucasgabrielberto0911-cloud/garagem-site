import { expect, test } from "@playwright/test";
import { stubPageFotos } from "./stub-fotos";

test("galeria /vendidos carrega entregas do Instagram, pagina +24, 4 por linha no desktop e sem simular ou preço", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await stubPageFotos(page);

  const response = await request.get("/vendidos");
  expect(response.status()).toBe(200);

  await page.goto("/vendidos");
  await expect(
    page.getByRole("heading", { name: /Veículos vendidos e clientes/i }),
  ).toBeVisible();

  await expect(
    page.getByText("Galeria de entregas em atualização"),
  ).toHaveCount(0);

  const instaSection = page.locator("[data-insta-deliveries]");
  await expect(instaSection).toBeVisible();
  await expect(
    instaSection.getByRole("heading", { name: /Clientes que já levaram o seu/i }),
  ).toBeVisible();

  const instaItems = instaSection.locator("[data-insta-deliveries-grid] > li");
  await expect(instaItems).toHaveCount(24);
  await expect(instaSection.locator("[data-insta-deliveries-counter]")).toHaveText(
    "Mostrando 24 de 369",
  );

  const firstLink = instaItems.first().locator("a");
  await expect(firstLink).toHaveAttribute("href", /^https:\/\/www\.instagram\.com\//);
  await expect(firstLink).toHaveAttribute("target", "_blank");
  await expect(firstLink).toHaveAttribute("rel", /noopener/);
  await expect(firstLink).toHaveAttribute("aria-label", /Instagram/);
  await expect(firstLink.locator("img")).toHaveAttribute("alt", /^Entrega de /);

  const viewportWidth = page.viewportSize()?.width ?? 1440;
  const expectedCols = viewportWidth >= 1024 ? 4 : 2;
  const tops = await instaItems
    .evaluateAll((els) => els.slice(0, 6).map((el) => Math.round(el.getBoundingClientRect().top)));
  for (let i = 1; i < expectedCols; i++) {
    expect(Math.abs(tops[i] - tops[0])).toBeLessThanOrEqual(2);
  }
  expect(tops[expectedCols]).toBeGreaterThan(tops[0] + 20);

  const loadMoreBtn = instaSection.getByRole("button", { name: "Ver mais entregas" });
  await expect(loadMoreBtn).toBeVisible();
  await loadMoreBtn.click();
  await expect(instaItems).toHaveCount(48);
  await expect(instaSection.locator("[data-insta-deliveries-counter]")).toHaveText(
    "Mostrando 48 de 369",
  );

  const mainText = await page.locator("main").innerText();
  expect(mainText).not.toMatch(/\bsimul\w*\b/i);

  const showcaseTexts = await page.locator("[data-sold-showcase]").allInnerTexts();
  expect(showcaseTexts.length).toBeGreaterThan(0);
  for (const text of showcaseTexts) {
    expect(text).not.toMatch(/R\$\s*\d/);
  }

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasOverflow).toBe(false);

  const waLinks = await page
    .locator('a[href^="https://wa.me/"]')
    .evaluateAll((elements) =>
      elements.map((el) => (el as HTMLAnchorElement).href),
    );
  expect(waLinks.length).toBeGreaterThan(0);
  for (const href of waLinks) {
    expect(new URL(href).searchParams.get("text") ?? "").not.toMatch(/R\$/);
  }
});
