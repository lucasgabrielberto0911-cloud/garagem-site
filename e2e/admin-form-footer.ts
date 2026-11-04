import { expect, type Page } from "@playwright/test";

export async function conferirRodapeDoAnuncio(page: Page) {
  const footer = page.getByRole("navigation", { name: "Etapas do anúncio" });
  await expect(footer).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Atalhos do painel" })).toBeHidden();
  await expect.poll(() => page.locator("#vehicle-form").evaluate(form => {
    const footer = form.querySelector('nav[aria-label="Etapas do anúncio"]')!;
    return parseFloat(getComputedStyle(form).paddingBottom) >= footer.getBoundingClientRect().height + 15;
  })).toBeTruthy();
  const box = (await footer.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThanOrEqual(1);
  expect(box.x).toBeGreaterThanOrEqual(viewport.width >= 1024 ? 256 : 0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  for (const button of await footer.getByRole("button").all()) {
    const target = (await button.boundingBox())!;
    expect(target.height).toBeGreaterThanOrEqual(44);
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.x).toBeGreaterThanOrEqual(box.x);
    expect(target.x + target.width).toBeLessThanOrEqual(box.x + box.width);
    expect(await button.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    })).toBeTruthy();
  }
  const fields = page.locator('#vehicle-form input:not([type="hidden"]):visible, #vehicle-form select:visible, #vehicle-form textarea:visible');
  if (await fields.count()) {
    await fields.last().evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
    const field = (await fields.last().boundingBox())!;
    expect(field.y + field.height).toBeLessThanOrEqual(box.y);
  }
}
