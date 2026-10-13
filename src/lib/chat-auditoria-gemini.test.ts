import assert from "node:assert/strict";
import test from "node:test";
import type { ChatTurn } from "./chat-gemini";
import { runChatTurn } from "./chat-turn";
import {
  chatPolicyShortcut,
  CHAT_CARD_REPLY,
  CHAT_VISIT_REPLY,
  CHAT_WHATSAPP_URL,
  type ChatVehicleRecord,
} from "./chat-stock";
import { asksForMoreChatVehicles, chatSearchOrder } from "./chat-search-filters";

const car = (
  id: string,
  brand: string,
  model: string,
  price: number,
  transmission = "Manual",
  yearModel = 2016,
  bodyStyle = "sedan",
): ChatVehicleRecord => ({
  id,
  brand,
  model,
  price,
  transmission,
  yearModel,
  version: "1.0",
  engine: "1.0",
  km: 50000,
  category: "carro",
  color: "Branco",
  fuel: "Flex",
  bodyStyle,
});

const stock: ChatVehicleRecord[] = [
  car("ka-sedan", "Ford", "Ka Sedan", 49990, "Automático", 2019, "sedan"),
  car("lancer", "Mitsubishi", "Lancer", 62900, "Automático", 2014, "sedan"),
  car("civic-lxr", "Honda", "Civic", 74900, "Automático", 2015, "sedan"),
  car("city", "Honda", "City", 84990, "Automático", 2018, "sedan"),
  car("hb20s", "Hyundai", "HB20S", 87900, "Automático", 2024, "sedan"),
  car("civic-exl", "Honda", "Civic", 126900, "Automático", 2020, "sedan"),
  car("weekend", "Fiat", "Palio Weekend", 47900, "Manual", 2016, "wagon"),
  car("palio", "Fiat", "Palio", 24900, "Manual", 2008, "hatch"),
  car("gol", "Volkswagen", "Gol", 32900, "Manual", 2012, "hatch"),
  car("mobi", "Fiat", "Mobi", 57900, "Manual", 2024, "hatch"),
  car("hb20-manual", "Hyundai", "HB20", 64900, "Manual", 2022, "hatch"),
  {
    ...car("biz125", "Honda", "BIZ 125", 14900, "Semi-automático", 2023),
    category: "moto",
    engine: "125cc",
  },
  {
    ...car("biz110", "Honda", "BIZ 110i", 15200, "Semi-automático", 2023),
    category: "moto",
    engine: "110cc",
  },
  {
    ...car("cg", "Honda", "CG 160 Start", 17000, "Manual", 2023),
    category: "moto",
    engine: "160cc",
  },
];

const generateNoOp = async () => {
  throw new Error("Não deve acionar modelo externo para testes determinísticos");
};

// =========================================================================
// ITEM 1: "mais um" / "mais uma" / variações mantêm todos os filtros e teto
// =========================================================================
test("Item 1: asksForMoreChatVehicles reconhece variações de 'mais um' e 'mais uma'", () => {
  const positives = [
    "mais um",
    "mais uma",
    "mais uns",
    "mais umas",
    "mais algum",
    "mais alguma",
    "mais outro",
    "mais outra",
    "mais uma opção",
    "mais um modelo",
    "mais um carro",
    "mais uma moto",
    "mais um veículo",
    "tem mais um",
    "tem mais uma?",
    "mostra mais um",
    "mostre mais uma",
    "manda mais um",
    "quero mais um",
    "quero ver mais um",
    "e mais um?",
    "mas tem mais um?",
    "mais um por favor",
    "outro",
    "outros",
    "outra",
    "outras",
    "mais",
    "mais opções",
  ];
  for (const q of positives) {
    assert.equal(asksForMoreChatVehicles(q), true, `Deveria ser true para: "${q}"`);
  }

  const negatives = [
    "qual desses é mais novo?",
    "tem mais fotos?",
    "outro câmbio",
    "mais barato",
    "o outro tem ar?",
    "mais potente",
    "mais econômico",
    "mais novo",
    "mais novos",
  ];
  for (const q of negatives) {
    assert.equal(asksForMoreChatVehicles(q), false, `Deveria ser false para: "${q}"`);
  }
});

