import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatBubbleBody } from "../components/site/ChatBubbleBody";
import { combinedChatRanking } from "./chat-multicriterio";
import { vehiclePath } from "./vehicle-slug";
import { toChatVehicleCard } from "./chat-cards";
import { searchChatInventory, type ChatVehicleRecord } from "./chat-stock";
import { runChatTurn, formatChatResult } from "./chat-turn";
import { findVehicleSpec, specMaxCv, specCityKmL } from "./chat-specs";

const car = (id: string, brand: string, model: string, version: string, yearModel: number, price: number, transmission = "Automático"): ChatVehicleRecord =>
  ({ id, brand, model, version, yearModel, price, transmission, km: 80000, color: "Prata", fuel: "Flex", category: "carro" });
const stock = [
  car("c", "Honda", "Civic", "LXR 2.0", 2015, 79000),
  car("h", "Hyundai", "HB20", "1.6", 2015, 55000),
  car("m", "Fiat", "Mobi", "Like 1.0", 2024, 57000, "Manual"),
  car("k", "Nissan", "Kicks", "SL 1.6", 2019, 86000),
];
for (const question of ["quero um carro forte e economico", "carro potente que gaste pouco", "espaçoso e barato", "automático econômico"]) {
  test(question + ": critérios preservados até a resposta e os cards", async () => {
    const found = searchChatInventory(question, stock)!;
    assert.ok(found);
    assert.equal(found.picks.length, 2);
    assert.match(found.reply, /• \*\*\[/);
    assert.doesNotMatch(found.reply, /Mais fortes|Linhares|taxa|parcela/i);
    if (/econom|econôm|gaste/.test(question)) assert.match(found.reply, /km\/l/);
    if (/espaçoso/.test(question)) { assert.match(found.reply, /porta-malas/); assert.doesNotMatch(found.reply, /R\$/); }
    if (/automático/.test(question)) assert.ok(found.picks.every(v => v.transmission === "Automático"));
    const result = await runChatTurn({ mensagem: question, historico: [], stock, readIntent: async () => null, generate: async () => { throw new Error("Busca deve resolver os critérios"); } });
    assert.doesNotMatch(result.reply, /equilibrando|vale conhecer|R\$/);
    assert.equal(result.vehicles.length, 2);
    assert.equal(result.reply.split("\n").filter(line => line.startsWith("• **[")).length, 2);
  });
}
test("ranking é a soma normalizada de potência e consumo, não só potência", () => {
  const pool = stock.filter(v => findVehicleSpec(v));
  const powers = pool.map(v => specMaxCv(findVehicleSpec(v)!));
  const consumption = pool.map(v => specCityKmL(findVehicleSpec(v)!)!);
  const norm = (n: number, values: number[]) => (n - Math.min(...values)) / (Math.max(...values) - Math.min(...values));
  const expected = [...pool].sort((a,b) => {
    const score = (v: ChatVehicleRecord) => norm(specMaxCv(findVehicleSpec(v)!), powers) + norm(specCityKmL(findVehicleSpec(v)!)!, consumption);
    return score(b) - score(a) || a.price - b.price;
  });
  assert.deepEqual(combinedChatRanking(pool, "forte e econômico")!.picks.map(v => v.id), expected.slice(0,2).map(v => v.id));
});
test("ranking de força no estoque mantém motor 1.0 elegível sem divulgar cv", async () => {
  const turbo = car("turbo", "Hyundai", "HB20S", "1.0 TGDI", 2020, 70000);
  const aspirado = car("aspirado", "Nissan", "Kicks", "SL 1.6", 2019, 55000);
  const result = await runChatTurn({
    mensagem: "qual automático mais forte do estoque até 80 mil?", historico: [], stock: [aspirado, turbo],
    readIntent: async () => null, generate: async () => { throw new Error("Ranking pela ficha"); },
  });
  assert.deepEqual(result.vehicles.map(v => v.id), [turbo.id, aspirado.id]);
  const rows = result.reply.split("\n").filter(line => line.startsWith("• **["));
  assert.equal(rows.length, 2);
  assert.doesNotMatch(rows[0]!, /\bcv\b|cavalos|potência/i);
  assert.match(rows[1]!, /114 cv/);
});
test("ranking de consumo dos cards respeita teto explícito e teto do follow-up", async () => {
  const pool = [stock[0]!, stock[1]!, {...stock[2]!, transmission: "Automático"}];
  for (const mensagem of ["qual desses é o mais econômico?", "qual desses é o mais econômico até 60 mil?"]) {
    const result = await runChatTurn({
      mensagem, historico: [{role: "user", content: "automático até 60 mil"}], stock: pool,
      previousVehicleIds: pool.map(v => v.id), readIntent: async () => null,
      generate: async () => { throw new Error("Ranking pela ficha"); },
    });
    assert.deepEqual(result.vehicles.map(v => v.id), [stock[1]!.id]);
    assert.ok(result.vehicles.every(v => v.price <= 60000 && v.transmission === "Automático"));
    assert.doesNotMatch(result.reply, /Civic|Mobi/);
  }
});
test("motor 1.0 não divulga cv e ficha ausente não inventa consumo", () => {
  assert.doesNotMatch(combinedChatRanking([stock[2]!], "forte e econômico")!.reply, /\bcv\b/);
  const unknown = {...stock[0]!, model: "Desconhecido", version: null};
  assert.match(combinedChatRanking([unknown], "forte e econômico")!.reply, /consumo na ficha/);
  assert.doesNotMatch(combinedChatRanking([unknown], "forte e econômico")!.reply, /km\/l|\bcv\b/);
});
test("bolha renderiza links simples, negrito, inline e streaming com segurança", () => {
  for (const text of ["• [Civic](/estoque/civic) — bom para viajar", "• **[Civic](/estoque/civic)** — bom", "• [**Civic**](/estoque/civic) — bom", "Conheça [Civic](/estoque/civic)."]) {
    const html = renderToStaticMarkup(createElement(ChatBubbleBody, {text}));
    assert.match(html, /<a[^>]+href="\/estoque\/civic"/);
    assert.doesNotMatch(html, /\]\(/);
  }
  for (const text of ["• **[Civic](/estoque/civ", "[Clique](javascript:alert)", "[Clique](https://evil.test)"]) {
    const html = renderToStaticMarkup(createElement(ChatBubbleBody, {text}));
    assert.doesNotMatch(html, /\]\(|href=/);
  }
});

test("opções explícitas usam três blocos completos, variados e sem preço", async () => {
  const result = await runChatTurn({ mensagem: "me mostra opções de carro econômico", historico: [], stock, readIntent: async () => null, generate: async () => { throw new Error("Busca local"); } });
  assert.equal(result.vehicles.length, 3);
  const rows = result.reply.split("\n").filter(line => line.startsWith("• **["));
  assert.equal(rows.length, 3);
  for (const [index, row] of rows.entries()) {
    assert.ok(row.includes(result.vehicles[index]!.href));
    const prose = row.split(" — ")[1]!;
    assert.ok(prose.length >= 25 && prose.length <= 260);
    assert.ok(prose.split(/(?<=[.!?])\s/).length <= 2);
    assert.doesNotMatch(prose, /R\$|Linhares|cidade de|simulador|parcela|taxa|vale conhecer|equilibrando/i);
  }
  assert.notEqual(rows[0]!.split(" — ")[1]!.split(/\.\s/)[0], rows[1]!.split(" — ")[1]!.split(/\.\s/)[0]);
});

test("nome e prosa são blocos distintos sem bullet ou travessão visíveis", () => {
  const text = "Olha estas opções.\n• **[Honda Civic 2015](/estoque/civic)** — Motor da ficha. Câmbio automático.\n• **[Hyundai HB20 2015](/estoque/hb20)** — Consumo da ficha. Tem ar-condicionado.\n\nOs números variam conforme o uso.";
  const html = renderToStaticMarkup(createElement(ChatBubbleBody, { text }));
  assert.equal((html.match(/data-chat-car-block=""/g) ?? []).length, 2);
  assert.match(html, /data-chat-car-prose/);
  assert.doesNotMatch(html, /•|—|\*\*|data-chat-rank-list/);
  assert.match(html, /font-display/);
  const rank = renderToStaticMarkup(createElement(ChatBubbleBody, { text: "• Civic EXL 2020 — 155 cv\n• Fit 2019 — automático" }));
  assert.match(rank, /data-chat-rank-list/);
});

test("polimento mantém os três blocos longos e o fechamento", async () => {
  const { polishChatReplyWithCards, toChatVehicleCard } = await import("./chat-cards");
  const picks = stock.slice(0, 3);
  const text = "Olha estes três.\n" + picks.map(v => `• **[${v.model}](${toChatVehicleCard(v).href})** — ${"Uma frase concreta da ficha. ".repeat(9)}`).join("\n");
  const polished = polishChatReplyWithCards(text, picks.map(toChatVehicleCard));
  assert.equal((polished.match(/• \*\*\[/g) ?? []).length, 3);
});

test("LLM: cards seguem apenas links reais, sem duplicatas ou blocos excedentes", () => {
  const cards = stock.map(v => ({ ...v }));
  const input = { mensagem: "quero sugestões para a rotina", historico: [], stock };
  const paths = stock.map(v => vehiclePath(v));
  const reply = "Olha estas sugestões.\n" + [2, 0, 3, 1].map(i => `• **[${stock[i]!.model}](${paths[i]})** — Câmbio ${stock[i]!.transmission.toLowerCase()}, pra acompanhar sua rotina.`).join("\n") + `\n• **[Inventado](/estoque/inventado)** — Dado inventado.\n• **[Duplicado](${paths[2]})** — Não repetir esta unidade.`;
  const result = formatChatResult({ reply, vehicles: stock.map(toChatVehicleCard), leadCreated: false, stockHref: null }, input, cards);
  assert.deepEqual(result.vehicles.map(v => v.id), [stock[2]!.id, stock[0]!.id]);
  const rows = result.reply.split("\n").filter(line => line.startsWith("•"));
  assert.equal(rows.length, 2);
  rows.forEach((row, index) => assert.ok(row.includes(result.vehicles[index]!.href)));
  assert.doesNotMatch(result.reply, /Inventado|Duplicado/);
});

test("LLM: protege motor 1.0 e preço, preservando só o carro linkado", () => {
  const v = stock[2]!;
  const reply = `Olha este.\n• **[Mobi](${vehiclePath(v)})** — Tem 74 cv e potência pra estrada. Custa R$ 57.000.`;
  const result = formatChatResult({ reply, vehicles: stock.map(toChatVehicleCard), leadCreated: false, stockHref: null }, { mensagem: "forte e econômico", historico: [], stock }, stock);
  assert.equal(result.vehicles.length, 1);
  assert.equal(result.vehicles[0]!.id, v.id);
  assert.doesNotMatch(result.reply, /\bcv\b|potência|R\$/);
  assert.match(result.reply, /km\/l/);
});

test("um resultado de busca tem bloco e card, sem preço na prosa", async () => {
  const result = await runChatTurn({ mensagem: "automático até 100 mil", historico: [], stock: [stock[0]!], readIntent: async () => null, generate: async () => { throw new Error("Local"); } });
  assert.equal(result.vehicles.length, 1);
  const rows = result.reply.split("\n").filter(line => line.startsWith("•"));
  assert.equal(rows.length, 1);
  assert.doesNotMatch(rows[0]!, /R\$/);
});

test("LLM: troca abertura de contagem e faixa de preço não solicitada", () => {
  const picks = stock.slice(0, 2);
  for (const intro of ["Separei 2 ótimas opções.", "Temos duas ótimas opções.", "Equilibrando tudo para você.", "Carros até R$ 100.000."]) {
    const reply = intro + "\n" + picks.map(v => `• **[${v.model}](${vehiclePath(v)})** — Câmbio automático, pra acompanhar sua rotina.`).join("\n");
    const result = formatChatResult({ reply, vehicles: picks.map(toChatVehicleCard), leadCreated: false, stockHref: null }, { mensagem: "quero um carro", historico: [], stock }, picks);
    assert.doesNotMatch(result.reply, /Separei 2|Temos duas ótimas|Equilibrando|R\$/);
    assert.equal((result.reply.match(/• \*\*\[/g) ?? []).length, 2);
  }
});
