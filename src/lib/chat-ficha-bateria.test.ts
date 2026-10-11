import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "@/lib/chat-turn";
import type { ChatVehicleRecord } from "@/lib/chat-stock";
import fichas from "./__fixtures__/estoque-fichas.json";

/**
 * Bateria "na ficha": para CADA carro do estoque real (fichas copiadas do banco em 11/10/2026),
 * perguntas feitas dentro da página do carro. Regras do Lucas:
 * - "ele/esse/o carro" é sempre o carro da página: resposta e card só dele;
 * - item que está na ficha nunca é negado nem fica sem confirmação (com sinônimos);
 * - "o que ele tem?" vira resumo organizado da ficha;
 * - câmbio não contradiz a ficha.
 */
const stock = fichas as unknown as ChatVehicleRecord[];

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** [ficha tem (regex no texto da ficha), pergunta com sinônimo, a resposta tem que citar]. Ordem: mais difíceis primeiro. */
const ITEMS: Array<[RegExp, string, RegExp]> = [
  [/paddle|borboleta|marchas? no volante/, "tem borboleta no volante?", /paddle|borboleta|volante/i],
  [/carplay/, "dá pra espelhar o celular com carplay?", /carplay/i],
  [/chave presencial|keyless|partida (?:no|por) botao/, "tem partida no botão?", /bot[ãa]o|keyless|presencial/i],
  [/camera/, "tem câmera traseira?", /c[âa]mera/i],
  [/sensor(?:es)? de estacionamento/, "tem sensor de ré?", /sensor/i],
  [/\bcouro\b/, "o banco é de couro?", /couro/i],
  [/piloto automatico|cruise/, "tem controle de cruzeiro?", /piloto|cruzeiro|cruise/i],
  [/isofix/, "tem isofix pra cadeirinha?", /isofix/i],
  [/air ?bags?/, "tem bolsa de ar?", /air ?bag|bolsa/i],
  [/multimidia|media nav/, "tem tela multimídia?", /multim[íi]dia|media nav|tela/i],
  [/painel\b.{0,40}digital/, "o painel é digital?", /painel/i],
  [/ar[- ]condicionado digital|ar digital/, "o ar é digital?", /ar[- ]condicionado digital|ar digital|digital/i],
  [/freios? (?:cbs|combinad)|\bcbs\b/, "o freio é combinado?", /cbs|combinad/i],
  [/partida eletrica/, "tem partida elétrica?", /partida el[ée]trica/i],
  [/farol de neblina|farois de neblina/, "tem farol de milha?", /neblina|milha/i],
  [/direcao eletrica/, "a direção é elétrica?", /dire[çc][ãa]o el[ée]trica/i],
  [/vidros? eletricos?/, "tem vidro elétrico?", /vidros? el[ée]tric/i],
  [/\babs\b/, "tem freio abs?", /\babs\b/i],
  [/bluetooth/, "conecta no bluetooth?", /bluetooth/i],
  [/ar[- ]condicionado/, "tem ar?", /ar[- ]condicionado|\bar\b/i],
  [/direcao hidraulica/, "tem direção hidráulica?", /hidr[áa]ulica/i],
];

const NEGATIVE = /\bn[ãa]o (?:consta|constam|aparece|aparecem|tem|temos|possui|est[áa] na lista)\b|\bnenhum[a]?\b|\bsem (?:airbag|abs|c[âa]mera|multim[íi]dia)/i;
let llmCalls = 0;
const noLlm = async () => { llmCalls += 1; return { text: "Posso ajudar.", functionCall: null } as never; };
const ask = (mensagem: string, vehicleId: string) =>
  runChatTurn({ mensagem, historico: [], stock, vehicleId, readIntent: async () => null, generate: noLlm });

const isMoto = (v: ChatVehicleRecord) => v.category === "moto";
const otherNames = (v: ChatVehicleRecord) =>
  stock.filter(o => o.id !== v.id).map(o => fold(o.model) === fold(v.model) ? String(o.yearModel) : fold(o.model))
    .filter(n => !fold(`${v.model} ${v.version}`).includes(n));