test("Item 1: 'Quero um sedan automático até 80 mil' -> 'outro' -> 'mais um' mantém teto e câmbio sem repetir", async () => {
  const historico: ChatTurn[] = [];
  const seenIds = new Set<string>();

  // Turno 1: Sedãs automáticos até 80 mil
  const t1 = await runChatTurn({
    mensagem: "Quero um sedan automático até 80 mil",
    historico,
    stock,
    generate: generateNoOp,
  });
  assert.ok(t1.vehicles.length > 0);
  assert.ok(t1.vehicles.every((v) => v.price <= 80000));
  assert.ok(t1.vehicles.every((v) => /autom/i.test(v.transmission ?? "")));
  for (const v of t1.vehicles) seenIds.add(v.id);

  historico.push(
    { role: "user", content: "Quero um sedan automático até 80 mil" },
    { role: "assistant", content: t1.reply },
  );

  // Turno 2: "outro"
  const t2 = await runChatTurn({
    mensagem: "outro",
    historico,
    stock,
    generate: generateNoOp,
    shownVehicleIds: [...seenIds],
  });
  // Os sedãs <= 80k eram Ka Sedan (49.9k), Lancer (62.9k), Civic LXR (74.9k)
  for (const v of t2.vehicles) {
    assert.ok(!seenIds.has(v.id), `Repetiu veículo ${v.id}`);
    assert.ok(v.price <= 80000, `Ultrapassou teto de 80 mil: ${v.price}`);
    seenIds.add(v.id);
  }

  historico.push(
    { role: "user", content: "outro" },
    { role: "assistant", content: t2.reply },
  );

  // Turno 3: "mais um" — DEVE manter o teto de 80 mil, NÃO mostrar City (84.9k) nem Civic (126.9k)
  const t3 = await runChatTurn({
    mensagem: "mais um",
    historico,
    stock,
    generate: generateNoOp,
    shownVehicleIds: [...seenIds],
  });
  assert.ok(
    t3.vehicles.every((v) => v.price <= 80000),
    "Veículo retornado no Turno 3 excedeu o teto de 80 mil",
  );
  assert.doesNotMatch(t3.reply, /Civic.*126\.900|City.*84\.990|HB20S.*87\.900/);
});

test("Item 1: 'Manual até 60 mil' -> 'outro' -> 'mais um' não sugere carro acima de 60 mil sem aviso", async () => {
  const historico: ChatTurn[] = [];
  const seenIds = new Set<string>();

  const t1 = await runChatTurn({
    mensagem: "Manual até 60 mil",
    historico,
    stock,
    generate: generateNoOp,
  });
  assert.ok(t1.vehicles.every((v) => v.price <= 60000));
  for (const v of t1.vehicles) seenIds.add(v.id);

  historico.push(
    { role: "user", content: "Manual até 60 mil" },
    { role: "assistant", content: t1.reply },
  );

  const t2 = await runChatTurn({
    mensagem: "outro",
    historico,
    stock,
    generate: generateNoOp,
    shownVehicleIds: [...seenIds],
  });
  for (const v of t2.vehicles) seenIds.add(v.id);

  historico.push(
    { role: "user", content: "outro" },
    { role: "assistant", content: t2.reply },
  );

  const t3 = await runChatTurn({
    mensagem: "mais um",
    historico,
    stock,
    generate: generateNoOp,
    shownVehicleIds: [...seenIds],
  });
  // Não pode sugerir HB20 manual de 64.900 sem avisar
  assert.ok(t3.vehicles.every((v) => v.price <= 60000));
});

// =========================================================================
// ITEM 3: "carros mais novos" = ordenar por ano mais recente, não modelo
// =========================================================================
test("Item 3: chatSearchOrder reconhece variações de mais novos/novas/recentes", () => {
  const newVariations = [
    "carros mais novos",
    "carros mais novos do estoque",
    "motos mais novas",
    "mais novos",
    "mais novas",
    "mais recente",
    "mais recentes",
    "ano mais novo",
    "ano mais recente",
  ];
  for (const q of newVariations) {
    assert.equal(chatSearchOrder(q), "year", `Deveria ordenar por year: "${q}"`);
  }
});

test("Item 3: 'Quero ver os carros mais novos do estoque' ordena por ano decrescente e não busca modelo 'novos'", async () => {
  const result = await runChatTurn({
    mensagem: "Quero ver os carros mais novos do estoque",
    historico: [],
    stock,
    generate: generateNoOp,
  });
  assert.doesNotMatch(result.reply, /Novos não está na lista atual/i);
  assert.doesNotMatch(result.reply, /quando chegar: novos/i);
  assert.ok(result.vehicles.length >= 2);
  // O ano do primeiro veículo deve ser >= ao do segundo (ordenação decrescente de ano)
  for (let i = 0; i < result.vehicles.length - 1; i++) {
    assert.ok(
      result.vehicles[i]!.year >= result.vehicles[i + 1]!.year,
      `Ordem de ano incorreta: ${result.vehicles[i]!.year} < ${result.vehicles[i + 1]!.year}`,
    );
  }
  // Os carros de 2024 (Mobi e HB20S) devem estar entre os primeiros retornados, não Palio 2008 e Gol 2012
  const topYears = result.vehicles.map((v) => v.year);
  assert.ok(topYears.includes(2024), "Deveria incluir veículos de 2024");
  assert.ok(!topYears.includes(2008), "Não deveria listar Palio 2008 entre os mais novos");
});

// =========================================================================
// ITEM 9: Parcelamento no cartão: rota direta, sem inventar números
// =========================================================================
test("Item 9: chatPolicyShortcut reconhece perguntas naturais sobre cartão", () => {
  const cardQueries = [
    "Vocês parcelam no cartão de crédito?",
    "voces parcelam no cartao de credito",
    "parcelam no cartão?",
    "parcela no cartão de crédito?",
    "da pra parcelar no cartao?",
    "aceitam cartao de credito?",
    "posso pagar no cartão?",
    "divide no cartão?",
    "quantas vezes no cartão?",
    "qual o limite de parcelas no cartao?",
    "parcelamento no cartão",
  ];
  for (const q of cardQueries) {
    assert.equal(chatPolicyShortcut(q), "card", `Deveria rotear para policy 'card': "${q}"`);
  }
});

