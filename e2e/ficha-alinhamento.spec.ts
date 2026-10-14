import { test, expect } from "@playwright/test";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

for (const sample of [samples[0], { ...samples[0], id: "ce2esold000000000000000001" }]) {
  const vendida = sample.id.startsWith("ce2esold");

  test(`ficha ${vendida ? "vendida" : "disponível"}: margens iguais e alinhamento ao header`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
    await page.route("**/fotos/**", route => route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#17171A"/></svg>',
    }));
    const larguraInicial = page.viewportSize()!.width;
    const larguras = larguraInicial >= 1024 ? [1024, 1280, 1440, 1920] : [larguraInicial];

    for (const width of larguras) {
      await page.setViewportSize({ width, height: page.viewportSize()!.height });
      await page.goto(`${vehiclePath(sample)}?from=%2Festoque`);
      const abas = page.getByRole("navigation", { name: "Seções do anúncio" });
      await expect(abas).toBeVisible();
      // Os similares precisam existir para reproduzir a reserva lateral indevida.
      await expect(page.locator("[data-similar-vehicles] .listing-card-grid")).toHaveCount(1);
      const fotos = page.locator("#fotos");
      const foto = (await fotos.boundingBox())!;
      const nav = (await abas.boundingBox())!;
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

      if (width >= 1024) {
        const header = await page.locator("header > div").first().evaluate(el => {
          const rect = el.getBoundingClientRect();
          const css = getComputedStyle(el);
          return { left: rect.left + parseFloat(css.paddingLeft), right: rect.right - parseFloat(css.paddingRight) };
        });
        const painel = (await page.locator(".ficha-aside").boundingBox())!;
        const breadcrumb = (await page.getByRole("navigation", { name: "Você está aqui" }).boundingBox())!;
        const voltar = (await page.getByRole("link", { name: "Voltar aos resultados" }).boundingBox())!;
        expect(Math.abs(foto.x - (width - painel.x - painel.width))).toBeLessThanOrEqual(1);
        expect(Math.abs(foto.x - header.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(painel.x + painel.width - header.right)).toBeLessThanOrEqual(1);
        for (const bloco of [nav, breadcrumb]) {
          expect(Math.abs(bloco.x - header.left)).toBeLessThanOrEqual(1);
          expect(Math.abs(bloco.x + bloco.width - header.right)).toBeLessThanOrEqual(1);
        }
        expect(Math.abs(voltar.x - header.left)).toBeLessThanOrEqual(1);
      } else {
        expect(Math.abs(foto.x - (width - foto.x - foto.width))).toBeLessThanOrEqual(1);
        expect(nav.x).toBe(0);
        expect(Math.abs(nav.width - width)).toBeLessThanOrEqual(1);
        await expect(page.getByRole("link", { name: "Voltar aos resultados" })).toBeVisible();
      }

      for (const nome of ["Especificações", "Detalhes", "Fotos"]) {
        const link = abas.getByRole("link", { name: nome, exact: true });
        if (!(await link.count())) continue;
        await link.click();
        await expect(link).toHaveAttribute("aria-current", "true");
        const id = (await link.getAttribute("href"))!;
        await expect(page.locator(id)).toBeVisible();
      }
    }
    await page.screenshot({ path: info.outputPath("ficha-alinhada.png"), fullPage: true });
    expect(errors).toEqual([]);
  });
}
