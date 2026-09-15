import assert from "node:assert/strict";
import { test } from "node:test";
import { applyChatReplyGuards } from "./chat-polish";
import { chatTurnMayCreateLead } from "./chat-guard";
import {
  CHAT_COMPARE_ASK_REPLY,
  CHAT_PROMPT_STOCK_LIMIT,
  asksAboutAvailability,
  chatWaitlistWhatsAppUrl,
  formatChatWaitlistQuery,
  formatFocusedConsumptionReply,
  isEditDistanceAtMostOne,
  matchInterestVehicle,
  parseVehicleCategoryFilter,
  selectVehiclesForChatPrompt,
  seeksMissingNamedModel,
  type ChatVehicleRecord,
} from "./chat-stock";
import { formatStockForPrompt } from "./chat-prompt";
import { chatWhatsAppCta, extractWhatsAppHref } from "./chat-text";
import { runChatTurn } from "./chat-turn";

const hb20: ChatVehicleRecord = {
  id: "c-hb20-buyer",
  brand: "Hyundai",
  model: "HB20",
  version: "evolution 1.0",
  yearModel: 2022,
  km: 68450,
  price: 64900,
  color: "Prata",
  transmission: "Manual",
  fuel: "Flex",
  category: "carro",
  engine: "1.0",
};

const onix: ChatVehicleRecord = {
  id: "c-onix-buyer",
  brand: "Chevrolet",
  model: "Onix",
  version: "LT 1.0",
  yearModel: 2021,
  km: 41000,
  price: 59900,
  color: "Branco",
  transmission: "Automático",
  fuel: "Flex",
  category: "carro",
  engine: "1.0",
};

const compass: ChatVehicleRecord = {
  id: "c-compass-buyer",
  brand: "Jeep",
  model: "Compass",
  version: "Longitude",
  yearModel: 2021,
  km: 51000,
  price: 159900,
  color: "Branco",
  transmission: "Automático",
  fuel: "Flex",
  category: "carro",
};

const biz: ChatVehicleRecord = {
  id: "c-biz-buyer",
  brand: "Honda",
  model: "BIZ 125",
  version: "EX 125 FLEX",
  yearModel: 2023,
  km: 22000,
  price: 17900,
  color: "Vermelha",
  transmission: "Manual",
  fuel: "Flex",
  category: "moto",
};

const fox16: ChatVehicleRecord = {
  id: "c-fox-16-buyer",
  brand: "Volkswagen",
  model: "Fox 1.6",
  version: "Trend 1.6",
  yearModel: 2014,
  km: 98000,
  price: 38900,
  color: "Prata",
  transmission: "Manual",
  fuel: "Flex",
  category: "carro",
  engine: "1.6",
};

function blockedGenerate() {
  return async () => {
    throw new Error("gemini não deveria ser chamado");
  };
}

test("typo e hb 20 ainda casam o anúncio real", () => {
  assert.equal(isEditDistanceAtMostOne("onixx", "onix"), true);
  assert.equal(isEditDistanceAtMostOne("civc", "civic"), true);
  assert.equal(matchInterestVehicle("onixx", [onix, hb20])?.id, onix.id);
  assert.equal(matchInterestVehicle("hb 20", [hb20, onix])?.id, hb20.id);
});

test("tem biz não mistura carro na categoria", () => {
  assert.equal(parseVehicleCategoryFilter("tem biz até 15 mil?"), "moto");
  assert.equal(parseVehicleCategoryFilter("carros até 70 mil?"), "carro");
});

