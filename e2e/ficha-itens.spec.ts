import { test, expect } from "@playwright/test";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

const civic = samples[0];
const hrv = samples[2];

async function chips(page: import("@playwright/test").Page, sample: typeof civic) {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await page.goto(vehiclePath(sample));
  // No celular a lista mostra os primeiros itens; "Ver todos" expande.
  const verTodos = page.getByRole("button", { name: /^Ver todos os \d+ opcionais$/ });
  if (await verTodos.count()) await verTodos.click();
  const list = page.locator("[data-accessory-chips]:visible");
  await expect(list).toHaveCount(1);
  return list;
}

test("itens da ficha viram chips com ícone, sem estourar a tela", async ({ page }) => {
  const list = await chips(page, hrv);
  const items = list.locator("[data-accessory-chip]");
  await expect(items).toHaveCount(19);
  await expect(items.first().locator("svg")).toBeVisible();
  await expect(list).toContainText("Item personalizado do anúncio");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const boxes = await items.evaluateAll(els => els.map(el => el.getBoundingClientRect()).map(r => ({ x: r.x, right: r.right, y: Math.round(r.y) })));
  const parent = await list.evaluate(el => el.getBoundingClientRect().right);
  for (const box of boxes) expect(box.right).toBeLessThanOrEqual(parent + 1);
  // Última linha preenchida: nenhum chip final fica sozinho com vazio ao lado.
  const lastY = boxes[boxes.length - 1].y;
  const lastRow = boxes.filter(box => box.y === lastY);
  const listBox = await list.boundingBox();
  expect(Math.max(...lastRow.map(box => box.right))).toBeGreaterThanOrEqual(listBox!.x + listBox!.width - 2);
});

test("ficha com poucos itens também fecha a última linha", async ({ page }) => {
  const list = await chips(page, civic);
  const items = list.locator("[data-accessory-chip]");
  await expect(items).toHaveCount(3);
  const boxes = await items.evaluateAll(els => els.map(el => el.getBoundingClientRect()).map(r => ({ right: r.right, y: Math.round(r.y) })));
  const listBox = await list.boundingBox();
  const lastY = boxes[2].y;
  expect(Math.max(...boxes.filter(box => box.y === lastY).map(box => box.right))).toBeGreaterThanOrEqual(listBox!.x + listBox!.width - 2);
});

test("ícones dos opcionais: só o item personalizado cai no check genérico", async ({ page }) => {
  const list = await chips(page, hrv);
  const checks = list.locator('[data-accessory-chip] svg path[d="m5 12.5 4.5 4.5L19 7.5"]');
  await expect(checks).toHaveCount(1);
  await expect(list.locator("[data-accessory-chip]").filter({ hasText: "Item personalizado" }).locator("svg path[d='m5 12.5 4.5 4.5L19 7.5']")).toHaveCount(1);
  // Cada tipo de item tem um desenho diferente (sem repetir o mesmo ícone em tudo).
  const desenhos = await list.locator("[data-accessory-chip] svg").evaluateAll((els) => new Set(els.map((el) => el.innerHTML)).size);
  expect(desenhos).toBeGreaterThanOrEqual(15);
});

test("desktop: ficha técnica e opcionais na coluna principal, card só com o essencial", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Layout exclusivo do computador");
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await page.goto(vehiclePath(hrv));
  const aside = page.locator("[data-ficha-page] aside");
  await expect(aside).toBeVisible();

  // A grade de specs fica fora do card, sempre aberta abaixo das fotos, com a ficha completa.
  await expect(aside.locator("[data-ficha-spec-grid]")).toHaveCount(0);
  const specs = page.locator("[data-ficha-spec-grid]");
  await expect(specs).toBeVisible();
  const [fotos, grade, painel] = await Promise.all([
    page.locator("#fotos").boundingBox(),
    specs.boundingBox(),
    aside.boundingBox(),
  ]);
  expect(grade!.y).toBeGreaterThan(fotos!.y + fotos!.height - 1);
  expect(grade!.x + grade!.width).toBeLessThanOrEqual(painel!.x);
  await expect(page.locator("details", { has: specs })).toHaveCount(0);
  await expect(specs.locator("dt")).toContainText(["Ano", "km", "Câmbio", "Combustível", "Cor"]);

  // Topo do card: preço em vermelho e quadradinhos de cor, ano e KM.
  const preco = aside.locator("[data-ficha-price]");
  await expect(preco).toContainText("R$");
  const corPreco = await preco.evaluate((el) => getComputedStyle(el).color.match(/\d+/g)!.map(Number));
  expect(corPreco[0]).toBeGreaterThan(200);
  expect(corPreco[1]).toBeLessThan(100);
  const fatos = aside.locator("[data-key-facts] dt");
  await expect(fatos).toHaveText(["Cor", "Ano", "KM"]);

  // Card: um único botão principal; financiamento, troca, vídeo e visita recolhidos.
  const principal = aside.getByRole("link", { name: "Falar no WhatsApp", exact: true });
  await expect(principal).toBeVisible();
  const financiamento = aside.getByRole("link", { name: /financiamento deste veículo/ });
  await expect(financiamento).toBeHidden();
  await aside.locator("[data-ficha-more-actions] summary").click();
  await expect(financiamento).toBeVisible();
  const [bp, bf] = await Promise.all([principal.boundingBox(), financiamento.boundingBox()]);
  expect(bp!.height).toBeGreaterThan(bf!.height);
  await expect(aside.getByText("Garantia de 3 meses")).toBeVisible();
  await expect(aside.getByText("Vistoria da loja", { exact: true })).toBeVisible();
  await expect(aside.getByText("Linhares/ES", { exact: true })).toBeVisible();
  await expect(aside).not.toContainText(/parcela|simul/i);
  await expect(aside.getByRole("button", { name: "Copiar link do anúncio" })).toHaveCount(0);

  // O selo "19 opcionais" do card leva à lista na coluna principal.
  const atalho = aside.getByRole("link", { name: "19 opcionais", exact: true });
  await expect(atalho).toBeVisible();
  await atalho.click();
  await expect(page.locator("#opcionais-desktop")).toBeInViewport();

  // Clicar num opcional depois de usar as abas não rola a página para cima.
  await page.getByRole("navigation", { name: "Seções do anúncio" }).getByRole("link", { name: "Detalhes", exact: true }).click();
  const chip = page.locator("#opcionais-desktop [data-accessory-chip]").last();
  await chip.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const antes = await page.evaluate(() => scrollY);
  await chip.click();
  await page.waitForTimeout(400);
  expect(Math.abs((await page.evaluate(() => scrollY)) - antes)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
