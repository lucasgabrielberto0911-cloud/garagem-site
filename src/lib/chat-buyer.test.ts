import assert from "node:assert/strict";
import { test } from "node:test";
import { chatVehicleVersion } from "./chat-cards";
import { applyChatReplyGuards } from "./chat-polish";
import { chatTurnMayCreateLead } from "./chat-guard";
import {
  CHAT_AVAILABILITY_ASK_REPLY,
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

test("HB20 vs Onix fora do estoque vira waitlist, não pede os dois modelos", async () => {
  const result = await runChatTurn({
    mensagem: "HB20 vs Onix",
    historico: [],
    stock: [compass, biz],
    generate: blockedGenerate(),
  });
  assert.equal(result.meta?.policy, "waitlist");
  assert.doesNotMatch(result.reply, /Me diz os dois modelos/);
  assert.match(result.reply, /não está na lista atual/i);
  assert.match(decodeURIComponent(result.reply), /hb20|onix/i);
});

test("Esse carro ainda tem? sem ficha pede o modelo, não waitlist de carro", async () => {
  const result = await runChatTurn({
    mensagem: "Esse carro ainda tem?",
    historico: [],
    stock: [],
    generate: blockedGenerate(),
  });
  assert.equal(result.meta?.policy, "availability-ask");
  assert.equal(result.reply, CHAT_AVAILABILITY_ASK_REPLY);
  assert.doesNotMatch(result.reply, /combinação \(carro\)/);
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

test("ainda tem civic? com estoque vazio não diz que já saiu", async () => {
  const result = await runChatTurn({
    mensagem: "ainda tem civic?",
    historico: [],
    stock: [],
    generate: blockedGenerate(),
  });
  assert.equal(result.meta?.policy, "waitlist");
  assert.doesNotMatch(result.reply, /já saiu do estoque/);
  assert.match(decodeURIComponent(result.reply), /civic/i);
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

test("Gemini cortado em limite de R$ não fica na resposta final", async () => {
  const result = await runChatTurn({
    mensagem: "Carros até 70 mil?",
    historico: [],
    stock: [hb20, onix],
    generate: async () => ({
      text: "Olha só: automáticos até o limite de R$",
      functionCall: null,
    }),
  });
  assert.match(result.reply, /70\.000|HB20|Onix/);
  assert.doesNotMatch(result.reply, /limite de R\$$/);
  assert.doesNotMatch(result.reply, /limite de R\$\.$/);
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

test("card de consumo do Fox Bluemotion não duplica 1.6 na versão", async () => {
  const foxBlue: ChatVehicleRecord = {
    ...fox16,
    id: "c-fox-bluemotion-buyer",
    model: "FOX 1.6",
    version: "FOX 1.6 BLUEMOTION 1.6 GII",
  };
  const result = await runChatTurn({
    mensagem: "Qual consumo do Fox 1.6?",
    historico: [],
    stock: [foxBlue, hb20],
    generate: blockedGenerate(),
  });
  assert.equal(result.vehicles.length, 1);
  const card = result.vehicles[0]!;
  const version = chatVehicleVersion(card);
  assert.equal(card.title, "Volkswagen Fox 1.6");
  assert.equal(version, "Bluemotion GII");
  assert.doesNotMatch(version ?? "", /1\.6/);
  assert.doesNotMatch(`${card.title} ${version}`, /1\.6.*1\.6/);
  assert.doesNotMatch(result.reply, /1\.6 1\.6/);
});

test("criar_lead só entra no payload quando já tem telefone", () => {
  assert.equal(chatTurnMayCreateLead("Carros até 70 mil?"), false);
  assert.equal(chatTurnMayCreateLead("Qual consumo do fox"), false);
  assert.equal(
    chatTurnMayCreateLead("Meu nome é Ana, telefone (27) 99999-1234"),
    true,
  );
});

test("Pulse vs HR-V no mesmo preço não inventa mais em conta", async () => {
  const pulse: ChatVehicleRecord = {
    id: "c-pulse-buyer",
    brand: "Fiat",
    model: "Pulse",
    version: "Drive",
    yearModel: 2022,
    km: 41000,
    price: 89900,
    color: "Branco",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
  };
  const hrv: ChatVehicleRecord = {
    id: "c-hrv-buyer",
    brand: "Honda",
    model: "HR-V",
    version: "EX",
    yearModel: 2018,
    km: 65000,
    price: 89900,
    color: "Cinza",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
  };
  const result = await runChatTurn({
    mensagem: "Pulse vs HR-V",
    historico: [],
    stock: [pulse, hrv, compass],
    generate: blockedGenerate(),
  });
  assert.equal(result.meta?.policy, "compare");
  assert.equal(result.vehicles.length, 2);
  assert.match(result.reply, /R\$ 89\.900/);
  assert.match(result.reply, /menos km/);
  assert.match(result.reply, /mais novo|desempate é km e ano/);
  assert.doesNotMatch(result.reply, /mais em conta/);
  assert.doesNotMatch(result.reply, /também está em R\$ 89\.900/);
  assert.doesNotMatch(result.reply, /Compass/);
});

test("ainda tem Pulse na lista confirma o estoque atual", async () => {
  const pulse: ChatVehicleRecord = {
    id: "c-pulse-avail",
    brand: "Fiat",
    model: "Pulse",
    version: "Drive",
    yearModel: 2022,
    km: 41000,
    price: 89900,
    color: "Branco",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
  };
  const result = await runChatTurn({
    mensagem: "ainda tem Pulse?",
    historico: [],
    stock: [pulse, hb20],
    generate: blockedGenerate(),
  });
  assert.match(result.reply, /ainda está no estoque/);
  assert.match(result.reply, /Pulse/i);
  assert.doesNotMatch(result.reply, /já saiu/);
});

test("HB20 automático até 70 mil lista HB20 e Lancer, não o Compass", async () => {
  const hb20Auto: ChatVehicleRecord = {
    ...hb20,
    id: "c-hb20-auto-70",
    transmission: "Automático",
    price: 64900,
  };
  const lancer: ChatVehicleRecord = {
    id: "c-lancer-auto-70",
    brand: "Mitsubishi",
    model: "Lancer",
    version: "2.0",
    yearModel: 2014,
    km: 80000,
    price: 62900,
    color: "Preto",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
  };
  const result = await runChatTurn({
    mensagem: "HB20 automático até 70 mil",
    historico: [],
    stock: [hb20Auto, lancer, compass],
    generate: blockedGenerate(),
  });
  assert.doesNotMatch(result.reply, /Compass/);
  const models = result.vehicles.map((vehicle) => vehicle.model);
  assert.ok(models.includes("HB20"));
  assert.ok(models.includes("Lancer") || /Lancer/i.test(result.reply));
  assert.ok(result.vehicles.every((vehicle) => vehicle.price <= 70_000));
});