test("lista de espera do chat vira WhatsApp com frase humana", () => {
  assert.equal(
    formatChatWaitlistQuery("Tem automático até 40 mil?"),
    "automático até R$ 40.000",
  );
  const href = chatWaitlistWhatsAppUrl("Tem automático até 40 mil?");
  const decoded = decodeURIComponent(href);
  assert.match(decoded, /wa\.me\/5527996330706\?text=/);
  assert.match(decoded, /Olá! Quero ser avisado quando chegar: automático até R\$\s*40\.000/);
  const cta = chatWhatsAppCta(
    `Nessa combinação (automático até R$ 40.000) ainda não tem anúncio agora. ${href}`,
  );
  assert.equal(cta?.label, "Avisar quando chegar");
  assert.equal(extractWhatsAppHref(`chama: ${href}`), href);
  assert.match(decodeURIComponent(cta?.href ?? ""), /automático até R\$\s*40\.000/);
});

test("Fox 1.6 1.6 não aparece no template, no prompt nem na guarda", () => {
  const spoken = formatFocusedConsumptionReply(fox16);
  assert.match(spoken, /Fox 1\.6/);
  assert.doesNotMatch(spoken, /1\.6 1\.6/);
  const prompt = formatStockForPrompt(
    [
      {
        brand: fox16.brand,
        model: fox16.model,
        version: fox16.version,
        year: fox16.yearModel,
        km: fox16.km,
        price: fox16.price,
        color: fox16.color,
        transmission: fox16.transmission,
        fuel: fox16.fuel,
        engine: fox16.engine,
        category: "carro",
      },
    ],
    { consumption: true },
  );
  assert.doesNotMatch(prompt, /1\.6 1\.6|motor 1\.6/);
  const guarded = applyChatReplyGuards(
    "Para o FOX 1.6 1.6 flex, a faixa típica de catálogo fica 9–12 km/l na cidade.",
    [fox16],
  );
  assert.doesNotMatch(guarded, /1\.6 1\.6/);
});

test("prompt do Gemini não despeja o estoque inteiro", () => {
  const stock = Array.from({ length: 40 }, (_, index) => ({
    ...hb20,
    id: `c-fill-${index}`,
    price: 20000 + index * 1000,
    model: index % 2 === 0 ? "HB20" : "Onix",
  }));
  const picked = selectVehiclesForChatPrompt(stock, "Carros até 70 mil?");
  assert.ok(picked.length <= CHAT_PROMPT_STOCK_LIMIT);
  assert.ok(picked.every((vehicle) => vehicle.price <= 70_000));
});

test("HB20 vs Onix compara só os dois e deixa o Compass de fora", async () => {
  const result = await runChatTurn({
    mensagem: "HB20 vs Onix",
    historico: [],
    stock: [hb20, onix, compass],
    generate: blockedGenerate(),
  });
  assert.equal(result.meta?.policy, "compare");
  assert.equal(result.vehicles.length, 2);
  assert.deepEqual(
    result.vehicles.map((vehicle) => vehicle.model).sort(),
    ["HB20", "Onix"],
  );
  assert.doesNotMatch(result.reply, /Compass/);
  assert.doesNotMatch(result.reply, /BIZ|Civic/);
});

test("qual o melhor? sem modelo não despeja o estoque", async () => {
  const result = await runChatTurn({
    mensagem: "qual o melhor?",
    historico: [],
    stock: [hb20, onix, compass, biz],
    generate: blockedGenerate(),
  });
  assert.equal(result.meta?.policy, "compare-ask");
  assert.equal(result.reply, CHAT_COMPARE_ASK_REPLY);
  assert.equal(result.vehicles.length, 0);
});

test("ainda tem civic? fora do estoque vira waitlist, não inventa", async () => {
  const result = await runChatTurn({
    mensagem: "ainda tem civic?",
    historico: [],
    stock: [hb20, onix, biz],
    generate: blockedGenerate(),
  });
  assert.equal(result.meta?.policy, "waitlist");
  assert.match(result.reply, /não está na lista atual/i);
  assert.match(decodeURIComponent(result.reply), /civic/i);
  assert.doesNotMatch(result.reply, /Compass/);
});

test("tem civic? fora do estoque não chama Gemini", async () => {
  const result = await runChatTurn({
    mensagem: "tem civic?",
    historico: [],
    stock: [hb20, onix],
    generate: blockedGenerate(),
  });
  assert.equal(seeksMissingNamedModel("tem civic?", [hb20, onix]), true);
  assert.match(result.reply, /não está na lista atual/i);
  assert.match(result.reply, /wa\.me/);
});