test("Item 9: 'Vocês parcelam no cartão de crédito?' retorna CHAT_CARD_REPLY com 18x no cartão e 60x no financiamento", async () => {
  const result = await runChatTurn({
    mensagem: "Vocês parcelam no cartão de crédito?",
    historico: [],
    stock,
    generate: generateNoOp,
  });
  assert.equal(result.meta?.policy, "card");
  assert.ok(result.reply.includes(CHAT_CARD_REPLY));
  assert.match(result.reply, /18 vezes/);
  assert.match(result.reply, /60 vezes/);
  assert.match(result.reply, new RegExp(CHAT_WHATSAPP_URL));
  assert.doesNotMatch(result.reply, /12x|24x|36x|taxa|juros|bandeira/i);
});

// =========================================================================
// ITEM 11: Moto automática com faixa: concordância correta e Biz semiautomática
// =========================================================================
test("Item 11: 'Tem moto automática de 15 mil?' sugere Biz 125 semiautomática e mantém concordância", async () => {
  const result = await runChatTurn({
    mensagem: "Tem moto automática de 15 mil?",
    historico: [],
    stock,
    generate: generateNoOp,
  });
  assert.doesNotMatch(result.reply, /moto automático/i);
  assert.match(result.reply, /semi-automática|semi-automáticas/i);
  assert.doesNotMatch(result.reply, /sem embreagem|marcha no pé/i);
  assert.ok(result.vehicles.some((v) => /biz/i.test(v.model) && v.price <= 15000));
});

test("Item 11: 'Tem moto automática de 10 mil?' tem concordância correta no fallback de espera", async () => {
  const result = await runChatTurn({
    mensagem: "Tem moto automática de 10 mil?",
    historico: [],
    stock,
    generate: generateNoOp,
  });
  assert.doesNotMatch(result.reply, /moto automático/i);
  assert.match(result.reply, /moto automática/i);
});

// =========================================================================
// ITEM 12: Singular com 1 carro; agendamento com 'Vem dar uma olhada!'
// =========================================================================
test("Item 12: com 1 só carro retornado, pergunta de fechamento fica no singular", async () => {
  // Palio Weekend R$ 47.900 é o único manual entre 45 e 50 mil
  const result = await runChatTurn({
    mensagem: "Manual de 45 a 50 mil",
    historico: [],
    stock,
    generate: generateNoOp,
  });
  assert.equal(result.vehicles.length, 1);
  assert.doesNotMatch(result.reply, /Qual deles você quer conhecer melhor\?/);
  assert.match(result.reply, /Quer conhecer melhor esse carro\?/);
});

test("Item 12: com 1 só moto retornada, pergunta de fechamento usa 'essa moto'", async () => {
  const result = await runChatTurn({
    mensagem: "Tem moto de 14 a 15 mil?",
    historico: [],
    stock,
    generate: generateNoOp,
  });
  assert.equal(result.vehicles.length, 1);
  assert.doesNotMatch(result.reply, /Qual deles você quer conhecer melhor\?/);
  assert.match(result.reply, /Quer conhecer melhor essa moto\?/);
});

test("Item 12: com múltiplos veículos, pergunta de fechamento fica no plural", async () => {
  const result = await runChatTurn({
    mensagem: "Automático até 65 mil",
    historico: [],
    stock,
    generate: generateNoOp,
  });
  assert.ok(result.vehicles.length > 1);
  assert.match(result.reply, /Qual deles você quer conhecer melhor\?/);
});

test("Item 12: agendamento preserva o texto original e exige horário marcado", async () => {
  for (const q of [
    "Posso ir aí ver os carros amanhã?",
    "Quero agendar uma visita amanhã",
  ]) {
    const result = await runChatTurn({
      mensagem: q,
      historico: [],
      stock,
      generate: generateNoOp,
    });
    assert.equal(result.meta?.policy, "visit");
    assert.match(result.reply, /^Dá sim!/);
    assert.match(result.reply, /horário marcado/);
    assert.doesNotMatch(result.reply, /Linhares|rua|avenida|bairro|centro/i);
    assert.ok(result.reply.includes(CHAT_VISIT_REPLY));
  }
});


test("integração: crédito aprovado e entrada não são perguntas de parcelamento no cartão", () => {
  for (const mensagem of [
    "Qual a parcela do financiamento? Tenho crédito aprovado",
    "Meu cartão de crédito está limpo, dá pra dar de entrada?",
  ]) assert.notEqual(chatPolicyShortcut(mensagem), "card", mensagem);
});

test("integração: mais um desconto e mais entrada não pedem outro veículo", () => {
  for (const mensagem of ["mais um desconto?", "mais um pouco de entrada"])
    assert.equal(asksForMoreChatVehicles(mensagem), false, mensagem);
});
