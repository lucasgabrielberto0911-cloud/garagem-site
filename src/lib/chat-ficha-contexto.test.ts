import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "@/lib/chat-turn";
import { asksForFichaSummary, equipmentAcrossStockReply, type ChatVehicleRecord } from "@/lib/chat-stock";
import fichas from "./__fixtures__/estoque-fichas.json";

// Casos achados pelo Lucas na ficha do Civic LXR 2015 (11/10/2026), com o estoque real.
const stock = fichas as unknown as ChatVehicleRecord[];
const LXR = "cmubrhzwf0000l304geveibp1";
const EXL = "cmu4sgkfz0000js04037q4n51";
const GOL = "cmux8br7n0000l004rmqr3y77";
const PALIO = "cmu1g23pu0000l504mzurjecm";
const noLlm = async () => { throw new Error("não deveria chamar o modelo"); };
const ask = (mensagem: string, vehicleId?: string) =>
  runChatTurn({ mensagem, historico: [], stock, vehicleId, readIntent: async () => null, generate: noLlm });

test("Civic LXR: troca de marchas no volante (e sinônimos) é confirmada pela ficha, só com o card dele", async () => {
  for (const question of [
    "Tem troca de marcha no volante?",
    "tem borboleta?",
    "tem borboletas no volante?",
    "tem aletas atrás do volante?",
    "tem paddle shift?",
    "dá pra trocar marcha no volante?",
    "ele tem troca de marchas no volante?",
  ]) {
    const turn = await ask(question, LXR);
    assert.match(turn.reply, /^Sim, na ficha desse Civic LXR 2015 consta troca de marchas no volante \(paddle shift\)/, question);
    assert.doesNotMatch(turn.reply, /CVT|conversor de torque|n[ãa]o (?:consta|est[áa])/i, question);
    assert.deepEqual(turn.vehicles.map(v => v.id), [LXR], question);
  }
});

test("Civic LXR: 'o que ele tem?' vira resumo organizado da ficha dele, nunca o EXL 2020", async () => {
  for (const question of [
    "O que ele tem de equipamento?",
    "quais os opcionais dele?",
    "o que vem nesse carro?",
    "ele é completo?",
    "quais itens esse tem?",
    "o que esse carro tem?",
    "tem o que de opcional?",
  ]) {
    const turn = await ask(question, LXR);
    assert.match(turn.reply, /Civic LXR 2015/, question);
    assert.match(turn.reply, /• Conforto: .*bancos em couro/, question);
    assert.match(turn.reply, /• Segurança: .*câmera de ré/, question);
    assert.match(turn.reply, /troca de marchas no volante/, question);
    assert.doesNotMatch(turn.reply, /EXL|2020|CarPlay|Dual Zone|6 Airbags/i, question);
    assert.deepEqual(turn.vehicles.map(v => v.id), [LXR], question);
  }
});

test("item fora da ficha não é afirmado", async () => {
  const gol = await ask("tem câmera de ré?", GOL);
  assert.match(gol.reply, /n[ãa]o consta/);
  assert.doesNotMatch(gol.reply, /^Sim/);
  const palio = await ask("tem borboleta?", PALIO);
  assert.match(palio.reply, /n[ãa]o consta troca de marchas no volante/);
  assert.deepEqual(palio.vehicles.map(v => v.id), [PALIO]);
});

test("câmbio continua com a resposta técnica coerente com a ficha", async () => {
  const cambio = await ask("qual o câmbio dele?", LXR);
  assert.match(cambio.reply, /autom[áa]tic/i);
  assert.doesNotMatch(cambio.reply, /\bCVT\b/);
  assert.equal(asksForFichaSummary("quantas marchas ele tem?"), false);
});

test("fora da ficha, 'o Civic tem borboleta?' responde por unidade", () => {
  const out = equipmentAcrossStockReply(stock, "o Civic tem borboleta?");
  assert.ok(out);
  assert.match(out.reply, /Temos 2 Civic/);
  assert.match(out.reply, /troca de marchas no volante/);
  assert.deepEqual(out.vehicles.map(v => v.id).sort(), [EXL, LXR].sort());
});

test("detector do resumo não pega pedido de outros carros, preço ou defeito", () => {
  for (const q of ["tem outros parecidos?", "o que tem de carro até 50 mil?", "qual o valor?", "ele tem algum defeito?", "aceita troca?"]) {
    assert.equal(asksForFichaSummary(q), false, q);
  }
  for (const q of ["o que ele tem?", "quais os opcionais?", "é completo?", "o que vem nela?", "tem o que de equipamento?"]) {
    assert.equal(asksForFichaSummary(q), true, q);
  }
});
