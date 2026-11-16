import { expect, test } from "@playwright/test";
import { stubPageFotos } from "./stub-fotos";

test("galeria /vendidos carrega sem overflow, sem preço e com CTA de similares", async ({
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

  const showcaseTexts = await page.locator("[data-sold-showcase]").allInnerTexts();
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