test("Esse carro ainda tem? na ficha usa só o estoque atual", async () => {
  assert.equal(asksAboutAvailability("está disponível?"), true);
  const available = await runChatTurn({
    mensagem: "Esse carro ainda tem?",
    historico: [],
    stock: [hb20],
    vehicleId: hb20.id,
    generate: blockedGenerate(),
  });
  assert.match(available.reply, /ainda está no estoque/);
  assert.match(available.reply, /8h às 23h/);
  const sold = await runChatTurn({
    mensagem: "Esse carro ainda tem?",
    historico: [],
    stock: [hb20],
    vehicleId: "c-siena-vendido",
    generate: blockedGenerate(),
  });
  assert.match(sold.reply, /já saiu do estoque/);
});

test("automático até 80 mil vazio aponta WhatsApp com o recorte", async () => {
  const result = await runChatTurn({
    mensagem: "Automático até 80 mil?",
    historico: [],
    stock: [hb20, biz],
    generate: blockedGenerate(),
  });
  assert.equal(result.meta?.policy, "waitlist");
  assert.match(decodeURIComponent(result.reply), /automático até R\$\s*80\.000/);
  assert.doesNotMatch(result.reply, /mais em conta/);
});

test("garantia, docs e cartão vs financiamento continuam atalho da loja", async () => {
  const warranty = await runChatTurn({
    mensagem: "Tem garantia nesse seminovo?",
    historico: [],
    stock: [hb20],
    generate: blockedGenerate(),
  });
  assert.match(warranty.reply, /3 meses de motor e câmbio/);
  assert.match(warranty.reply, /8h às 23h/);

  const docs = await runChatTurn({
    mensagem: "Como funciona a documentação e a transferência?",
    historico: [],
    stock: [hb20],
    generate: blockedGenerate(),
  });
  assert.match(docs.reply, /RG\/CPF|CNH/);
  assert.match(docs.reply, /despachante/);

  const card = await runChatTurn({
    mensagem: "É financiamento ou cartão?",
    historico: [],
    stock: [hb20],
    generate: blockedGenerate(),
  });
  assert.match(card.reply, /18 vezes/);
  assert.match(card.reply, /60 vezes/);
  assert.doesNotMatch(card.reply, /parcela de R\$/);
});

test("tem biz até 15 mil não mistura carro na waitlist", async () => {
  const result = await runChatTurn({
    mensagem: "tem biz até 15 mil?",
    historico: [],
    stock: [hb20, onix, compass, biz],
    generate: blockedGenerate(),
  });
  assert.equal(result.meta?.policy, "waitlist");
  assert.match(decodeURIComponent(result.reply), /biz/i);
  assert.ok(result.vehicles.every((vehicle) => vehicle.category === "moto"));
  assert.doesNotMatch(result.reply, /HB20|Onix|Compass/);
});

test("consumo do Fox 1.6 não chama Gemini e não duplica cilindrada", async () => {
  const result = await runChatTurn({
    mensagem: "Qual consumo do Fox 1.6?",
    historico: [],
    stock: [fox16, hb20],
    generate: blockedGenerate(),
  });
  assert.equal(result.meta?.policy, "stock-fact");
  assert.match(result.reply, /Fox 1\.6/);
  assert.match(result.reply, /km\/l/);
  assert.doesNotMatch(result.reply, /1\.6 1\.6/);
  assert.match(result.reply, /não foi medido/);
});

test("criar_lead só entra no payload quando já tem telefone", () => {
  assert.equal(chatTurnMayCreateLead("Carros até 70 mil?"), false);
  assert.equal(chatTurnMayCreateLead("Qual consumo do fox"), false);
  assert.equal(
    chatTurnMayCreateLead("Meu nome é Ana, telefone (27) 99999-1234"),
    true,
  );
});
