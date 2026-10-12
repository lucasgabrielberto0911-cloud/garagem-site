import { test, expect, type Page, type Locator } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { runChatTurn } from "../src/lib/chat-turn";
import { vehiclePath } from "../src/lib/vehicle-slug";
import { toChatVehicleCard } from "../src/lib/chat-cards";
import { findVehicleSpec, specMaxCv } from "../src/lib/chat-specs";
import { CHAT_HELP_LABEL } from "../src/lib/chat-open";
import type { ChatVehicleRecord } from "../src/lib/chat-stock";
import samples from "./public-samples.json";
import tailwindConfig from "../tailwind.config";

const brandHex = (tailwindConfig.theme?.extend?.colors as { brand: { DEFAULT: string } }).brand.DEFAULT;
const brandChannels = brandHex.slice(1).match(/../g)!.map(value => parseInt(value, 16)).join(", ");

const live = process.env.CHAT_QA_LIVE === "1";
const shots = "/workspace/chat-qa/ui/shots";
const stock: ChatVehicleRecord[] = samples.map(sample => ({ ...sample, category: "carro", accessories: ["Ar-condicionado", "Direção hidráulica"], doors: 4 }));
const cases = ["quero um carro forte e econômico", "preciso de um carro espaçoso e barato", "automático e econômico", "SUV para família", "me mostra opções de carro econômico"];
const viewports = [{ width: 320, height: 740 }, { width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1366, height: 900 }, { width: 1440, height: 900 }];

async function openChat(page: Page) {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  if (!live) {
    await page.route("**/api/chat", async route => {
      const { mensagem } = route.request().postDataJSON();
      const result = await runChatTurn({ mensagem, historico: [], stock, readIntent: async () => null, generate: async () => { throw new Error("Caso resolvido com fichas locais"); } });
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(result) });
    });
  }
  await page.goto("/estoque");
  await page.getByRole("button", { name: CHAT_HELP_LABEL, exact: true }).first().click();
  return page.getByRole("dialog", { name: "Garagem", exact: true });
}

