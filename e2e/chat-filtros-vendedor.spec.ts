import { test, expect } from "@playwright/test";
import { runChatTurn } from "../src/lib/chat-turn";
import type { ChatVehicleRecord } from "../src/lib/chat-stock";

const car = (id: string, model: string, price: number, transmission = "Manual"): ChatVehicleRecord => ({
  id, brand: "Fiat", model, price, transmission, yearModel: 2016, version: "1.0", engine: "1.0",
  km: 50000, category: "carro", color: "Branco", fuel: "Flex",
});
const stock = [
  car("weekend", "Palio Weekend", 47900), car("palio", "Palio", 24900), car("gol", "Gol", 32900),
  car("hb", "HB20", 49900, "Automático"), car("fox", "Fox", 45900, "Automático"),
  car("duster", "Duster", 54900, "Automático"), car("lancer", "Lancer", 62900, "Automático"),
  car("city", "City", 69900, "Automático"), car("civic", "Civic", 74900, "Automático"),
  { ...car("cg", "CG 160", 17000), brand: "Honda", category: "moto", engine: "160cc" },
];

test("vendedor mantém filtros, lembra todos os IDs e oferece continuidade sem repetir", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  const payloads: Array<{ shownVehicleIds: string[]; previousVehicleIds: string[]; historico: unknown[]; searchHistory: Array<{ content: string }> }> = [];
  // Usa a regra real de seleção com estoque fixo; o navegador envia o histórico real.
  await page.route("**/api/chat", async route => {
    const body = route.request().postDataJSON();
    payloads.push(body);
    const result = await runChatTurn({ ...body, stock, generate: async () => { throw new Error("Busca determinística"); } });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(result) });
  });
  await page.goto("/estoque");
  await page.getByRole("button", { name: "Ajuda para escolher", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Garagem", exact: true });
  const send = async (question: string) => {
    await dialog.locator("textarea").fill(question);
    await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(dialog).toHaveAttribute("aria-busy", "false");
    return dialog.locator('[data-chat-latest="1"]');
  };

  let answer = await send("Manual de 45 a 50 mil");
  await expect(answer.locator("[data-chat-vehicle]")).toHaveCount(1);
  await expect(answer.getByRole("link", { name: "Fiat Palio Weekend 2016", exact: true })).toBeVisible();
  answer = await send("outro");
  await expect(answer).toContainText("Manual nessa faixa é só esse");
  await expect(answer).toContainText("Mas tenho automáticos nessa faixa");
  await expect(answer.locator("[data-chat-vehicle]")).toHaveCount(2);
  await expect(answer).not.toContainText(/Palio Weekend|Gol|CG 160/);
  answer = await send("outros");
  await expect(answer.locator("[data-chat-vehicle]")).toHaveCount(0);
  await expect(answer).toContainText("Não tenho outras opções próximas sem repetir");
  await expect(answer).toContainText("Quer considerar outro câmbio ou ampliar");
  expect(new Set(payloads[2].shownVehicleIds)).toEqual(new Set(["weekend", "hb", "fox"]));
  expect(new Set(payloads[2].previousVehicleIds)).toEqual(new Set(["hb", "fox"]));

  // A primeira pergunta sai tanto das 12 mensagens da API quanto das 24 salvas na tela.
  for (let index = 0; index < 10; index++) {
    answer = await send("tem mais?");
    await expect(answer.locator("[data-chat-vehicle]")).toHaveCount(0);
    await expect(answer).not.toContainText(/Gol|CG 160|HB20|Fox/);
  }
  expect(payloads.at(-1)?.historico).toHaveLength(12);
  expect(payloads.at(-1)?.searchHistory[0].content).toBe("Manual de 45 a 50 mil");
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("garagem_site_chat_history_v3")?.includes("searchContext"))).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Ajuda para escolher", exact: true }).first().click();
  answer = await send("outros");
  await expect(answer.locator("[data-chat-vehicle]")).toHaveCount(0);
  expect(payloads.at(-1)?.searchHistory[0].content).toBe("Manual de 45 a 50 mil");
  expect(new Set(payloads.at(-1)?.shownVehicleIds)).toEqual(new Set(["weekend", "hb", "fox"]));

  await dialog.getByRole("button", { name: "Nova conversa", exact: true }).click();
  answer = await send("automático até 70 mil");
  const firstIds = await answer.locator("[data-chat-vehicle]").evaluateAll(elements => elements.map(element => element.getAttribute("data-chat-vehicle")));
  expect(payloads.at(-1)?.shownVehicleIds).toEqual([]);
  answer = await send("mais");
  await expect(answer.locator("[data-chat-vehicle]")).toHaveCount(2);
  const nextIds = await answer.locator("[data-chat-vehicle]").evaluateAll(elements => elements.map(element => element.getAttribute("data-chat-vehicle")));
  expect(nextIds.every(id => !firstIds.includes(id))).toBe(true);
  await expect(answer).not.toContainText(/Civic|CG 160/);

  await dialog.getByRole("button", { name: "Nova conversa", exact: true }).click();
  answer = await send("tem moto?");
  await expect(answer.locator('[data-chat-vehicle="cg"]')).toHaveCount(1);
  await expect(answer).toContainText("Honda CG 160");
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});
