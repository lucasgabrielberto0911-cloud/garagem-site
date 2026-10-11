import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "@/lib/chat-turn";
import { equipmentAcrossStockReply, formatFocusedEquipmentReply, type ChatVehicleRecord } from "@/lib/chat-stock";
import { guardNegativeEquipmentClaims, NEGATIVE_EQUIPMENT_REPLACEMENT } from "@/lib/chat-claims";

// Regra absoluta do Lucas: o chat nunca nega um opcional que o carro tem na ficha.
const NEGATIVE = /\bn[ãa]o (?:consta|constam|aparece|aparecem|tem|temos|possui)\b|\bnenhum[a]?\b|\bsem (?:airbag|abs|c[âa]mera|multim[íi]dia|teto)/i;

const car = (id: string, brand: string, model: string, version: string, yearModel: number, price: number, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord =>
  ({ id, brand, model, version, yearModel, km: 60000, price, color: "Prata", transmission: "Automático", fuel: "Flex", category: "carro", ...extra }) as ChatVehicleRecord;

const stock = [
  car("kicks", "Nissan", "Kicks", "SL 1.6 Flex Start XTRONIC", 2019, 86900, { transmission: "CVT", accessories: ["Camera 360 (Around View Monitor)", "6 Air Bags", "Apple CarPlay / Android Auto", "ABS", "Controle de estabilidade"] }),
  car("hrv", "Honda", "HR-V", "EXL 1.8 Flexone", 2016, 84900, { transmission: "CVT", accessories: ["Câmera de ré multivisão", "Airbags frontais e laterais", "Central multimídia", "Teto panorâmico"] }),
  car("hb", "Hyundai", "HB20", "Premium 1.6", 2015, 56900, { accessories: ["Tela touch 7\"", "Airbag duplo", "Sistema de freios antitravamento"] }),
  // Item dentro de frase longa: a limpeza de exibição corta "nas 4 rodas com ABS", a conferência não.
  car("civic", "Honda", "Civic", "EXL 2.0", 2020, 126900, { accessories: ["Freios a disco nas 4 rodas com ABS e EBD", "Ar-condicionado digital com função dual zone"] }),
  car("gol", "Volkswagen", "Gol", "Trend 1.0", 2012, 32900, { transmission: "Manual", accessories: ["Bolsas infláveis frontais", "Kit multimídia", "VDC"] }),
  car("palio", "Fiat", "Palio", "Celebration 1.0", 2008, 24900, { transmission: "Manual", accessories: [] }),
  car("ka", "Ford", "KA SEDAN", "SE 1.5", 2019, 49990, { accessories: ["Câmera traseira", "Airbag duplo"] }),
  car("duster", "Renault", "Duster", "Dynamique 2.0", 2014, 54900, { accessories: ["Media Nav 7\" com GPS, rádio, Bluetooth e USB", "Airbags frontais duplos", "Barras de teto"] }),
];
const noModel = async () => { throw new Error("não deveria gerar"); };
const ask = (mensagem: string, vehicleId?: string, generate: Parameters<typeof runChatTurn>[0]["generate"] = noModel) =>
  runChatTurn({ mensagem, historico: [], stock, vehicleId, readIntent: async () => null, generate });

const QUESTIONS: Array<[string, RegExp]> = [
  ["tem airbag?", /air ?bag|bolsas? infl/i],
  ["tem ABS?", /\babs\b|antitravamento/i],
  ["tem câmera de ré?", /c[âa]mera/i],
  ["tem multimídia?", /multim[íi]dia|carplay|tela touch|media nav/i],
  ["tem teto solar?", /teto (?:solar|panor)/i],
  ["tem controle de estabilidade?", /estabilidade|\bvdc\b/i],
];

test("na página do carro: item que está na ficha (com qualquer grafia) nunca é negado", async () => {
  for (const vehicle of stock) {
    for (const [question, inFicha] of QUESTIONS) {
      if (!(vehicle.accessories ?? []).some(item => inFicha.test(item))) continue;
      const direct = formatFocusedEquipmentReply(vehicle, question, stock);
      assert.doesNotMatch(direct, NEGATIVE, `${vehicle.model} / ${question}: ${direct}`);
      const turn = await ask(question, vehicle.id);
      assert.doesNotMatch(turn.reply, NEGATIVE, `${vehicle.model} / ${question}: ${turn.reply}`);
    }
  }
});

test("pelo nome, fora da página: item da ficha nunca é negado", async () => {
  for (const [question, name] of [["O Kicks tem câmera de ré?", "Kicks"], ["o Ka Sedan tem câmera de ré?", "Ka"], ["o Gol tem airbag?", "Gol"], ["o HR-V tem teto solar?", "HR-V"], ["o HB20 tem ABS?", "HB20"]]) {
    const turn = await ask(question!);
    assert.doesNotMatch(turn.reply, NEGATIVE, `${name}: ${turn.reply}`);
  }
});

test("ficha com outro nome para o item: responde com o nome da ficha, sem palavra cortada", async () => {
  const duster = await ask("a Duster tem multimídia?");
  assert.match(duster.reply, /consta Media Nav 7" com GPS\./);
  assert.doesNotMatch(duster.reply, /central \./);
  const gol = stock.find(v => v.id === "gol")!;
  assert.match(formatFocusedEquipmentReply(gol, "tem controle de estabilidade?", stock), /consta VDC/);
  assert.doesNotMatch((await ask("o Gol tem controle de estabilidade?")).reply, NEGATIVE);
});

test("ficha vazia: não nega, oferece confirmar com o vendedor", async () => {
  const palio = stock.find(v => v.id === "palio")!;
  const reply = formatFocusedEquipmentReply(palio, "tem airbag?", stock);
  assert.doesNotMatch(reply, NEGATIVE);
  assert.match(reply, /vendedor confirma/);
  const turn = await ask("tem ar-condicionado?", "palio");
  assert.doesNotMatch(turn.reply, NEGATIVE);
});

test("busca no estoque com filtro: conta os carros que têm o item, sem negar", async () => {
  const suv = await ask("tem SUV com câmera de ré?");
  assert.equal(suv.meta?.policy, "stock-equipment");
  assert.match(suv.reply, /^Temos 2 SUVs com câmera de ré na ficha/);
  assert.deepEqual(suv.vehicles.map(v => v.id).sort(), ["hrv", "kicks"]);
  assert.doesNotMatch(suv.reply, NEGATIVE);
  const cheap = await ask("carros até 60 mil com multimídia");
  assert.match(cheap.reply, /^Temos 3 carros até R\$ 60\.000 com central multimídia na ficha/);
  assert.deepEqual(cheap.vehicles.map(v => v.id).sort(), ["duster", "gol", "hb"]);
  const auto = await ask("automático com airbag");
  assert.match(auto.reply, /^Temos 5 carros automáticos com airbags na ficha, separei os destaques\. Quer que eu filtre por preço ou tipo\?$/);
  assert.equal(auto.vehicles.length, 3);
  assert.doesNotMatch(auto.reply, /Kicks|HR-V|HB20|Ka/);
});

test("'nenhum' só quando TODAS as fichas do recorte foram checadas", () => {
  // Manuais: Gol (ficha cheia, sem teto) e Palio (ficha vazia) → não pode dizer "nenhum".
  const unsure = equipmentAcrossStockReply(stock, "carro manual com teto solar");
  assert.ok(unsure);
  assert.doesNotMatch(unsure.reply, NEGATIVE);
  assert.match(unsure.reply, /vendedor confirma/);
  // Sem a ficha vazia, todas checadas: aí pode dizer que não aparece, e mostra a alternativa que tem.
  const checked = equipmentAcrossStockReply(stock.filter(v => v.id !== "palio"), "carro manual com teto solar");
  assert.ok(checked);
  assert.match(checked.reply, /não aparece na ficha/);
  assert.match(checked.reply, /HR-V 2016/);
});

test("resposta do modelo que nega item da ficha de algum carro vira confirmação com o vendedor", async () => {
  const llm = "Olha, no momento a gente não tem nenhuma SUV com câmera de ré cadastrada no estoque. O Kicks é ótimo.";
  const guarded = guardNegativeEquipmentClaims(llm, stock);
  assert.doesNotMatch(guarded, /não tem nenhuma SUV/);
  assert.match(guarded, new RegExp(NEGATIVE_EQUIPMENT_REPLACEMENT.slice(0, 30)));
  assert.match(guarded, /O Kicks é ótimo/);
  // Item que nenhum carro tem na ficha: a negação honesta continua.
  const honest = "Nenhum carro tem isofix cadastrado.";
  assert.equal(guardNegativeEquipmentClaims(honest, stock), honest);
  // Pelo fluxo completo do chat (pergunta subjetiva, que vai ao modelo).
  const turn = await ask("qual SUV econômico vocês indicam com câmera de ré?", undefined, async () => ({ text: llm, functionCall: null }));
  assert.doesNotMatch(turn.reply, /não tem nenhuma SUV com câmera/);
});