async function ask(dialog: Locator, question: string) {
  await dialog.locator("textarea").fill(question);
  const response = dialog.page().waitForResponse(r => new URL(r.url()).pathname === "/api/chat" && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(dialog).toHaveAttribute("aria-busy", "false", { timeout: 90_000 });
  return dialog.locator('[data-chat-latest="1"]');
}

async function formatAcceptance(answer: Locator, expected: number) {
  const cards = answer.locator("[data-chat-vehicle]");
  const blocks = answer.locator("[data-chat-car-block]");
  await expect(cards).toHaveCount(expected);
  await expect(blocks).toHaveCount(expected);
  const firstSentences: string[] = [];
  for (let i = 0; i < expected; i++) {
    const link = blocks.nth(i).locator('a[href^="/estoque/"]');
    await expect(link).toHaveCount(1);
    const name = (await link.innerText()).trim();
    expect(name.length).toBeGreaterThan(0);
    expect(name.length).toBeLessThanOrEqual(40);
    await expect(link).toHaveAttribute("href", (await cards.nth(i).locator('a[href^="/estoque/"]').getAttribute("href"))!);
    const prose = await blocks.nth(i).locator("[data-chat-car-prose]").innerText();
    expect(prose.length).toBeGreaterThanOrEqual(25);
    expect(prose.length).toBeLessThanOrEqual(260);
    expect(prose.split(/[.!?]\s/).length).toBeLessThanOrEqual(2);
    expect(prose).not.toMatch(/R\$|•|—|vale conhecer|equilibrando|\bcom\s+com\b|SUV com|n[aã]o (tem|possui|vem com) ar-condicionado/i);
    firstSentences.push(prose.split(/[.!?]\s/)[0]!);
    const id = await cards.nth(i).getAttribute("data-chat-vehicle");
    const unit = stock.find(v => v.id === id);
    const spec = unit && findVehicleSpec(unit);
    if (spec && (/\b1[.,]0\b/.test(spec.motor) || specMaxCv(spec) < 90)) expect(prose).not.toMatch(/\b\d{2,3}\s*cv\b|cavalos|pot[eê]ncia/i);
    expect(await link.evaluate(el => getComputedStyle(el).fontFamily)).toMatch(/Barlow.*Condensed/i);
  }
  expect(firstSentences[0]).not.toBe(firstSentences[1]);
  expect(firstSentences[0]!.split(/\s+/).slice(0, 2).join(" ")).not.toBe(firstSentences[1]!.split(/\s+/).slice(0, 2).join(" "));
  const stockLink = answer.locator('a[href^="/estoque"]').filter({ hasText: /^Ver (todos|o estoque)/ });
  if (await stockLink.count()) {
    const href = await stockLink.first().getAttribute("href");
    const cap = new URL(href!, "http://localhost").searchParams.get("maxPrice");
    if (cap) {
      for (const card of await cards.all()) {
        const id = await card.getAttribute("data-chat-vehicle");
        const unit = stock.find(v => v.id === id);
        expect(unit!.price).toBeLessThanOrEqual(Number(cap));
      }
    }
  }
  await expect(answer).not.toContainText(/Linhares|simulador|simula[cç][aã]o|parcel|taxa|juros|entrada m[ií]nima|cidade de|faixa de|abaixo de R\$/i);
  const intro = answer.locator("p").first();
  await expect(intro).not.toContainText(/^Separei \d|^Temos (duas|tr[eê]s) [oó]timas/i);
  expect(await intro.evaluate((el) => !!(el.compareDocumentPosition(el.closest('[data-chat-latest]')!.querySelector('[data-chat-car-block]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  expect(await blocks.last().evaluate(el => !!(el.compareDocumentPosition(el.closest('[data-chat-latest]')!.querySelector('[data-chat-vehicle]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
}

async function layoutAcceptance(page: Page, dialog: Locator) {
  const toolbar = dialog.locator("[data-chat-quick-actions]");
  await expect(toolbar).toHaveAttribute("role", "toolbar");
  await expect(toolbar.getByRole("button", { name: "Marcar visita", exact: true })).toHaveCount(1);
  const actions = await toolbar.locator("button, a").allTextContents();
  expect(actions).toEqual(["Marcar visita", "Falar no WhatsApp", "Ver estoque"]);
  const scroll = dialog.locator(".site-chat-scroll");
  const form = dialog.locator("form[data-chat-composer]");
  const t = (await toolbar.boundingBox())!;
  const s = (await scroll.boundingBox())!;
  const f = (await form.boundingBox())!;
  expect(t.y).toBeGreaterThanOrEqual(s.y + s.height - 1);
  expect(t.y + t.height).toBeLessThanOrEqual(f.y + 1);
  expect(t.height + f.height).toBeLessThanOrEqual(150);
  expect((await dialog.locator("header").boundingBox())!.height).toBeLessThanOrEqual(60);
  if (page.viewportSize()!.width === 360) expect(s.height).toBeGreaterThanOrEqual(400);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await toolbar.evaluate(el => getComputedStyle(el).overflowX)).not.toBe("visible");
  await expect(dialog.getByText("Marcar visita", { exact: true })).toHaveCount(1);
  await expect(dialog).not.toContainText(/Parcela, v[ií]deo|Resposta curta|parcela|Linhares/i);
  expect(await dialog.evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(13, 13, 15)");
  expect(await dialog.innerHTML()).not.toMatch(/#101013|#141417/);
  await expect(dialog.locator('[class*="bg-brand-gradient"]')).toHaveCount(1);
  const user = dialog.locator(".bg-brand\\/90").first();
  expect(await user.evaluate(el => getComputedStyle(el).backgroundColor)).toContain(brandChannels);
  await dialog.locator("textarea").fill("teste");
  const send = dialog.getByRole("button", { name: "Enviar", exact: true });
  // Remover o ponteiro antes de medir a cor base.
  await page.mouse.move(0, 0);
  await expect.poll(() => send.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(`rgb(${brandChannels})`);
  await dialog.locator("textarea").fill("");
  for (const card of await dialog.locator('[data-chat-latest="1"] [data-chat-vehicle]').all()) {
    expect((await card.boundingBox())!.height).toBeLessThanOrEqual(page.viewportSize()!.width < 360 ? 112 : 96);
    const thumb = (await card.locator("img").boundingBox())!;
    expect(thumb.width).toBeGreaterThanOrEqual(56);
    expect(thumb.width).toBeLessThanOrEqual(76);
    await expect(card.locator("p")).toContainText(/\b(19|20)\d{2} · [\d.]+ km · R\$\s[\d.]+/);
    const interest = card.getByRole("link", { name: /^Tenho interesse/ });
    await expect(interest).toHaveCount(1);
    expect((await interest.boundingBox())!.height).toBeLessThanOrEqual(40);
    expect(await interest.evaluate(el => parseFloat(getComputedStyle(el, "::before").top))).toBeLessThanOrEqual(-6);
    await expect(card.locator("span.rounded-md")).toHaveCount(0);
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await card.locator("h3").evaluate(el => getComputedStyle(el).fontFamily)).toMatch(/Barlow.*Condensed/i);
  }
  return { viewport: page.viewportSize(), conversa: s.height, rodape: t.height + f.height, header: (await dialog.locator("header").boundingBox())!.height };
}

test.describe("assistente: critérios C da especificação", () => {
  test.beforeEach(async ({ context }) => {
    if (live && process.env.VERCEL_BYPASS) await context.setExtraHTTPHeaders({ "x-vercel-protection-bypass": process.env.VERCEL_BYPASS });
  });
  for (const viewport of viewports) {
    test(`blocos, cards e layout em ${viewport.width}px`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize(viewport);
      const dialog = await openChat(page);
      for (const [index, question] of cases.entries()) {
        if (index) await dialog.getByRole("button", { name: "Nova conversa", exact: true }).click();
        const answer = await ask(dialog, question);
        await formatAcceptance(answer, index === 4 ? 3 : 2);
        const measurement = await layoutAcceptance(page, dialog);
        await expect(dialog.locator("[data-chat-scroll-latest]")).toHaveCount(0);
        if (index === 0) {
          await mkdir(shots, { recursive: true });
          await writeFile(`${shots}/medidas-${viewport.width}.json`, JSON.stringify(measurement, null, 2));
          await page.evaluate(() => document.fonts.ready);
          if (viewport.width === 390 || viewport.width === 1366) await page.screenshot({ path: `${shots}/chat-${viewport.width}x${viewport.height}.png` });
        }
      }
      await dialog.getByRole("button", { name: "Nova conversa", exact: true }).click();
      await expect(dialog.getByText("Vamos encontrar o seu próximo veículo.", { exact: true })).toBeVisible();
      await expect(dialog.locator("[data-chat-vehicle]")).toHaveCount(0);
    });
  }

  test("chips, visita, teclado e links de navegação", async ({ page }) => {
    const dialog = await openChat(page);
    const answer = await ask(dialog, cases[0]!);
    const toolbar = dialog.locator("[data-chat-quick-actions]");
    const visit = toolbar.getByRole("button", { name: "Marcar visita", exact: true });
    await visit.click();
    await expect(visit).toHaveAttribute("aria-expanded", "true");
    const panel = dialog.getByRole("group", { name: "Marcar visita", exact: true });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("id", "chat-visit-panel");
    await expect(panel.getByRole("link", { name: "Enviar pelo WhatsApp" })).toHaveAttribute("aria-disabled", "true");
    await panel.getByLabel("Carro de interesse").fill("Civic 2015");
    await panel.getByLabel("Dúvidas (opcional)").fill("Fotos");
    await panel.getByLabel("Horário desejado").fill("amanhã de manhã");
    await expect(panel.getByRole("link", { name: "Enviar pelo WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\//);
    await panel.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(visit).toHaveAttribute("aria-expanded", "false");
    const whatsapp = toolbar.getByRole("link", { name: "Falar no WhatsApp" });
    await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\//);
    await expect(whatsapp).toHaveAttribute("target", "_blank");
    await expect(whatsapp).toHaveAttribute("rel", /noopener/);
    await expect(toolbar.getByRole("link", { name: "Ver estoque" })).toHaveAttribute("href", "/estoque");
    await page.evaluate(() => document.body.dataset.chatKeyboard = "");
    await expect(toolbar).toBeHidden();
    await page.evaluate(() => delete document.body.dataset.chatKeyboard);
    const href = (await answer.locator("[data-chat-car-block] a").first().getAttribute("href"))!;
    const navigation = page.waitForResponse(r => new URL(r.url()).pathname === href && r.request().isNavigationRequest());
    await answer.locator("[data-chat-car-block] a").first().click();
    expect((await navigation).status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(href + "$"));
  });

  test("interesse mantém eventos Meta e card abre a ficha", async ({ page, context }) => {
    await page.addInitScript(() => {
      localStorage.setItem("garagem_consent", "accepted");
      const events: unknown[][] = [];
      Object.assign(window, { __chatMetaEvents: events, fbq: (...args: unknown[]) => events.push(args) });
    });
    const dialog = await openChat(page);
    await page.evaluate(() => localStorage.setItem("garagem_consent", "accepted"));
    const answer = await ask(dialog, cases[0]!);
    const card = answer.locator("[data-chat-vehicle]").first();
    const id = (await card.getAttribute("data-chat-vehicle"))!;
    const popup = context.waitForEvent("page");
    const interest = card.getByRole("link", { name: /^Tenho interesse/ });
    await expect(interest).toHaveAttribute("href", /^https:\/\/wa\.me\//);
    await expect(interest).toHaveAttribute("target", "_blank");
    await interest.click();
    await (await popup).close();
    const events = await page.evaluate(() => (window as unknown as { __chatMetaEvents: unknown[][] }).__chatMetaEvents);
    for (const name of ["AddToCart", "Lead"]) expect(events.some(args => args[1] === name && (args[2] as { content_type?: string; content_ids?: string[] })?.content_type === "vehicle" && (args[2] as { content_ids?: string[] }).content_ids?.includes(id))).toBe(true);
    const href = (await card.locator('a[href^="/estoque/"]').getAttribute("href"))!;
    await card.locator("img").click({ force: true });
    await expect(page).toHaveURL(new RegExp(href + "$"));
  });

  test("botão flutuante exige rolagem para cima e devolve foco à conversa", async ({ page }) => {
    const dialog = await openChat(page);
    for (let i = 0; i < 3; i++) await ask(dialog, cases[i]!);
    const scroll = dialog.locator(".site-chat-scroll");
    const latest = dialog.getByRole("button", { name: "Ver última resposta", exact: true });
    await expect(latest).toHaveCount(0);
    await scroll.hover();
    await page.mouse.wheel(0, -2000);
    await expect(latest).toBeVisible({ timeout: 300 });
    const box = (await latest.boundingBox())!;
    const area = (await scroll.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(48);
    expect(box.height).toBeLessThanOrEqual(48);
    expect(box.y + box.height).toBeLessThanOrEqual(area.y + area.height - 4);
    expect(await latest.evaluate(el => getComputedStyle(el).position)).toBe("absolute");
    await expect(dialog.getByText("Ver última resposta ↓", { exact: true })).toHaveCount(0);
    await latest.click();
    await expect(latest).toHaveCount(0);
    await expect.poll(() => scroll.evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 4)).toBe(true);
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("TEXTAREA");
  });

  test("stream no fim não faz botão piscar e pode ser interrompido", async ({ page }) => {
    test.skip(live, "Stream controlado usa stub, sem chamada ao provedor");
    const dialog = await openChat(page);
    await page.route("**/api/chat", async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = await runChatTurn({ mensagem: cases[0]!, historico: [], stock, readIntent: async () => null, generate: async () => { throw new Error("Local"); } });
      const frames = [...result.reply].map(char => `event: token\ndata: ${JSON.stringify({ text: char })}\n\n`).join("");
      await route.fulfill({ contentType: "text/event-stream", body: frames + `event: done\ndata: ${JSON.stringify(result)}\n\n` });
    });
    await page.evaluate(() => {
      Object.assign(window, { __latestFlashed: false });
      new MutationObserver(() => { if (document.querySelector("[data-chat-scroll-latest]")) Object.assign(window, { __latestFlashed: true }); }).observe(document.body, { subtree: true, childList: true });
    });
    await dialog.locator("textarea").fill(cases[0]!);
    await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(dialog).toHaveAttribute("aria-busy", "true");
    await expect(dialog.getByRole("button", { name: "Parar resposta" })).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-busy", "false");
    expect(await page.evaluate(() => (window as unknown as { __latestFlashed: boolean }).__latestFlashed)).toBe(false);
    await dialog.locator("textarea").fill("mais detalhes");
    await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
    await dialog.getByRole("button", { name: "Parar resposta" }).click();
    await expect(dialog).toHaveAttribute("aria-busy", "false");
  });

  test("vendido sem preço e motor 1.0 sem cv no bloco", async ({ page }) => {
    test.skip(live, "Fixtures isoladas do estoque publicado");
    const dialog = await openChat(page);
    const one = { ...stock[0]!, id: "ce2esold000000000000000001" };
    const sold = { ...toChatVehicleCard(one), price: 0, sold: true };
    const small = { ...stock[1]!, id: "small", brand: "Fiat", model: "Mobi", version: "Like 1.0", engine: "1.0", yearModel: 2024, transmission: "Manual" };
    const smallResult = await runChatTurn({ mensagem: cases[0]!, historico: [], stock: [small], readIntent: async () => null, generate: async () => { throw new Error("Local"); } });
    await page.route("**/api/chat", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: `Este já foi vendido.\n• **[Honda Civic 2015](${vehiclePath(one)})** — O consultor ajuda a encontrar uma unidade parecida.\n${smallResult.reply.split("\n").find(line => line.startsWith("•"))}`, vehicles: [sold, ...smallResult.vehicles] }) }));
    const answer = await ask(dialog, "quero estas unidades");
    await expect(answer.locator(`[data-chat-vehicle="${one.id}"]`)).not.toContainText(/R\$/);
    await expect(answer.locator("[data-chat-car-block]").last()).not.toContainText(/cv|cavalos|pot[eê]ncia/i);
  });
});
