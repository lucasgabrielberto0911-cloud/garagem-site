import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  const image = readFileSync("public/branding/placeholder-car.png");
  await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", body: image }));
  await page.route("https://**.supabase.co/**", route => route.abort());
});

for (const [sample, count] of [[samples[0], 3], [samples[2], 19]] as const) {
  test(`Sobre o veículo destaca a descrição do ${sample.model} sem alterar acessórios`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(vehiclePath(sample));
    await page.evaluate(() => document.fonts.ready);

    const details = page.locator('[data-ficha-section="detalhes"]:visible');
    await expect(details).toContainText("Sobre o veículo");
    const description = details.locator(".border-l-2");
    await expect(description).toHaveCount(1);
    await expect(description).toHaveCSS("border-left-width", "2px");
    await expect(description).toHaveCSS("border-left-style", "solid");
    await expect(description).toHaveCSS("border-left-color", "rgba(217, 21, 25, 0.8)");
    await expect(description).toHaveCSS("padding-left", "12px");
    await expect(description).toHaveCSS("font-family", /Inter/);
    const heading = details.locator("h2, summary").first();
    await expect(heading).toHaveCSS("font-family", /Sora/);

    const accessories = page.locator("[data-accessory-chips]:visible");
    await expect(accessories.locator("[data-accessory-chip]")).toHaveCount(count);
    await expect(accessories).toHaveCSS("border-left-width", "0px");
    await expect(accessories.locator("..")).toHaveCSS("border-left-width", "0px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await details.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.screenshot({ path: info.outputPath("sobre-destaque.png") });
    expect(errors).toEqual([]);
  });
}
