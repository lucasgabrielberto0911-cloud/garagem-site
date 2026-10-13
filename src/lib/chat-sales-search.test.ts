import assert from "node:assert/strict";
import test from "node:test";
import type { ChatTurn } from "./chat-gemini";
import { runChatTurn } from "./chat-turn";
import { scopeChatMessage, formatChatWaitlistQuery, similarAfterEmptyFilter, type ChatVehicleRecord } from "./chat-stock";
import { parsePriceLimit } from "./chat-prompt";
import { asksForMoreChatVehicles, parseChatSearchRanges } from "./chat-search-filters";

const car = (id: string, model: string, price: number, transmission = "Manual", yearModel = 2016): ChatVehicleRecord => ({
  id, brand: "Fiat", model, price, transmission, yearModel, version: "1.0", engine: "1.0", km: 50000,
  category: "carro", color: "Branco", fuel: "Flex",
});
const stock = [
  car("weekend", "Palio Weekend", 47900), car("palio", "Palio", 24900, "Manual", 2008),
  car("gol", "Gol", 32900, "Manual", 2012), car("hb", "HB20", 49900, "Automático"),
  car("fox", "Fox", 45900, "Automático"), car("duster", "Duster", 54900, "Automático"),
  car("lancer", "Lancer", 62900, "Automático"), car("city", "City", 69900, "Automático"),
  car("civic", "Civic", 74900, "Automático"),
  { ...car("cg", "CG 160", 17000), brand: "Honda", category: "moto", engine: "160cc" },
];
const generate = async () => { throw new Error("Essa busca deve ser resolvida com o estoque real."); };

test("Manual de 45 a 50 mil → outro → outros mantém faixa, oferece automáticos e esgota sem repetir", async () => {
  const historico: ChatTurn[] = [];
  const seen = new Set<string>();
  for (const mensagem of ["Manual de 45 a 50 mil", "outro", "outros"]) {
    const result = await runChatTurn({ mensagem, historico, stock, generate });
    assert.ok(result.vehicles.every(vehicle => vehicle.category !== "moto" && vehicle.price >= 45000 && vehicle.price <= 50000));
    for (const vehicle of result.vehicles) {
      assert.ok(!seen.has(vehicle.id), `Repetiu ${vehicle.id} na resposta a ${mensagem}`);
      seen.add(vehicle.id);
      assert.ok(result.reply.includes(vehicle.href), "O nome do veículo precisa ser clicável");
    }
    assert.match(result.reply.trim(), /\?$/);
    assert.doesNotMatch(result.reply, /CG 160|Palio 2008|Gol 2012|cv\b|simulador|Linhares|consignado/);
    if (mensagem === "Manual de 45 a 50 mil") assert.deepEqual(result.vehicles.map(v => v.id), ["weekend"]);
    if (mensagem === "outro") {
      assert.match(result.reply, /Manual nessa faixa é só esse.*Mas tenho automáticos nessa faixa/s);
      assert.deepEqual(new Set(result.vehicles.map(v => v.id)), new Set(["hb", "fox"]));
    }
    if (mensagem === "outros") {
      assert.equal(result.vehicles.length, 0);
      assert.match(result.reply, /Não tenho outras opções.*Quer considerar outro câmbio ou ampliar/s);
      assert.match(result.reply, /faixa de R\$ 45\.000 a R\$ 50\.000\?$/);
    }
    historico.push({ role: "user", content: mensagem }, { role: "assistant", content: result.reply });
  }
});

test("automático até 70 mil → mais mantém câmbio e teto sem repetir", async () => {
  const first = await runChatTurn({ mensagem: "automático até 70 mil", historico: [], stock, generate });
  const next = await runChatTurn({ mensagem: "mais", stock, generate, historico: [
    { role: "user", content: "automático até 70 mil" }, { role: "assistant", content: first.reply },
  ] });
  assert.equal(first.vehicles.length, 3);
  assert.equal(next.vehicles.length, 2);
  assert.ok(next.vehicles.every(v => v.transmission === "Automático" && v.price <= 70000 && v.category === "carro"));
  assert.ok(next.vehicles.every(v => !first.vehicles.some(previous => previous.id === v.id)));
  assert.match(next.reply, /\?/);
});

test("tem moto? libera motos e tem mais continua buscando motos", async () => {
  const first = await runChatTurn({ mensagem: "tem moto?", historico: [], stock, generate });
  assert.deepEqual(first.vehicles.map(v => v.id), ["cg"]);
  assert.match(first.reply.trim(), /\?$/);
  const next = await runChatTurn({ mensagem: "tem mais", stock, generate, historico: [
    { role: "user", content: "tem moto?" }, { role: "assistant", content: first.reply },
  ] });
  assert.equal(next.vehicles.length, 0);
  assert.match(next.reply, /Já te mostrei|só esse/);
  assert.match(next.reply, /\?/);
});

test("mais após esgotar automáticos não troca por manual mesmo dentro do orçamento", async () => {
  const estoque = stock.filter(v => ["weekend", "duster", "civic"].includes(v.id));
  const primeira = await runChatTurn({ mensagem: "automático até 70 mil", historico: [], stock: estoque, generate });
  assert.deepEqual(primeira.vehicles.map(v => v.id), ["duster"]);
  const proxima = await runChatTurn({ mensagem: "mais", stock: estoque, generate, previousVehicleIds: ["duster"], historico: [
    { role: "user", content: "automático até 70 mil" }, { role: "assistant", content: primeira.reply },
  ] });
  assert.deepEqual(proxima.vehicles, []);
  assert.match(proxima.reply, /Automático nessa faixa é só esse/);
  assert.match(proxima.reply.trim(), /\?$/);
});

