import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "@/lib/chat-turn";
import { asksForSimilarToActive, type ChatVehicleRecord } from "@/lib/chat-stock";
import fichas from "./__fixtures__/estoque-fichas.json";

// Na ficha, "tem outros parecidos?" usa o carro da página como referência (não é "modelo que falta").
const stock = fichas as unknown as ChatVehicleRecord[];
const LXR = "cmubrhzwf0000l304geveibp1";
let llmCalls = 0;
const ask = (mensagem: string, vehicleId: string) =>
  runChatTurn({ mensagem, historico: [], stock, vehicleId, readIntent: async () => null,
    generate: async () => { llmCalls += 1; return { text: "Posso ajudar.", functionCall: null } as never; } });

const VARIANTS = [
  "tem outros parecidos?",
  "algum parecido?",
  "outras opções?",
  "tem algo similar?",
  "me mostra outros parecidos",
  "tem outro nessa linha?",
  "quais outras opções vocês têm parecidas?",
];

test("Civic LXR: 'tem outros parecidos?' abre com frase natural e até 3 cards, sem ele", async () => {
  for (const question of VARIANTS) {
    const turn = await ask(question, LXR);
    assert.match(turn.reply, /^Separei opções parecidas com esse Civic LXR 2015:/, question);
    assert.doesNotMatch(turn.reply, /não está na lista/i, question);
    assert.ok(turn.vehicles.length >= 1 && turn.vehicles.length <= 3, question);
    assert.ok(turn.vehicles.every(v => v.id !== LXR && (v.category ?? "carro") === "carro"), question);
  }
});

test("todos os carros e motos: parecidos do mesmo tipo e faixa, nunca o próprio, nunca 'não está na lista'", async () => {
  for (const vehicle of stock) {
    for (const question of ["tem outros parecidos?", "outras opções?", "similar mais barato?"]) {
      const turn = await ask(question, vehicle.id);
      const name = `${vehicle.model} ${vehicle.yearModel} / ${question}`;
      assert.doesNotMatch(turn.reply, /não está na lista/i, name);
      assert.ok(turn.vehicles.length <= 3, name);
      assert.ok(turn.vehicles.every(v => v.id !== vehicle.id), `${name}: incluiu o próprio carro`);
      assert.ok(turn.vehicles.every(v => (v.category ?? "carro") === (vehicle.category ?? "carro")), `${name}: tipo diferente`);
      if (/barato/.test(question)) {
        assert.ok(turn.vehicles.every(v => v.price < vehicle.price), `${name}: card mais caro`);
        if (!turn.vehicles.length) assert.match(turn.reply, /não temos outra opção mais em conta/, name);
      } else {
        assert.ok(turn.vehicles.length >= 1, `${name}: sem cards`);
        assert.match(turn.reply, /^Separei opções parecidas com ess[ea] /, name);
      }
    }
  }
  assert.equal(llmCalls, 0, "responde pelo estoque, sem chamar o modelo");
});

test("mais barato: só mais em conta; mesma carroceria primeiro", async () => {
  const turn = await ask("similar mais barato?", LXR);
  assert.match(turn.reply, /^Separei opções parecidas com esse Civic LXR 2015 e mais em conta:/);
  assert.ok(turn.vehicles.every(v => v.price < 74900));
  const parecidos = await ask("tem outros parecidos?", LXR);
  assert.ok(parecidos.vehicles.some(v => /lancer|city|hb20s|ka sedan/i.test(v.model)), "sedans perto no preço");
});

test("detector: pagamento, cor e item da ficha não viram 'parecidos'", () => {
  for (const q of ["outras opções de pagamento?", "tem outras cores?", "o que ele tem?", "tem borboleta?", "qual o valor?"]) {
    assert.equal(asksForSimilarToActive(q), false, q);
  }
});

test("'tem outro Civic?' na ficha do Civic LXR: a outra unidade (EXL 2020) vem primeiro", async () => {
  const turn = await ask("tem outro Civic parecido?", LXR);
  assert.equal(turn.vehicles[0]?.id, "cmu4sgkfz0000js04037q4n51");
  assert.ok(turn.vehicles.every(v => v.id !== LXR));
});