type Case = { vehicle: ChatVehicleRecord; question: string; check: (reply: string) => string | null };
const cases: Case[] = [];
for (const vehicle of stock) {
  const ficha = (vehicle.accessories ?? []).map(fold);
  const p = isMoto(vehicle) ? "ela" : "ele";
  const g = isMoto(vehicle) ? "essa moto" : "esse carro";
  for (const question of [`O que ${p} tem de equipamento?`, `quais os opcionais d${p === "ela" ? "ela" : "ele"}?`, `o que vem n${g}?`]) {
    cases.push({ vehicle, question, check: reply => {
      const hits = (vehicle.accessories ?? []).filter(item => fold(reply).includes(fold(item.split(/\s*[(,;:]/)[0]!.split(/\s+/).slice(0, 2).join(" "))));
      const need = Math.min(4, (vehicle.accessories ?? []).length);
      return hits.length >= need ? null : `resumo cita ${hits.length} itens da ficha (mín. ${need})`;
    } });
  }
  for (const [inFicha, question, mention] of ITEMS.filter(([re]) => ficha.some(item => re.test(item))).slice(0, 3)) {
    cases.push({ vehicle, question, check: reply =>
      NEGATIVE.test(reply) ? "negou item da ficha" : !mention.test(reply) ? "não confirmou o item" : null });
    void inFicha;
  }
  // Item que NÃO está na ficha: nunca afirmar que tem.
  const absent = ITEMS.find(([re]) => !ficha.some(item => re.test(item)) && !(isMoto(vehicle) && /teto|banco|camera|airbag/.test(re.source)));
  if (absent) {
    cases.push({ vehicle, question: absent[1], check: reply =>
      /^sim\b/i.test(reply.trim()) || !/n[ãa]o (?:consta|constam|aparece|aparecem|detalha|lista)/i.test(reply) ? "afirmou item que não está na ficha" : null });
  }
  cases.push({ vehicle, question: isMoto(vehicle) ? "qual o câmbio dela?" : "qual o câmbio dele?", check: reply => {
    const t = fold(vehicle.transmission);
    const r = fold(reply);
    if (t === "manual") return /\bmanual\b/.test(r) && !/automatic|\bcvt\b/.test(r) ? null : "câmbio não bate com Manual";
    if (t.startsWith("semi")) return /semi/.test(r) ? null : "câmbio não bate com Semi-automático";
    if (t === "cvt") return /\bcvt\b/.test(r) && !/conversor de torque/.test(r) ? null : "câmbio não bate com CVT";
    return /automatic|\bcvt\b/.test(r) && !/cambio manual\b/.test(r) ? null : "câmbio não bate com Automático";
  } });
}

test(`bateria na ficha: ${cases.length} perguntas em ${stock.length} carros, 100% sobre o carro da página`, async () => {
  const fails: string[] = [];
  for (const { vehicle, question, check } of cases) {
    const turn = await ask(question, vehicle.id);
    const ids = turn.vehicles.map(v => v.id);
    const name = `${vehicle.model} ${vehicle.yearModel} / "${question}"`;
    const reply = fold(turn.reply);
    const leak = otherNames(vehicle).find(n => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}\\b`).test(reply));
    const problem =
      ids.some(id => id !== vehicle.id) ? `card de outro carro (${ids.join(",")})` :
      leak ? `citou outro carro (${leak})` :
      check(turn.reply);
    if (problem) fails.push(`${name}: ${problem} → ${turn.reply.replace(/\s+/g, " ").slice(0, 180)}`);
  }
  assert.equal(llmCalls, 0, "a bateria responde pela ficha, sem chamar o modelo");
  const rate = ((cases.length - fails.length) / cases.length * 100).toFixed(1);
  console.log(`[bateria ficha] acerto ${cases.length - fails.length}/${cases.length} (${rate}%)`);
  if (process.env.BATERIA_VERBOSE) for (const f of fails) console.log("  ✗", f);
  assert.deepEqual(fails, []);
});
