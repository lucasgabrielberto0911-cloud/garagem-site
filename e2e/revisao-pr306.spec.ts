import { test, expect } from "@playwright/test";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

test.use({ deviceScaleFactor: 3 });
test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("ficha disponível e vendida têm um H1 acessível em qualquer viewport", async ({ page }) => {
  for (const vehicle of [samples[0], { ...samples[0], id: "ce2esold000000000000000001" }]) {
    await page.goto(vehiclePath(vehicle));
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Civic/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("cards mantêm uma capa prioritária e as seguintes em lazy loading", async ({ page }) => {
  for (const path of ["/", "/estoque"]) {
    await page.goto(path);
    const covers = page.locator("article.listing-card img");
    await expect(covers.first()).toHaveAttribute("fetchpriority", "high");
    await expect(covers.first()).toHaveAttribute("loading", "eager");
    await expect(covers.nth(1)).toHaveAttribute("fetchpriority", "low");
    await expect(covers.nth(1)).toHaveAttribute("loading", "lazy");
    await expect(page.locator('article.listing-card img[fetchpriority="high"]')).toHaveCount(1);
    if (page.viewportSize()!.width < 640) {
      const source = page.locator('article.listing-card source[media="(max-width: 639px)"]').first();
      await expect(source).toHaveAttribute("srcset", /480w$/);
      await expect(source).not.toHaveAttribute("srcset", /720w|960w/);
      await expect.poll(() => covers.first().evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/-card\.webp|480x360/);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("barra móvel: tocar nas bordas mantém a ação de cada botão", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("mobile"), "Barra exclusiva do celular");
  await page.goto(vehiclePath(samples[0]));
  const bar = page.locator("[data-vehicle-mobile-bar]");
  const interest = bar.getByRole("link", { name: /^Tenho interesse/ });
  const visit = bar.getByRole("link", { name: /^Agendar visita/ });
  await expect(interest).toBeVisible();
  await expect(visit).toBeVisible();
  // Registra o alvo real sem abrir o WhatsApp nem enviar leads de teste.
  await page.evaluate(() => {
    document.addEventListener("click", event => {
      const link = (event.target as Element).closest("[data-vehicle-mobile-bar] a");
      if (!link) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      document.body.dataset.ultimoAlvo = link.getAttribute("aria-label") ?? "";
    }, true);
  });
  const interestBox = (await interest.boundingBox())!;
  const visitBox = (await visit.boundingBox())!;
  expect(interestBox.height).toBeGreaterThanOrEqual(44);
  expect(visitBox.height).toBeGreaterThanOrEqual(44);
  expect(visitBox.y - interestBox.y - interestBox.height).toBeGreaterThanOrEqual(2);
  for (const link of [interest, visit]) {
    const box = (await link.boundingBox())!;
    const label = (await link.getAttribute("aria-label"))!;
    for (const [x, y] of [
      [box.x + box.width / 2, box.y + 1],
      [box.x + box.width / 2, box.y + box.height - 1],
      [box.x + 1, box.y + box.height / 2],
      [box.x + box.width - 1, box.y + box.height / 2],
      [box.x + 1, box.y + 1],
      [box.x + box.width - 1, box.y + 1],
      [box.x + 1, box.y + box.height - 1],
      [box.x + box.width - 1, box.y + box.height - 1],
    ]) {
      await page.locator("body").evaluate(element => delete element.dataset.ultimoAlvo);
      await page.touchscreen.tap(x, y);
      await expect(page.locator("body")).toHaveAttribute("data-ultimo-alvo", label);
    }
  }
  await page.locator("body").evaluate(element => delete element.dataset.ultimoAlvo);
  await page.mouse.click(visitBox.x + visitBox.width / 2, visitBox.y - 1);
  await expect(page.locator("body")).not.toHaveAttribute("data-ultimo-alvo");
});
