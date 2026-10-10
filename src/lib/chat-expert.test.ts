import assert from "node:assert/strict";
import test from "node:test";
import { runChatTurn } from "./chat-turn";
import { CHAT_FALLBACK_REPLY, CHAT_WHATSAPP_URL } from "./chat-prompt";
import {
  expertSubject,
  isTradeInMessage,
  outsideModelCandidates,
  wantsExpertAnswer,
} from "./chat-expert";
import { isBrowsingOrThanks } from "./chat-turn";
import type { ChatVehicleRecord } from "./chat-stock";
import type { ChatTurn } from "./chat-gemini";

// Estoque de teste parecido com o do Lucas. Preços e km são fixtures locais.
const base = { color: "Prata", fuel: "Flex", category: "carro", km: 80_000, price: 60_000 };
const v = (id: string, brand: string, model: string, version: string, yearModel: number, transmission: string, engine: string, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord => ({
  ...base, id, brand, model, version, yearModel, transmission, engine, ...extra,
});
const hb16 = v("hb16", "Hyundai", "HB20", "Premium 1.6 Aut", 2015, "Automático", "1.6 Aspirado", { km: 127_000, price: 56_900, locationCity: "Colatina" });
const hb10 = v("hb10", "Hyundai", "HB20", "Evolution 1.0", 2022, "Manual", "1.0 Aspirado", { km: 40_000, price: 69_900 });
const hb20s = v("hb20s", "Hyundai", "HB20S", "Comfort Plus 1.0 TGDI Aut", 2024, "Automático", "1.0 TGDI", { km: 50_000, price: 89_900 });
const civic15 = v("civic15", "Honda", "Civic", "LXR 2.0", 2015, "Automático", "2.0", { price: 74_900 });
const civic20 = v("civic20", "Honda", "Civic", "EXL 2.0", 2020, "Automático", "2.0", { price: 126_900 });
const kicks = v("kicks", "Nissan", "Kicks", "SL 1.6 CVT", 2019, "Automático", "1.6", { price: 89_900 });
const corolla = v("corolla", "Toyota", "Corolla", "Altis 2.0", 2018, "Automático", "2.0", { price: 99_900 });
const city = v("city", "Honda", "City", "EXL 1.5 CVT", 2018, "Automático", "1.5", { km: 76_000, price: 82_900 });
const gol = v("gol", "Volkswagen", "Gol", "Trend 1.0", 2012, "Manual", "1.0", { price: 28_900 });
const stock = [hb16, hb10, hb20s, civic15, civic20, kicks, corolla, city, gol];

const user = (content: string): ChatTurn => ({ role: "user", content });
const assistant = (content: string): ChatTurn => ({ role: "assistant", content });
const noModel = async () => {
  throw new Error("não precisa do modelo de linguagem");
};
const robotic = /No estoque:|Achei \d|Achei no estoque|Achei este/;

test("Lucas 1: quantos cv tem o hb20 1.6? responde o cv primeiro, sem prefixo robótico e com o card certo", async () => {
  const streamed: string[] = [];
  const result = await runChatTurn({
    mensagem: "quantos cv tem o hb20 1.6?",
    historico: [],
    stock,
    onToken: (text) => streamed.push(text),
    generate: noModel,
  });
  assert.equal(
    result.reply,
    "O HB20 1.6 tem cerca de 128 cv no etanol e 122 cv na gasolina. São números de fábrica dessa versão; podem variar um pouco na prática.",
  );
  assert.equal(result.meta?.policy, "spec-direct");
  assert.doesNotMatch(result.reply, robotic);
  assert.doesNotMatch(result.reply, /R\$|km\b|56\.900|Colatina/, "nem preço, nem km, nem cidade");
  // O texto vem primeiro e só o HB20 1.6 aparece como card (não os três HB20/HB20S).
  assert.deepEqual(result.vehicles.map((vehicle) => vehicle.id), ["hb16"]);
  assert.equal(streamed.join(""), result.reply);
});

test("Lucas 2: qual o mais forte? depois dos HB20 usa as fichas dos carros mostrados", async () => {
  const historico = [
    user("quantos cv tem o hb20 1.6?"),
    assistant(
      "Hyundai HB20 Premium 1.6 Aut 2015 · 127.000 km · R$ 56.900\nHyundai HB20 Evolution 1.0 2022 · 40.000 km · R$ 69.900\nHyundai HB20S Comfort Plus 1.0 TGDI Aut 2024 · 50.000 km · R$ 89.900",
    ),
  ];
  let prompt = "";
  let thinking: string | undefined;
  const reply =
    "Dos três, em potência pura o HB20 1.6 leva, com cerca de 128 cv no etanol. Já o HB20S 1.0 turbo tem 120 cv, mas entrega 17,5 kgfm desde 1.500 rpm: é o que responde melhor em retomada.";
  const result = await runChatTurn({
    mensagem: "qual o mais forte?",
    historico,
    stock,
    generate: async (input) => {
      prompt = input.systemPrompt;
      thinking = input.thinkingLevel;
      return { text: reply, functionCall: null, model: "gemini-3.5-flash-lite", calls: 1 };
    },
  });
  assert.equal(result.reply, reply);
  assert.equal(result.meta?.policy, "expert");
  assert.equal(result.meta?.model, "gemini-3.5-flash-lite");
  assert.equal(thinking, "minimal", "raciocínio mínimo também nas perguntas técnicas");
  // O prompt leva as três fichas e as regras do modo especialista; nada de lista do estoque pedida.
  assert.match(prompt, /MODO ESPECIALISTA/);
  assert.match(prompt, /FICHAS TÉCNICAS DE REFERÊNCIA/);
  assert.match(prompt, /HB20 1\.6.*\n\s+Motor: 1\.6 16V Gamma/);
  assert.match(prompt, /128 cv no etanol e 122 cv na gasolina/);
  assert.match(prompt, /120 cv, tanto no etanol quanto na gasolina; torque: 17,5 kgfm/);
  assert.match(prompt, /80 cv no etanol e 75 cv na gasolina/);
  assert.match(prompt, /NUNCA afirme nada sobre a UNIDADE do estoque/);
  // "Qual o mais forte?": o prompt leva a resposta-base com potência E torque juntos.
  assert.match(prompt, /Para “qual o mais forte\?”: olhe potência E torque juntos/);
  assert.match(prompt, /Depende do que você chama de forte/);
  assert.doesNotMatch(prompt, /FILTRO DO VISITANTE|cilindrada sozinha/);
  assert.doesNotMatch(prompt, /Civic|Corolla|Kicks/, "só os carros da conversa entram nas fichas");
  assert.doesNotMatch(result.reply, robotic);
  // Cards só dos carros citados na resposta.
  assert.deepEqual(result.vehicles.map((vehicle) => vehicle.id).sort(), ["hb16", "hb20s"]);
});

test("Lucas 2 sem o modelo de linguagem: ranking determinístico pelas fichas, com a nuance do torque", async () => {
  const result = await runChatTurn({
    mensagem: "qual o mais forte?",
    historico: [user("me mostra os hb20"), assistant("Hyundai HB20 Premium 1.6 Aut 2015 · 127.000 km · R$ 56.900\nHyundai HB20S Comfort Plus 1.0 TGDI Aut 2024 · 50.000 km · R$ 89.900")],
    stock,
    generate: noModel,
  });
  assert.match(result.reply, /^Depende do que você chama de forte\. Em potência máxima, o HB20 1\.6 leva: 128 cv no etanol e 122 cv na gasolina/);
  assert.match(result.reply, /O HB20S 1\.0 turbo tem 120 cv, só um pouco menos, e entrega 17,5 kgfm a 1\.500 rpm, bem mais cedo/);
  assert.doesNotMatch(result.reply, robotic);
  assert.doesNotMatch(result.reply, /cilindrada sozinha|preciso de potência documentada/);
});

test("0 a 100 do Civic responde os dois Civic do estoque, cada um com o seu ano", async () => {
  const result = await runChatTurn({ mensagem: "0 a 100 do Civic", historico: [], stock, generate: noModel });
  assert.equal(result.meta?.policy, "spec-direct");
  assert.match(result.reply, /Civic 2\.0 2015 faz o 0 a 100 km\/h em cerca de 10,9 segundos/);
  assert.match(result.reply, /Civic 2\.0 2020 faz o 0 a 100 km\/h em cerca de 10,9 segundos/);
  assert.doesNotMatch(result.reply, /R\$|74\.900|126\.900/);
  assert.deepEqual(result.vehicles.map((vehicle) => vehicle.id).sort(), ["civic15", "civic20"]);
});

test("consumo e autonomia do Kicks: Inmetro e tanque × consumo", async () => {
  const result = await runChatTurn({ mensagem: "consumo e autonomia do Kicks", historico: [], stock, generate: noModel });
  assert.match(result.reply, /Pelo Inmetro, o Kicks 1\.6 faz cerca de 7,7 km\/l na cidade e 9,4 km\/l na estrada com etanol; na gasolina, 11,4 km\/l na cidade e 13,7 km\/l na estrada/);
  assert.match(result.reply, /Com o tanque cheio \(41 litros\).*320 km na cidade e 390 km na estrada.*470 km na cidade e 560 km na estrada/);
  assert.match(result.reply, /conta teórica/);
  assert.deepEqual(result.vehicles.map((vehicle) => vehicle.id), ["kicks"]);
});

test("quantas marchas tem o Corolla / o City", async () => {
  const corollaReply = await runChatTurn({ mensagem: "quantas marchas tem o Corolla", historico: [], stock, generate: noModel });
  assert.match(corollaReply.reply, /Corolla 2\.0 usa câmbio CVT, que não tem marchas fixas; no modo manual ele simula 7 marchas/);
  const cityReply = await runChatTurn({ mensagem: "e quantas marchas tem o City?", historico: [], stock, generate: noModel });
  assert.match(cityReply.reply, /City 1\.5 usa câmbio CVT.*simula 7 marchas/);
  const viaAnaphora = await runChatTurn({ mensagem: "quantas marchas ele tem?", historico: [], stock, vehicleId: "hb16", generate: noModel });
  assert.match(viaAnaphora.reply, /automático convencional \(conversor de torque\) de 4 marchas/);
  assert.equal(viaAnaphora.vehicles.length, 0, "o carro da tela não vira card repetido");
});

test("modelo desconhecido: o modelo de linguagem responde com cautela; sem ele, sem chute e com o consultor", async () => {
  let prompt = "";
  const reply = "O Taycan eu não tenho no estoque e o número exato prefiro não chutar; o consultor confirma pra você.";
  const known = await runChatTurn({
    mensagem: "quantos cv tem o Taycan?",
    historico: [],
    stock,
    generate: async ({ systemPrompt }) => {
      prompt = systemPrompt;
      return { text: reply, functionCall: null };
    },
  });
  assert.equal(known.reply, reply);
  assert.match(prompt, /citou taycan, que não está no estoque e não tem ficha aqui/);
  assert.match(prompt, /só com números de que tenha segurança/);
  assert.doesNotMatch(prompt, /FICHAS TÉCNICAS DE REFERÊNCIA/);

  const offline = await runChatTurn({ mensagem: "quantos cv tem o Taycan?", historico: [], stock, generate: noModel });
  assert.match(offline.reply, /Do Taycan eu não tenho nem estoque nem ficha de fábrica aqui, e prefiro não chutar/);
  assert.ok(offline.reply.includes(CHAT_WHATSAPP_URL));
  assert.doesNotMatch(offline.reply, /\d+\s*cv/);
  assert.equal(offline.vehicles.length, 0);
});

test("comparar com um modelo fora do estoque (Onix) é pergunta de especialista, não lista de espera", async () => {
  let prompt = "";
  const result = await runChatTurn({
    mensagem: "o hb20 é melhor que o onix?",
    historico: [],
    stock,
    generate: async ({ systemPrompt }) => {
      prompt = systemPrompt;
      return { text: "O HB20 1.6 é mais forte que o Onix 1.0, mas o Onix turbo se aproxima. No estoque agora não tenho o Onix.", functionCall: null };
    },
  });
  assert.equal(result.meta?.policy, "expert");
  assert.match(prompt, /citou onix, que não está no estoque/);
  assert.doesNotMatch(result.reply, /Esse modelo não está na lista atual/);
});

test("pergunta técnica não vaza preço de vendido, cidade da loja nem inventa da unidade", async () => {
  // Civic EXL 2020 vendido: não está no estoque. A ficha do modelo responde, sem preço.
  const sold = await runChatTurn({
    mensagem: "quanto custa e quantos cv tem o Civic EXL 2020?",
    historico: [],
    stock: [hb16, civic15],
    vehicleId: "civic20-vendido",
    generate: noModel,
  });
  assert.doesNotMatch(sold.reply, /R\$|126\.900|74\.900/);
  assert.equal(sold.vehicles.some((vehicle) => vehicle.id === "civic20-vendido"), false);
  // Cidade do veículo só no admin: nem no prompt especialista nem na resposta direta.
  let prompt = "";
  await runChatTurn({
    mensagem: "esse hb20 é bom de manutenção?",
    historico: [],
    stock,
    vehicleId: "hb16",
    generate: async ({ systemPrompt }) => {
      prompt = systemPrompt;
      return { text: "É um carro tranquilo de manter; no estado desta unidade o consultor avalia com você.", functionCall: null };
    },
  });
  assert.doesNotMatch(prompt, /Colatina|locationCity|cidade do veículo:/);
  assert.match(prompt, /Manutenção típica do modelo: motor 1\.6 Gamma/);
  assert.match(prompt, /Manutenção e pontos de atenção são sempre do MODELO, nunca desta unidade/);
  const direct = await runChatTurn({ mensagem: "quantos cv tem o hb20 1.6?", historico: [], stock, generate: noModel });
  assert.doesNotMatch(JSON.stringify(direct), /Colatina|locationCity/);
});

test("B2 troca: Gol G6 2014 com 120 mil km na troca do City não vira pergunta de km do City", async () => {
  let prompt = "";
  const historico = [user("Boa tarde, vocês pegam carro na troca?"), assistant("Aceitamos sim — carro ou moto entram na conta.")];
  const reply = "Dá sim! O seu Gol entra na avaliação para a troca com o City. O consultor avalia com algumas fotos pelo WhatsApp.";
  const result = await runChatTurn({
    mensagem: "Tenho um Gol G6 2014 1.0 com 120 mil km, daria pra usar na troca desse City?",
    historico,
    stock,
    vehicleId: "city",
    generate: async ({ systemPrompt }) => {
      prompt = systemPrompt;
      return { text: reply, functionCall: null };
    },
  });
  assert.equal(result.reply, reply);
  assert.equal(result.meta?.policy, "trade");
  assert.doesNotMatch(result.reply, /76 mil km|hodômetro/);
  assert.match(prompt, /para dar na troca/);
  assert.match(prompt, /NÃO avalie o carro dele/);
  assert.equal(result.vehicles.length, 0);
  // Sem o modelo de linguagem: acolhe a troca e leva ao consultor, sem responder km.
  const offline = await runChatTurn({
    mensagem: "Tenho um Gol G6 2014 1.0 com 120 mil km, daria pra usar na troca desse City?",
    historico,
    stock,
    vehicleId: "city",
    generate: noModel,
  });
  assert.match(offline.reply, /Aceitamos sim/);
  assert.match(offline.reply, /consultor avalia/);
  assert.doesNotMatch(offline.reply, /76 mil km|hodômetro/);
  assert.equal(isTradeInMessage("Tenho um Gol G6 2014 1.0 com 120 mil km, daria pra usar na troca desse City?"), true);
  assert.equal(isTradeInMessage("vocês aceitam troca?"), false);
  assert.equal(isTradeInMessage("quantos km tem esse City?"), false);
});

test("B2 curioso: manutenção e despedida não anexam o bordão do estoque nem cards", async () => {
  const historico: ChatTurn[] = [];
  const first = await runChatTurn({
    mensagem: "esse hb20 é bom de manutenção?",
    historico,
    stock,
    vehicleId: "hb16",
    generate: async () => ({
      text: "É um carro tranquilo de manter: o motor 1.6 Gamma é conhecido e as peças são acessíveis. O câmbio automático pede o óleo em dia.",
      functionCall: null,
    }),
  });
  assert.doesNotMatch(first.reply, /é o mais em conta|um bom começo|tem menos km|R\$/);
  assert.equal(first.vehicles.length, 0, "o carro já está na tela");
  const second = await runChatTurn({
    mensagem: "tô só olhando por enquanto, vlw",
    historico: [user("esse hb20 é bom de manutenção?"), assistant(first.reply)],
    stock,
    vehicleId: "hb16",
    generate: async () => ({ text: "Fica à vontade! O HB20 é um bom carro; quando quiser comparar, é só chamar.", functionCall: null }),
  });
  assert.doesNotMatch(second.reply, /é o mais em conta|R\$ 56\.900|menos km \(/);
  assert.equal(second.vehicles.length, 0);
  assert.equal(isBrowsingOrThanks("tô só olhando por enquanto, vlw"), true);
  assert.equal(isBrowsingOrThanks("quanto custa o hb20?"), false);
});

test("B2 financiamento: a entrada não vira orçamento nem 'modelo não está na lista'", async () => {
  let prompt = "";
  const result = await runChatTurn({
    mensagem: "Quero financiar, consigo dar uns 20 mil de entrada. Como funciona?",
    historico: [],
    stock,
    vehicleId: "city",
    generate: async ({ systemPrompt }) => {
      prompt = systemPrompt;
      return { text: "Dá sim! A entrada de 20 mil ajuda; o consultor monta a simulação no WhatsApp com o City.", functionCall: null };
    },
  });
  assert.doesNotMatch(prompt, /FILTRO DO VISITANTE|até R\$ 20\.000|Nenhum veículo nesta faixa/);
  assert.notEqual(result.meta?.policy, "waitlist");
  assert.doesNotMatch(result.reply, /Esse modelo não está na lista atual/);
  assert.equal(result.meta?.calls, undefined);
});

test("falha do modelo de linguagem: resposta de reserva honesta, sem prefixo robótico", async () => {
  const result = await runChatTurn({
    mensagem: "o gol tem airbag?",
    historico: [],
    stock,
    generate: async () => ({ text: CHAT_FALLBACK_REPLY, functionCall: null }),
  });
  assert.match(result.reply, /airbags e ABS eram opcionais/);
  assert.doesNotMatch(result.reply, robotic);
});

test("segurança de série do modelo não é apagada pelo filtro de equipamentos inventados", async () => {
  const result = await runChatTurn({
    mensagem: "o hb20 1.6 tem abs e airbag?",
    historico: [],
    stock,
    generate: async () => ({
      text: "A versão Premium 1.6 sai de fábrica com ABS e airbags frontais; o que esta unidade tem, o consultor confirma.",
      functionCall: null,
    }),
  });
  assert.match(result.reply, /ABS e airbags frontais/);
});

test("decisão: lista com filtro continua busca; pergunta de ficha e comparação com contexto vão ao especialista", () => {
  const ctx = (mensagem: string, extra: Partial<Parameters<typeof wantsExpertAnswer>[0]> = {}) => ({
    mensagem, historico: [] as ChatTurn[], stock, ...extra,
  });
  assert.equal(wantsExpertAnswer(ctx("quantos cv tem o hb20 1.6?")), true);
  assert.equal(wantsExpertAnswer(ctx("qual o mais forte?")), true);
  assert.equal(wantsExpertAnswer(ctx("qual gasta menos?")), true);
  assert.equal(wantsExpertAnswer(ctx("automático forte até 80 mil")), false);
  assert.equal(wantsExpertAnswer(ctx("quais automáticos mais potentes?")), false);
  assert.equal(wantsExpertAnswer(ctx("quero mais forte", { recorte: "quero mais forte automático até 100 mil" })), false);
  assert.equal(wantsExpertAnswer(ctx("carros até 70 mil")), false);
  assert.equal(wantsExpertAnswer(ctx("Civic vs Corolla")), false, "dois do estoque seguem na comparação de anúncios");
  assert.equal(wantsExpertAnswer(ctx("compara o hb20 com o onix")), true);
  assert.equal(wantsExpertAnswer(ctx("qual o melhor?")), false);
});

test("sujeito da pergunta: nomeado > tela > conversa; ano e motor sem estoque não caem em outro carro", () => {
  const ctx = (mensagem: string, extra: Partial<Parameters<typeof expertSubject>[0]> = {}) => ({
    mensagem, historico: [] as ChatTurn[], stock, ...extra,
  });
  assert.deepEqual(expertSubject(ctx("quantos cv tem o hb20 1.6?")).vehicles.map((x) => x.id), ["hb16"]);
  assert.deepEqual(expertSubject(ctx("quantos cv tem o hb20 2022?")).vehicles.map((x) => x.id), ["hb10"]);
  assert.deepEqual(expertSubject(ctx("quantos cv tem o Civic LXR?")).vehicles.map((x) => x.id), ["civic15"]);
  const wrongYear = expertSubject(ctx("quantos cv tem o hb20 2030?"));
  assert.equal(wrongYear.vehicles.length, 0);
  assert.equal(wrongYear.unmatched?.length, 3);
  assert.deepEqual(expertSubject(ctx("e o torque?", { activeVehicle: city })).vehicles.map((x) => x.id), ["city"]);
  assert.deepEqual(
    expertSubject(ctx("e o torque?", { activeVehicle: city, historico: [user("quantos cv tem o Kicks?")] })).vehicles.map((x) => x.id),
    ["kicks"],
    "a mensagem anterior do visitante manda sobre a tela",
  );
  // "esse hb20" dentro da ficha de um HB20 é o carro da tela.
  assert.deepEqual(expertSubject(ctx("esse hb20 é bom?", { activeVehicle: hb10 })).vehicles.map((x) => x.id), ["hb10"]);
  assert.deepEqual(outsideModelCandidates("compara o hb20 com o onix", stock), ["onix"]);
  assert.deepEqual(outsideModelCandidates("qual a potência do motor e do câmbio do hb20", stock), []);
});

test("texto do modelo: marca corrigida e nada de laudo/revisão/original da unidade chega ao visitante", async () => {
  let prompt = "";
  const result = await runChatTurn({
    mensagem: "o corolla é bom de manutenção?",
    historico: [],
    stock,
    generate: async (input) => {
      prompt = input.systemPrompt;
      return {
        text: "O Honda Corolla é um carro de manutenção tranquila. Esse aqui tem laudo cautelar aprovado e revisões em dia. Quer ver as fotos?",
        functionCall: null,
        model: "gemini-3.5-flash-lite",
        calls: 1,
      };
    },
  });
  assert.match(result.reply, /^O Toyota Corolla é um carro de manutenção tranquila\./);
  assert.doesNotMatch(result.reply, /Honda Corolla|laudo cautelar aprovado|revisões em dia/);
  assert.match(result.reply, /o consultor confirma com a loja pelo WhatsApp/);
  assert.match(result.reply, /Quer ver as fotos\?$/);
  // As regras também vão no prompt, para o modelo nem tentar.
  assert.match(prompt, /AFIRMAÇÕES PROIBIDAS SOBRE A UNIDADE/);
  assert.match(prompt, /MARCA CORRETA/);
});