test("sem veículos na faixa não usa fallback acima do teto ou abaixo do piso", async () => {
  const foraDaFaixa = stock.filter(v => v.price < 45000 || v.price > 50000);
  const result = await runChatTurn({ mensagem: "Manual de 45 a 50 mil", historico: [], stock: foraDaFaixa, generate });
  assert.deepEqual(result.vehicles, []);
  assert.match(result.reply, /manual de R\$ 45\.000 a R\$ 50\.000/);
  assert.match(result.reply.trim(), /\?$/);
  assert.deepEqual(similarAfterEmptyFilter("manual de 45 a 50 mil", foraDaFaixa), []);
  assert.equal(formatChatWaitlistQuery("manual de 45 a 50 mil"), "manual de R$ 45.000 a R$ 50.000");
});

test("sem motos informa ausência, sem mostrar carros e com convite final", async () => {
  const result = await runChatTurn({ mensagem: "tem moto?", historico: [], stock: stock.filter(v => v.category !== "moto"), generate });
  assert.deepEqual(result.vehicles, []);
  assert.match(result.reply, /moto.*ainda não tem anúncio/);
  assert.match(result.reply.trim(), /\?$/);
});

test("convite fecha políticas, comparações e respostas geradas após o polimento", async () => {
  for (const mensagem of ["aceita troca?", "qual a garantia?", "Kicks ou Civic?", "quero um carro para viajar"]) {
    const chunks: string[] = [];
    const result = await runChatTurn({ mensagem, historico: [], stock, readIntent: async () => null,
      generate: async () => ({ text: "Posso te ajudar a escolher pelo uso no dia a dia.", finishReason: "STOP" }),
      onToken: text => chunks.push(text),
    });
    assert.match(result.reply.trim(), /\?$/, mensagem);
    assert.equal(chunks.join(""), result.reply);
  }
});

test("follow-ups preservam faixa mínima, máxima e carroceria através de perguntas intermediárias", () => {
  for (const mensagem of ["outro", "Outros!", "mais", "tem mais?", "outras opções", "mostra mais"]) {
    assert.equal(asksForMoreChatVehicles(mensagem), true);
    const scoped = scopeChatMessage(mensagem, [
      { role: "user", content: "SUV manual de 45 a 50 mil" },
      { role: "assistant", content: "Veja essas opções." },
      { role: "user", content: "aceita troca?" },
    ], stock);
    assert.equal(parsePriceLimit(scoped), 50000);
    assert.equal(parseChatSearchRanges(scoped).minPrice, 45000);
    assert.match(scoped, /manual/);
    assert.match(scoped, /suv/i);
  }
  for (const mensagem of ["qual desses é mais novo?", "tem mais fotos?", "outro câmbio", "mais barato", "o outro tem ar?"]) {
    assert.equal(asksForMoreChatVehicles(mensagem), false);
  }
});

test("IDs de todas as sugestões impedem repetir mesmo quando os links saem do histórico", async () => {
  const first = await runChatTurn({ mensagem: "automático até 70 mil", historico: [], stock, generate });
  const result = await runChatTurn({ mensagem: "mais", stock, generate, shownVehicleIds: first.vehicles.map(v => v.id), historico: [
    { role: "user", content: "automático até 70 mil" }, { role: "assistant", content: "Vamos continuar." },
  ] });
  assert.ok(result.vehicles.length > 0);
  assert.ok(result.vehicles.every(v => !first.vehicles.some(previous => previous.id === v.id)));
});

test("mais preserva os filtros mesmo após a primeira pergunta sair das últimas 12 mensagens", async () => {
  const result = await runChatTurn({
    mensagem: "mais", stock, generate,
    historico: Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: index % 2 ? "Quer continuar?" : "outros" })),
    searchHistory: [{ role: "user", content: "Manual de 45 a 50 mil" }, { role: "user", content: "outros" }],
    shownVehicleIds: ["weekend"],
  });
  assert.match(result.reply, /Manual nessa faixa é só esse.*automáticos nessa faixa/s);
  assert.ok(result.vehicles.every(v => v.price >= 45000 && v.price <= 50000 && v.category === "carro"));
  assert.deepEqual(new Set(result.vehicles.map(v => v.id)), new Set(["fox", "hb"]));
});

test("sem manual exato oferece apenas automáticos na mesma faixa e deixa a mudança explícita", async () => {
  const result = await runChatTurn({ mensagem: "manual de 45 a 50 mil", historico: [], stock: stock.filter(v => v.id !== "weekend"), generate });
  assert.match(result.reply, /Não tenho manual nessa faixa.*Mas tenho automáticos nessa faixa/s);
  assert.ok(result.vehicles.length > 0 && result.vehicles.every(v => v.transmission === "Automático" && v.price >= 45000 && v.price <= 50000));
});

test("pedir mais sem orçamento não inventa uma faixa e mantém os carros elegíveis", async () => {
  const result = await runChatTurn({ mensagem: "mais", historico: [{ role: "user", content: "carros manuais" }], stock, generate });
  assert.ok(result.vehicles.every(v => v.transmission === "Manual" && v.category === "carro"));
  assert.doesNotMatch(result.reply, /faixa de|até R\$|orçamento de/);
});
