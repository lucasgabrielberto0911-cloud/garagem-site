import { test, expect, type Page } from "@playwright/test";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

const sample = samples[0];

async function abrir(page: Page, consent = true) {
  if (consent) await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await page.route("**/fotos/**", route => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#17171A"/></svg>',
  }));
  await page.goto(vehiclePath(sample));
}

test("foto fica em 4:3 e o botão sobre ela abre a tela cheia", async ({ page }) => {
  await abrir(page);
  const quadro = (await page.locator(".gallery-frame").boundingBox())!;
  expect(Math.abs(quadro.width / quadro.height - 4 / 3)).toBeLessThanOrEqual(0.02);

  // A amostra do seed tem uma foto só; com várias, o texto vira "Ver as N fotos" (teste em ficha-cta).
  const botao = page.getByRole("button", { name: "Ampliar foto", exact: true });
  await expect(botao).toBeVisible();
  await botao.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("celular: garantia e vistoria na primeira tela, acima da barra com preço", async ({ page }) => {
  const largura = page.viewportSize()!.width;
  test.skip(largura >= 1024, "só celular");
  // Alturas reais: a menor de cada largura já desconta a barra do navegador.
  const menor = { 320: 568, 390: 664, 430: 740 }[largura]!;
  for (const altura of [menor, page.viewportSize()!.height]) {
    await page.setViewportSize({ width: largura, height: altura });
    await abrir(page);
    const barra = page.locator("[data-vehicle-mobile-bar]");
    const topoBarra = (await barra.locator("[data-mobile-bar-price]").boundingBox())!.y;
    const confianca = (await page.locator(".ficha-mobile-sheet [data-trust-notes]").boundingBox())!;
    expect(confianca.y + confianca.height).toBeLessThanOrEqual(topoBarra);
  }

  const barra = page.locator("[data-vehicle-mobile-bar]");
  await expect(barra.locator("[data-mobile-bar-price]")).toContainText("R$");
  const botao = barra.getByRole("link", { name: /^Chamar no WhatsApp/ });
  await expect(botao).toBeVisible();
  expect(await botao.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);

  // Ficha técnica só traz o que o topo não mostra (motor, portas...): sem dado novo, o bloco some.
  // Quando existe, vem antes dos opcionais.
  const titulos = await page.locator("[data-ficha-page] h2:visible").allTextContents();
  expect(titulos).toContain("Itens e acessórios");
  const ficha = titulos.indexOf("Ficha técnica");
  if (ficha >= 0) expect(ficha).toBeLessThan(titulos.indexOf("Itens e acessórios"));
  // Nada repetido: ano, km, câmbio, combustível e cor aparecem uma vez só no topo.
  const topo = page.locator(".ficha-mobile-sheet");
  await expect(topo.locator("[data-key-fact]").first()).toBeVisible();
  await expect(page.locator("[data-ficha-page] .ficha-spec-grid >> text=/^(Ano|km|Câmbio|Combustível|Cor)$/")).toHaveCount(0);
});

test("computador: aviso de cookies fora da galeria e segundo WhatsApp na coluna direita", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 1024, "só computador");
  for (const [width, height] of [[1024, 768], [1366, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await abrir(page, false);
    const aviso = (await page.locator(".site-consent").boundingBox())!;
    const galeria = (await page.locator("#fotos").boundingBox())!;
    expect(aviso.x).toBeGreaterThanOrEqual(galeria.x + galeria.width);
    const principal = (await page.locator("aside").getByRole("link", { name: "Falar no WhatsApp", exact: true }).boundingBox())!;
    expect(principal.y + principal.height).toBeLessThanOrEqual(aviso.y);
  }
  const segundo = page.locator("aside [data-ficha-second-cta]").getByRole("link", { name: "Tirar dúvidas no WhatsApp", exact: true });
  await expect(segundo).toBeVisible();
  expect(new URL((await segundo.getAttribute("href"))!).hostname).toBe("wa.me");
});

test("textos da ficha têm pelo menos 14px", async ({ page }) => {
  await abrir(page);
  const pequenos = await page.evaluate(() => {
    const raiz = document.querySelector("[data-ficha-page]")!;
    const fora = "[data-similar-vehicles], header, footer, [data-site-footer]";
    const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    const achados: string[] = [];
    while (walker.nextNode()) {
      const texto = walker.currentNode.textContent?.trim();
      const el = walker.currentNode.parentElement;
      if (!texto || !el || el.closest(fora) || el.closest(".sr-only")) continue;
      if (el.getClientRects().length === 0) continue;
      const tamanho = parseFloat(getComputedStyle(el).fontSize);
      if (tamanho < 14) achados.push(`${tamanho}px: ${texto.slice(0, 40)}`);
    }
    return achados;
  });
  expect(pequenos).toEqual([]);
});
