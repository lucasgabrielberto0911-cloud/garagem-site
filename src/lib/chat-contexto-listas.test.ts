import assert from "node:assert/strict";
import { test } from "node:test";
import { runChatTurn } from "./chat-turn";
import { chatPolicyShortcut, pickComparedModelVehicles, seeksMissingNamedModel, type ChatVehicleRecord } from "./chat-stock";
import { findVehicleSpec, specMaxCv } from "./chat-specs";

const stock: ChatVehicleRecord[] = [
  {
    "id": "cmsgv18dy0000l204bn1cwvkb",
    "brand": "Mitsubishi",
    "model": "LANCER",
    "version": "2.0 Automatico",
    "yearModel": 2014,
    "km": 80000,
    "price": 62900,
    "color": "Cinza",
    "transmission": "Automático",
    "fuel": "Gasolina",
    "category": "carro",
    "engine": "2.0 160cv"
  },
  {
    "id": "cmshu67mo0000la04hhc9jp7v",
    "brand": "Hyundai",
    "model": "HB20",
    "version": "evolution 1.0",
    "yearModel": 2022,
    "km": 68450,
    "price": 64900,
    "color": "Prata",
    "transmission": "Manual",
    "fuel": "Flex",
    "category": "carro",
    "engine": "1.0 Aspirado"
  },
  {
    "id": "cmsnsjelx0000la04wxu40b89",
    "brand": "Nissan",
    "model": "Kicks",
    "version": "SL 1.6 Flex Start XTRONIC",
    "yearModel": 2019,
    "km": 78000,
    "price": 86900,
    "color": "Cinza",
    "transmission": "Automático",
    "fuel": "Flex",
    "category": "carro",
    "engine": "1.6 Aspirado"
  },
  {
    "id": "cmspcwa280000l404659usfgr",
    "brand": "Hyundai",
    "model": "HB20",
    "version": "Premium Automatico 1.6",
    "yearModel": 2015,
    "km": 127300,
    "price": 56900,
    "color": "Branco",
    "transmission": "Automático",
    "fuel": "Flex",
    "category": "carro",
    "engine": "1.6 Aspirado"
  },
  {
    "id": "cmsrx7hnl0000l704p133ruvi",
    "brand": "Hyundai",
    "model": "HB20S",
    "version": "Comfort Plus 1.0 TB Flex 12V",
    "yearModel": 2024,
    "km": 50000,
    "price": 87900,
    "color": "Prata",
    "transmission": "Automático",
    "fuel": "Flex",
    "category": "carro",
    "engine": "1.0 TGDI"
  },
  {
    "id": "cmtrkwmer0000ky04r6wwpwsv",
    "brand": "Honda",
    "model": "BIZ 125",
    "version": "EX 125 FLEX",
    "yearModel": 2023,
    "km": 22000,
    "price": 14900,
    "color": "Branca",
    "transmission": "Semi-automático",
    "fuel": "Flex",
    "category": "moto",
    "engine": "125cc"
  },
  {
    "id": "cmu3arws10000l2041a9hwcx5",
    "brand": "Fiat",
    "model": "Mobi",
    "version": "Like 1.0 Fire EVO Flex",
    "yearModel": 2024,
    "km": 75700,
    "price": 57900,
    "color": "Branco",
    "transmission": "Manual",
    "fuel": "Flex",
    "category": "carro",
    "engine": "1.0 Fire"
  },
  {
    "id": "cmu4sgkfz0000js04037q4n51",
    "brand": "Honda",
    "model": "Civic",
    "version": "EXL 2.0 FLEX 16v",
    "yearModel": 2020,
    "km": 65000,
    "price": 126900,
    "color": "Azul Meia-Noite",
    "transmission": "Automático",
    "fuel": "Flex",
    "category": "carro",
    "engine": "2.0 FLEX I-VTEC",
    "accessories": [
      "Câmbio borboleta (Paddle Shift) atrás do volante para trocas de marcha",
      "Bancos com revestimento premium em couro",
      "Painel de instrumentos digital em tela TFT de 7\" em alta resolução",
      "Central multimídia touchscreen de 7\" com Apple CarPlay, Android Auto e GPS integ",
      "Ar-condicionado digital automático Dual Zone (duas zonas de temperatura)",
      "Freio de estacionamento eletrônico (EPB) com função Brake Hold",
      "Chave presencial (Smart Entry) com partida no botão Start/Stop",
      "Piloto automático (cruise control)",
      "Faróis com acendimento automático (sensor crepuscular) e DRL em LED",
      "Faróis de neblina",
      "Retrovisores elétricos com rebatimento automático e repetidores em LED",
      "Rodas de liga leve diamantadas aro 17\"",
      "Volante multifuncional com ajuste de altura e profundidade",
      "Câmera de ré multivisão com guias dinâmicas",
      "Sensores de estacionamento dianteiros e traseiros",
      "6 Airbags (frontais, laterais e de cortina)",
      "Controle de tração e estabilidade (VSA)",
      "Assistente de partida em rampas (HSA)",
      "Assistente de dirigibilidade ágil (AHA - Agile Handling Assist)",
      "Freios a disco nas 4 rodas com ABS e EBD",
      "Sistema de fixação ISOFIX para cadeirinhas infantis",
      "Monitoramento indireto de pressão dos pneus (TPMS)"
    ]
  },
  {
    "id": "cmu610q770000l8049nvddb5k",
    "brand": "Honda",
    "model": "BIZ",
    "version": "110i EX",
    "yearModel": 2023,
    "km": 3200,
    "price": 15200,
    "color": "Branca",
    "transmission": "Semi-automático",
    "fuel": "Gasolina",
    "category": "moto",
    "engine": "110cc"
  },
  {
    "id": "cmubrhzwf0000l304geveibp1",
    "brand": "Honda",
    "model": "Civic",
    "version": "LXR 2.0 FlexOne",
    "yearModel": 2015,
    "km": 106000,
    "price": 74900,
    "color": "Prata",
    "transmission": "Automático",
    "fuel": "Flex",
    "category": "carro",
    "engine": "2.0 FlexOne I-VTEC",
    "accessories": [
      "Ar-condicionado digital",
      "Direção hidráulica",
      "Bancos em couro",
      "Piloto automático",
      "Troca de marchas no volante (paddle shift)",
      "Vidros elétricos nas 4 portas",
      "Travas elétricas",
      "Retrovisores elétricos",
      "Volante multifuncional com regulagem de altura e profundidade",
      "Rodas de liga leve",
      "Faróis de neblina",
      "Faróis com acendimento automático",
      "Computador de bordo",
      "Som com USB, Bluetooth e CD",
      "Sensor de estacionamento",
      "Câmera de ré",
      "Freios ABS com EBD",
      "Alarme",
      "Isofix"
    ]
  },
  {
    "id": "cmud192iz0000l6041ewv0ki6",
    "brand": "Honda",
    "model": "HR-V",
    "version": "EXL 1.8 Flexone",
    "yearModel": 2016,
    "km": 103000,
    "price": 84900,
    "color": "Prata",
    "transmission": "Automático",
    "fuel": "Flex",
    "category": "carro",
    "engine": "1.8 FlexOne 16V"
  },
  {
    "id": "cmuobm8ka0000jg04pe8ybs5n",
    "brand": "Renault",
    "model": "Duster",
    "version": "Dynamique 2.0 16V Tech Road 2",
    "yearModel": 2014,
    "km": 101000,
    "price": 54900,
    "color": "Prata",
    "transmission": "Automático",
    "fuel": "Flex",
    "category": "carro",
    "engine": "2.0 16V Hi-Flex"
  },
  {
    "id": "cmuqzvj310000l704vrrt6ijm",
    "brand": "Ford",
    "model": "KA SEDAN",
    "version": "SE AUTOMATICO 1.5",
    "yearModel": 2019,
    "km": 100000,
    "price": 49990,
    "color": "Branco",
    "transmission": "Automático",
    "fuel": "Flex",
    "category": "carro",
    "engine": "1.5 TI-CDT"
  }
];
async function ask(mensagem: string, vehicleId?: string) {
  return runChatTurn({ mensagem, vehicleId, stock, historico: [], readIntent: async () => null,
    generate: async () => ({ text: "Resposta do modelo sobre a política.", functionCall: null }) as never });
}
test("lista de automáticos respeita câmbio e teto, sem modelo ausente", async () => {
  for (const word of ["automaticos", "automáticas"]) {
    const message = `quais ${word} ate 80 mil vcs tem no estoque?`;
    assert.equal(seeksMissingNamedModel(message, stock), false);
    const result = await ask(message);
    assert.equal(result.vehicles.length, 3);
    assert.doesNotMatch(result.reply, /não está na lista/i);
    for (const card of result.vehicles) {
      const unit = stock.find(vehicle => vehicle.id === card.id)!;
      assert.match(unit.transmission!, /autom/i);
      assert.ok(unit.price <= 80000);
    }
  }
});
for (const message of ["civic ou lancer, qual anda mais?", "biz 125 ou biz 110i qual anda mais?", "hb20 1.6 ou kicks, qual anda mais?"]) {
  test(message, async () => {
    const units = pickComparedModelVehicles(stock, message);
    assert.equal(units.length, 2);
    const result = await ask(message);
    for (const unit of units) {
      const cv = specMaxCv(findVehicleSpec(unit)!);
      if (cv >= 90) assert.ok(result.reply.includes(`${cv.toLocaleString("pt-BR")} cv`));
      else assert.doesNotMatch(result.reply, /\bcv\b/);
    }
    assert.match(result.reply, /ótimas escolhas/);
    assert.equal(result.vehicles.length, 2);
  });
}
test("viagem usa os porta-malas da base", async () => {
  const result = await ask("qual e melhor pra viajar: hrv ou duster?");
  for (const unit of pickComparedModelVehicles(stock, "hrv ou duster")) assert.ok(result.reply.includes(`${findVehicleSpec(unit)!.portaMalas} L`));
});
test("compara duas unidades do Civic por ano e versão", async () => {
  const result = await ask("entre o civic 2020 e o civic 2015 qual vale mais a pena?");
  assert.equal(result.vehicles.length, 2);
  assert.match(result.reply, /2020/); assert.match(result.reply, /2015/);
  assert.equal(pickComparedModelVehicles(stock, "civic exl ou civic lxr").length, 2);
});
test("motor pedido pertence ao lado correto da comparação", async () => {
  const result = await ask("hb20 1.0 ou mobi like, qual o melhor pro dia a dia?");
  const hb = result.vehicles.map(card => stock.find(unit => unit.id === card.id)!).find(unit => /hb20/i.test(unit.model))!;
  assert.match(hb.version!, /1\.0/);
});
test("revisão não vira frete, seguro segue para o modelo e garantia conserva política", async () => {
  const message = "revisao e manutencao preventiva voces entregam feita?";
  assert.notEqual(chatPolicyShortcut(message), "delivery");
  const review = await ask(message); assert.equal(review.meta?.policy, "maintenance"); assert.equal(review.vehicles.length, 0);
  const insurance = await ask("o carro ja vem com seguro ou tenho que contratar por fora?");
  assert.match(insurance.reply, /Resposta do modelo/); assert.equal(insurance.vehicles.length, 0);
  const civic = stock.find(unit => /civic/i.test(unit.model) && unit.yearModel === 2015)!;
  const warranty = await ask("esse carro tem garantia de cambio e motor?", civic.id);
  assert.match(warranty.reply, /garantia comercial/); assert.doesNotMatch(warranty.reply, /destaques|bem equipado/);
});
test("pergunta de defeito nunca abre com 'É, sim'", async () => {
  for (const message of ["o lancer da pobrema?", "lancer da muito defeito?", "a duster da dor de cabeca?"]) {
    const result = await ask(message);
    assert.doesNotMatch(result.reply, /^É, sim/);
    assert.match(result.reply, /^Pode ficar tranquilo/);
  }
});
