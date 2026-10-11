import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "@/lib/chat-turn";
import { parseTransmissionFilter, type ChatVehicleRecord } from "@/lib/chat-stock";

const car = (id: string, brand: string, model: string, version: string, yearModel: number, price: number, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord =>
  ({ id, brand, model, version, yearModel, km: 60000, price, color: "Prata", transmission: "Automático", fuel: "Flex", engine: "1.0", category: "carro", ...extra }) as ChatVehicleRecord;

const stock = [
  car("nivus", "Volkswagen", "NIVUS", "HIGHLINE TSI", 2021, 104900, { accessories: ["Multimídia", "Piloto automático", "Bancos de couro", "Câmera de ré"] }),
  car("civic", "Honda", "Civic", "EXL 2.0", 2020, 126900, { engine: "2.0", accessories: ["Bancos com revestimento premium em couro", "Sensores de estacionamento dianteiros e traseiros", "Controle de tração e estabilidade (VSA)", "Central multimídia touchscreen"] }),
  car("gol", "Volkswagen", "Gol", "Trend 1.0", 2012, 32900, { transmission: "Manual", accessories: ["Direção hidráulica", "Ar-condicionado", "Central multimídia"] }),
  car("palio", "Fiat", "Palio", "Celebration 1.0", 2008, 24900, { transmission: "Manual", km: 190000, accessories: ["Ar-condicionado", "Vidros elétricos dianteiros"] }),
  car("weekend", "Fiat", "Palio Weekend", "Adventure 1.8", 2016, 47900, { transmission: "Manual", km: 156400, engine: "1.8", accessories: ["Bluetooth", "Ar-condicionado"] }),
  car("hb", "Hyundai", "HB20", "evolution 1.0", 2022, 64900, { transmission: "Manual", accessories: ["Direção elétrica", "Multimídia", "Ar-condicionado"] }),
];
const ask = (mensagem: string, vehicleId?: string) =>
  runChatTurn({ mensagem, historico: [], stock, vehicleId, readIntent: async () => null, generate: async () => ({ text: "Posso ajudar.", functionCall: null }) as never });

test("'piloto automático' é opcional, não câmbio", async () => {
  assert.equal(parseTransmissionFilter("o Nivus tem piloto automático?"), null);
  const nivus = await ask("o Nivus tem piloto automatico?");
  assert.match(nivus.reply, /consta piloto automático/);
  assert.doesNotMatch(nivus.reply, /é Automático/);
});

test("novos opcionais respondem pela ficha, com o nome certo e concordância", async () => {
  assert.match((await ask("o hb20 2022 tem direção elétrica?")).reply, /Sim, na ficha desse HB20 .*consta direção elétrica\./);
  assert.match((await ask("o Civic tem banco de couro?")).reply, /constam bancos de couro\./);
  assert.match((await ask("o Civic tem sensor de estacionamento?")).reply, /constam sensores de estacionamento/);
  assert.match((await ask("o Civic tem controle de estabilidade?")).reply, /consta controle de estabilidade\./);
  assert.match((await ask("o Gol tem direção elétrica?")).reply, /consta direção hidráulica/);
});

test("modelo escrito por inteiro: Palio Weekend não vira Palio", async () => {
  assert.match((await ask("o Palio Weekend tem quantos km?")).reply, /Palio Weekend.*156 mil km/);
  const bt = await ask("o Palio Weekend tem bluetooth?");
  assert.match(bt.reply, /consta bluetooth/i);
});

test("opcional + critério subjetivo (econômico, barato) ordena os que têm o item", async () => {
  const cheap = await ask("qual carro de vcs tem ar condicionado e é barato?");
  assert.match(cheap.reply, /Temos 4 carros com ar-condicionado na ficha, separei os mais em conta/);
  assert.equal(cheap.vehicles[0]?.model, "Palio");
  const eco = await ask("carro econômico com multimídia");
  assert.match(eco.reply, /^Temos 4 carros com central multimídia na ficha/);
  assert.ok(eco.vehicles.length > 0 && eco.vehicles.length <= 3);
});
