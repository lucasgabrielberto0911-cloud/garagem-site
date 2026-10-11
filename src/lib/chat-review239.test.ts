import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "@/lib/chat-turn";
import type { ChatVehicleRecord } from "@/lib/chat-stock";

const car = (id: string, brand: string, model: string, version: string, yearModel: number, price: number, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord =>
  ({ id, brand, model, version, yearModel, km: 80000, price, color: "Prata", transmission: "Automático", fuel: "Flex", category: "carro", ...extra }) as ChatVehicleRecord;

const stock = [
  car("k", "Nissan", "Kicks", "SL 1.6 Flex Start XTRONIC", 2019, 86900),
  car("h", "Honda", "HR-V", "EXL 1.8 Flexone", 2016, 84900),
  car("g", "Volkswagen", "Gol", "Trend 1.0 Completo", 2012, 32900, {
    transmission: "Manual",
    accessories: ["Central multimídia", "ABS", "Ar-condicionado"],
  }),
  car("m", "Fiat", "Mobi", "Like 1.0 Fire EVO Flex", 2024, 57900, {
    transmission: "Manual",
    accessories: ["Ar-condicionado", "Direção hidráulica", "Vidros elétricos dianteiros com função one-touch e antiesmagamento", "nas 4 portas", "completo"],
  }),
];
const noReading = async () => null;

test("Kicks x HR-V 'qual você indica?' vai ao especialista mesmo com 'até 70 mil' no histórico", async () => {
  let called = false;
  const result = await runChatTurn({
    mensagem: "entre o Kicks e o HR-V, qual você indica?",
    historico: [
      { role: "user", content: "tem automático até 70 mil?" },
      { role: "assistant", content: "Olha o que tenho de carros automáticos, até R$ 70.000." },
    ],
    stock,
    readIntent: noReading,
    generate: async () => {
      called = true;
      return { text: "O Kicks é ótimo pra quem quer economia; o HR-V pra quem quer mais espaço.", functionCall: null };
    },
  });
  assert.equal(called, true, `${result.meta?.policy}: ${result.reply}`);
  assert.notEqual(result.meta?.policy, "inventory-empty");
  assert.match(result.reply, /Kicks/);
});

test("opcional ausente mantém o nome do item e não afirma que tem", async () => {
  const result = await runChatTurn({ mensagem: "esse Mobi tem central multimídia?", historico: [], stock, vehicleId: "m", readIntent: noReading, generate: async () => { throw new Error("não deveria gerar"); } });
  assert.match(result.reply, /não consta central multimídia/);
  assert.doesNotMatch(result.reply, /, dianteiros|nas 4 portas|completo/);
  assert.match(result.reply, /Vidros elétricos dianteiros/);
});

test("'e airbag e ABS, tem?' no carro em tela: ABS consta, airbag não aparece, sem chamar o modelo", async () => {
  const result = await runChatTurn({
    mensagem: "e airbag e ABS, tem?",
    historico: [
      { role: "user", content: "esse Gol tem teto solar?" },
      { role: "assistant", content: "Na ficha desse Gol não consta teto solar." },
    ],
    stock,
    vehicleId: "g",
    readIntent: noReading,
    generate: async () => { throw new Error("não deveria gerar"); },
  });
  assert.equal(result.meta?.policy, "stock-fact");
  assert.match(result.reply, /constam freios ABS/);
  assert.match(result.reply, /Airbags não aparecem/i);
  assert.doesNotMatch(result.reply, /tem airbag|com airbag/i);
});

test("link do WhatsApp da loja no histórico não conta como telefone de lead", async () => {
  const { chatTurnMayCreateLead } = await import("@/lib/chat-guard");
  const historico = [
    { role: "user", content: "esse Gol tem teto solar?" },
    { role: "assistant", content: "Na ficha desse Gol não consta teto solar. O vendedor confirma no WhatsApp: https://wa.me/5527996330706" },
  ];
  assert.equal(chatTurnMayCreateLead("e airbag e ABS, tem?", historico), false);
  assert.equal(chatTurnMayCreateLead("meu zap é 27 99988-7766", historico), true);
});

test("com cards na tela, a comparação por perfil continua na bolha", async () => {
  const { polishChatReplyWithCards } = await import("@/lib/chat-cards");
  const cards = [
    { id: "k", brand: "Nissan", model: "Kicks", version: "SL", year: 2019, km: 78000, price: 86900, title: "Nissan Kicks" },
    { id: "h", brand: "Honda", model: "HR-V", version: "EXL", year: 2016, km: 103000, price: 84900, title: "Honda HR-V" },
  ] as never;
  const text = "Os dois são ótimas escolhas.\n\nO Nissan Kicks SL 2019 é ótimo pra quem quer economia e conforto.\nO Honda HR-V EXL 2016 é ideal pra quem quer mais espaço.\nNissan Kicks SL 2019 · 78.000 km · R$ 86.900";
  const out = polishChatReplyWithCards(text, cards);
  assert.match(out, /Kicks SL 2019 é ótimo/);
  assert.match(out, /HR-V EXL 2016 é ideal/);
  assert.doesNotMatch(out, /R\$ 86\.900/);
});

test("sem a URL do WhatsApp, a frase não termina pendurada em 'lá em'", async () => {
  const { displayChatText } = await import("@/lib/chat-text");
  assert.equal(
    displayChatText("O consultor faz a avaliação pelo WhatsApp, é só chamar lá em https://wa.me/5527996330706"),
    "O consultor faz a avaliação pelo WhatsApp, é só chamar.",
  );
});

test("link do WhatsApp no meio da frase leva o conector junto", async () => {
  const { displayChatText } = await import("@/lib/chat-text");
  assert.equal(
    displayChatText("A avaliação a gente alinha com o consultor no WhatsApp, é só chamar lá em https://wa.me/5527996330706 que ele te ajuda com tudo."),
    "A avaliação a gente alinha com o consultor no WhatsApp, é só chamar que ele te ajuda com tudo.",
  );
});

test("frase que termina em 'WhatsApp: <link>' fecha com ponto", async () => {
  const { displayChatText } = await import("@/lib/chat-text");
  assert.equal(
    displayChatText("Pra não te passar informação errada, o vendedor confirma pelas fotos ou no WhatsApp: https://wa.me/5527996330706"),
    "Pra não te passar informação errada, o vendedor confirma pelas fotos ou no WhatsApp.",
  );
});

test("'e de consumo, o Civic?' segue o Civic 2020 citado antes, sem listar o outro Civic", async () => {
  const civics = [
    ...stock,
    car("c20", "Honda", "Civic", "EXL 2.0 Flexone CVT", 2020, 109900),
    car("c15", "Honda", "Civic", "LXR 2.0 Flexone", 2015, 69900),
  ];
  const result = await runChatTurn({
    mensagem: "e de consumo, o Civic?",
    historico: [
      { role: "user", content: "e o Civic 2020, faz 0 a 100 em quanto?" },
      { role: "assistant", content: "O Civic 2.0 faz o 0 a 100 km/h em cerca de 10,9 segundos." },
    ],
    stock: civics,
    readIntent: noReading,
    generate: async () => ({ text: "O Civic 2020 faz cerca de 10 km/l na cidade.", functionCall: null }),
  });
  assert.doesNotMatch(result.reply, /2015/, result.reply);
});

test("carro do estoque citado pelo nome, fora da ficha: opcional sai da ficha dele, sem chamar o modelo", async () => {
  const fichaStock = [
    ...stock,
    car("c", "Honda", "City", "EXL 1.5 CVT I-VTEC", 2018, 84900, { accessories: ["Câmera de ré", "6 airbags (frontais, laterais e de cortina)", "Freios ABS"] }),
    car("k2", "Nissan", "Kicks", "S 1.6", 2017, 69900, { accessories: ["ABS"] }),
  ].map(v => v.id === "k" ? { ...v, accessories: ["ABS", "6 Air Bags"] } : v);
  const ask = (mensagem: string) => runChatTurn({ mensagem, historico: [], stock: fichaStock, readIntent: noReading, generate: async () => { throw new Error("não deveria gerar"); } });
  const city = await ask("O City EXL 2018 tem airbags laterais?");
  assert.equal(city.meta?.policy, "stock-fact");
  assert.match(city.reply, /Sim, na ficha desse City constam 6 airbags \(frontais, laterais e de cortina\)/);
  // Duas unidades de Kicks: o ano escolhe a certa; a posição não citada na ficha não é afirmada.
  const kicks = await ask("O Kicks 2019 de vocês tem airbags de cortina?");
  assert.equal(kicks.meta?.policy, "stock-fact");
  assert.match(kicks.reply, /^Na ficha desse Kicks constam 6 airbags\. A ficha não detalha se há airbags de cortina\./);
  assert.match(kicks.reply, /vendedor confirma/);
});

test("nome ambíguo (duas unidades sem ano) não escolhe uma ficha por conta própria", async () => {
  const { namedUnitForEquipment } = await import("@/lib/chat-stock");
  const two = [...stock, car("k2", "Nissan", "Kicks", "S 1.6", 2017, 69900)];
  assert.equal(namedUnitForEquipment(two, "o Kicks tem airbag?"), null);
  assert.equal(namedUnitForEquipment(two, "o Kicks 2017 tem airbag?")?.id, "k2");
  assert.equal(namedUnitForEquipment(two, "o Kicks SL tem airbag?")?.id, "k");
  assert.equal(namedUnitForEquipment(two, "quais carros têm airbag?"), null);
  assert.equal(namedUnitForEquipment(two, "qual o consumo do Gol?"), null);
});
