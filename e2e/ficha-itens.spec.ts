import { test, expect } from "@playwright/test";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

const civic = samples[0];
const hrv = samples[2];

async function chips(page: import("@playwright/test").Page, sample: typeof civic) {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await page.goto(vehiclePath(sample));
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
