import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "@/lib/chat-turn";
import type { ChatVehicleRecord } from "@/lib/chat-stock";
import type { ChatTurn } from "@/lib/chat-gemini";
import { findVehicleSpec } from "@/lib/chat-specs";
import fichas from "./__fixtures__/estoque-fichas.json";

/**
 * Bateria de conversa "como cliente de verdade" (estoque real copiado em 11/10/2026):
 * opinião, desempenho, economia, confiabilidade, pontos positivos, continuação ("e do X?"),
 * comparação, manutenção, seguro/documentação, financiamento/troca e pedidos de lista.
 * Regras do Lucas: pergunta de conversa nunca vira frase de busca ("Separei 1 opção…"),
 * resposta direta e positiva, números só da ficha técnica da versão, pontos positivos em
 * listinha de 4 a 6 linhas, e pedido de lista com frase curta + até 3 cards.
 */
const stock = fichas as unknown as ChatVehicleRecord[];
const byId = (suffix: string) => stock.find((vehicle) => vehicle.id.endsWith(suffix))!;
const CIVIC_LXR = byId("veibp1"), CIVIC_EXL = byId("7q4n51"), HB20_16 = byId("9usfgr"), HB20_10 = byId("c9jp7v");
const HB20S = byId("33ruvi"), NIVUS = byId("kxewkj"), KICKS = byId("u40b89"), HRV = byId("wv0ki6"), CITY = byId("g7t5wp");
const LANCER = byId("1cwvkb"), DUSTER = byId("8ybs5n"), KA = byId("rt6ijm"), GOL = byId("qr3y77"), MOBI = byId("9hwcx5");
const WEEKEND = byId("72wx42"), PALIO = byId("urjecm"), BIZ125 = byId("wwpwsv"), BIZ110 = byId("nvddb5k"), CG = byId("25nrgg");

const LLM = "[resposta do modelo]";
const llm = async () => ({ text: LLM, functionCall: null }) as never;
const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

type Result = Awaited<ReturnType<typeof runChatTurn>>;
type Case = {
  q: string;
  page?: ChatVehicleRecord;
  hist?: string[];
  prev?: ChatVehicleRecord[];
  /** Carro de que a resposta tem que falar (e mostrar no card). */
  car?: ChatVehicleRecord;
  kind: "opiniao" | "pontos" | "comparacao" | "lista" | "politica" | "modelo";
  /** Texto que a resposta precisa ter. */
  has?: RegExp[];
  /** Lista: mínimo de cards (o estoque pode ter menos de 3 que batem). */
  minCards?: number;
};

const SEARCH_PHRASE = /^(?:separei|achei|encontrei)\b|\bopç(?:ão|ões) com motor\b|na ficha da garagem/i;

function numbersOk(reply: string, cars: ChatVehicleRecord[]) {
  // Todo número técnico (cv, kgfm, km/l, kg, litros, segundos) tem que existir na ficha técnica de algum carro citado.
  const specs = cars.map((car) => findVehicleSpec(car)).filter(Boolean);
  const allowed = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "number") {
      allowed.add(String(value).replace(".", ","));
      allowed.add(value.toLocaleString("pt-BR"));
    } else if (value && typeof value === "object") Object.values(value).forEach(add);
  };
  specs.forEach((spec) => add(spec));
  for (const match of reply.matchAll(/(?<![\w.,])(\d[\d.,]*)\s*(cv|kgfm|km\/l|kg\b|litros|segundos|s\b)/gi)) {
    const raw = match[1]!.replace(/[.,]$/, "");
    if (!allowed.has(raw) && !allowed.has(raw.replace(".", ""))) return `número inventado: ${match[0]}`;
  }
  return null;
}

function judge(c: Case, r: Result): string | null {
  const reply = r.reply ?? "";
  const ids = r.vehicles.map((vehicle) => vehicle.id);
  if (!reply.trim()) return "resposta vazia";
  if (c.kind !== "lista" && SEARCH_PHRASE.test(reply.trim())) return "respondeu conversa com frase de busca";
  if (c.kind === "lista") {
    if (r.vehicles.length < (c.minCards ?? 2)) return `lista com ${r.vehicles.length} cards`;
    if (reply.split("\n")[0]!.length > 160) return "frase da lista longa demais";
    return null;
  }
  if (c.kind === "opiniao" || c.kind === "pontos") {
    if (reply === LLM) return "caiu no modelo sem dados (resposta genérica)";
    if (c.car) {
      const model = fold(c.car.model).split(" ")[0]!;
      if (!fold(reply).includes(model)) return `não citou o ${c.car.model}`;
      if (ids[0] !== c.car.id) return `card errado (${r.vehicles.map((v) => v.model).join(", ") || "nenhum"})`;
      const wrong = numbersOk(reply, [c.car]);
      if (wrong) return wrong;
    }
    if (/\bn[ãa]o (?:tem|possui|consta)\b/i.test(reply) && c.car && !/consultor/i.test(reply)) return "negou algo";
    if (c.kind === "pontos") {
      const points = reply.split("\n").filter((line) => /^•\s+\*\*[^*]+:\*\*\s+\S/.test(line.trim()));
      if (points.length < 4 || points.length > 6) return `pontos: ${points.length} linhas no formato (quer 4 a 6)`;
      if (points.some((line) => line.length > 110)) return "ponto longo demais";
      if (reply.length > 650) return "mensagem grande demais";
    } else if (reply.length > 520) return "resposta longa demais";
  }
  for (const re of c.has ?? []) if (!re.test(reply)) return `faltou ${re}`;
  return null;
}

const hist = (...turns: string[]): ChatTurn[] =>
  turns.map((content, index) => ({ role: index % 2 === 0 ? "user" : "assistant", content }) as ChatTurn);

const CASES: Case[] = [
  // Desempenho e opinião sobre carro citado
  { q: "e do hb20 1.6? ele parece ser rapido tmb ne? por ser 1.6 em um carro leve", hist: ["o civic 2.0 é rápido?", "O Civic 2.0 tem 155 cv no etanol, anda muito bem."], car: HB20_16, kind: "opiniao", has: [/128 cv/, /autom[áa]tic/i] },
  { q: "e do hb20 1.6? ele parece ser rapido tmb ne? por ser 1.6 em um carro leve", car: HB20_16, kind: "opiniao", has: [/128 cv/] },
  { q: "o hb20 1.6 é rápido?", car: HB20_16, kind: "opiniao", has: [/^sim/i] },
  { q: "o civic exl anda bem?", car: CIVIC_EXL, kind: "opiniao", has: [/155 cv/] },
  { q: "nivus é rapido?", car: NIVUS, kind: "opiniao", has: [/turbo/i] },
  { q: "o kicks é bom de estrada?", car: KICKS, kind: "opiniao" },
  { q: "a duster anda bem na estrada?", car: DUSTER, kind: "opiniao" },
  { q: "o lancer é potente?", car: LANCER, kind: "opiniao", has: [/160 cv/] },
  { q: "o mobi é fraco?", car: MOBI, kind: "opiniao" },
  { q: "o gol 1.0 anda bem?", car: GOL, kind: "opiniao" },
  { q: "palio weekend é boa de estrada?", car: WEEKEND, kind: "opiniao" },
  { q: "o ka sedan é esperto?", car: KA, kind: "opiniao" },
  { q: "a cg 160 corre bem?", car: CG, kind: "opiniao" },
  // Economia
  { q: "o hb20 1.0 é econômico?", car: HB20_10, kind: "opiniao", has: [/km\/l/] },
  { q: "o city é economico?", car: CITY, kind: "opiniao", has: [/km\/l/] },
  { q: "o civic exl gasta muito?", car: CIVIC_EXL, kind: "opiniao" },
  { q: "a biz 125 é econômica?", car: BIZ125, kind: "opiniao" },
  { q: "hrv bebe muito?", car: HRV, kind: "opiniao" },
  // Vale a pena / confiável
  { q: "vale a pena o kicks 2019?", car: KICKS, kind: "opiniao", has: [/vale/i] },
  { q: "o hrv é confiável?", car: HRV, kind: "opiniao" },
  { q: "o lancer da muito problema?", car: LANCER, kind: "opiniao", has: [/consultor/i] },
  { q: "o ka sedan é um bom carro?", car: KA, kind: "opiniao" },
  { q: "compensa pegar o palio 2008?", car: PALIO, kind: "opiniao" },
  // Pontos positivos (listinha por carro)
  { q: "quais os pontos positivos dele?", page: CIVIC_LXR, car: CIVIC_LXR, kind: "pontos", has: [/porta-malas/i] },
  { q: "por que comprar esse carro?", page: HB20_16, car: HB20_16, kind: "pontos", has: [/128 cv/] },
  { q: "quais as vantagens dela?", page: BIZ125, car: BIZ125, kind: "pontos", has: [/econom/i, /manuten/i] },
  { q: "o que ele tem de bom?", page: HRV, car: HRV, kind: "pontos", has: [/altur|alto|alta/i, /espa[çc]o|porta-malas/i] },
  { q: "pontos fortes?", page: CITY, car: CITY, kind: "pontos", has: [/porta-malas/i] },
  { q: "quais os pontos positivos do nivus?", car: NIVUS, kind: "pontos" },
  { q: "vantagens?", page: MOBI, car: MOBI, kind: "pontos" },
  { q: "por que eu levaria ele?", page: WEEKEND, car: WEEKEND, kind: "pontos" },
  { q: "me fala os pontos positivos da duster", car: DUSTER, kind: "pontos", has: [/altur|alto|alta/i] },
  { q: "quais as vantagens da cg?", car: CG, kind: "pontos", has: [/manuten/i] },
  // Continuação ("e do X?")
  { q: "e o civic exl?", hist: ["o hb20 1.6 é rápido?", "Sim! O HB20 1.6 tem 128 cv."], car: CIVIC_EXL, kind: "opiniao", has: [/155 cv/] },
  { q: "e do hb20 1.0?", hist: ["o city é econômico?", "Sim! O City faz cerca de 12,3 km/l na cidade."], car: HB20_10, kind: "opiniao", has: [/km\/l/] },
  { q: "e do hrv?", hist: ["quais os pontos positivos do kicks?", "Os pontos fortes do Kicks..."], car: HRV, kind: "pontos" },
  { q: "ele é rápido?", prev: [NIVUS], hist: ["tem nivus?", "Temos o Nivus Highline 2021."], car: NIVUS, kind: "opiniao" },
  { q: "anda bem?", page: HB20S, car: HB20S, kind: "opiniao", has: [/turbo/i] },
  { q: "e é econômico?", page: KA, car: KA, kind: "opiniao", has: [/km\/l/] },
  // Gíria e erro de digitação
  { q: "esse hb20 1.6 é brabo? anda mto?", car: HB20_16, kind: "opiniao" },
  { q: "kiks vale a pena?", car: KICKS, kind: "opiniao" },
  { q: "o hrv é top?", car: HRV, kind: "opiniao" },
  { q: "qual a desse nivus, corre?", car: NIVUS, kind: "opiniao" },
  { q: "civic lxr é bom memo?", car: CIVIC_LXR, kind: "opiniao" },
  // Comparação
  { q: "civic ou city, qual é mais econômico?", kind: "comparacao", has: [/city/i, /civic/i] },
  { q: "hb20 1.6 ou kicks, qual anda mais?", kind: "comparacao", has: [/hb20/i, /kicks/i, /\d+ cv/] },
  { q: "o nivus é melhor que o kicks?", kind: "comparacao" },
  // Manutenção
  { q: "a manutenção do civic exl é cara?", car: CIVIC_EXL, kind: "opiniao" },
  { q: "peça do kicks é cara?", car: KICKS, kind: "opiniao" },
  { q: "de quanto em quanto tempo faz revisão do hb20?", kind: "modelo" },
  // Seguro e documentação
  { q: "quanto fica o seguro do civic?", kind: "politica" },
  { q: "o documento ta em dia?", page: GOL, kind: "politica" },
  { q: "ipva ta pago?", page: CITY, kind: "politica" },
  { q: "vcs fazem a transferencia?", kind: "politica" },
  // Financiamento e troca
  { q: "da pra financiar o hb20 1.6?", kind: "politica" },
  { q: "qual a entrada minima?", kind: "politica" },
  { q: "aceita meu gol 2012 na troca?", kind: "politica" },
  { q: "parcela em 48x?", page: KICKS, kind: "politica" },
  // Pedidos de lista: frase curta e 3 cards
  { q: "tem carro 1.6?", kind: "lista", minCards: 2 },
  { q: "quais automáticos até 90 mil?", kind: "lista" },
  { q: "quero um suv", kind: "lista" },
  { q: "carros econômicos até 60 mil", kind: "lista" },
  { q: "me mostra os sedans", kind: "lista" },
  // Opinião dentro da página do carro
  { q: "é bom de estrada?", page: LANCER, car: LANCER, kind: "opiniao" },
  { q: "é confiável?", page: DUSTER, car: DUSTER, kind: "opiniao" },
  { q: "é economico?", page: GOL, car: GOL, kind: "opiniao", has: [/km\/l/] },
  { q: "vale a pena?", page: KICKS, car: KICKS, kind: "opiniao" },
  { q: "ela é econômica?", page: BIZ110, car: BIZ110, kind: "opiniao" },
  // Achados do testador (11/10/2026): duplicata, página da Biz 125, gíria de consumo, erros de digitação.
  { q: "o civic 2.0 é rápido?", car: CIVIC_EXL, kind: "opiniao", has: [/^(?:(?!Sim!)[\s\S])*Sim!(?:(?!Sim!)[\s\S])*$/] },
  { q: "quais os pontos positivos dessa biz?", page: BIZ125, car: BIZ125, kind: "pontos" },
  { q: "o civic bebe demais na cidade? me falaram q gasta mto", car: CIVIC_EXL, kind: "opiniao", has: [/km\/l/] },
  { q: "essa biz 110i gasta mt combustivel?", page: BIZ110, car: BIZ110, kind: "opiniao" },
  { q: "esse palio celebration gasta pouca gasolina?", page: PALIO, car: PALIO, kind: "opiniao" },
  { q: "hrv 1.8 consome mto no transito pesado?", car: HRV, kind: "opiniao" },
  { q: "o mobi é mto fraco d motor? tipo pra subi morro", car: MOBI, kind: "opiniao", has: [/Fraco/] },
  { q: "esse gol 1.0 da conta do recado na rodovia?", page: GOL, car: GOL, kind: "opiniao" },
  { q: "o nivus tsi gasta mto se anda d boa?", car: NIVUS, kind: "opiniao" },
  { q: "essa palio weekend adventure conpensa?", car: WEEKEND, kind: "opiniao", has: [/Vale a pena/] },
  { q: "lancer da muito pobrema de cambio cvt?", car: LANCER, kind: "opiniao" },
  { q: "duster automatica da dor de cabeca?", car: DUSTER, kind: "opiniao" },
  { q: "gol g5 1.0 da mto defeito no motor?", car: GOL, kind: "opiniao" },
  { q: "o que essa cg 160 tem de bom?", car: CG, kind: "pontos" },
  { q: "o que esse nivus tem de bom?", car: NIVUS, kind: "pontos" },
  { q: "e sobre a manutencao da hrv?", hist: ["o lancer da pobrema?", "É, sim: o Lancer 2.0 tem motor 2.0 MIVEC robusto e conhecido."], car: HRV, kind: "opiniao" },
];

test(`bateria de conversa: ${CASES.length} perguntas de cliente real`, async () => {
  const fails: string[] = [];
  const rows: string[] = [];
  for (const c of CASES) {
    const r = await runChatTurn({
      mensagem: c.q,
      historico: hist(...(c.hist ?? [])),
      stock,
      vehicleId: c.page?.id,
      previousVehicleIds: c.prev?.map((vehicle) => vehicle.id),
      readIntent: async () => null,
      generate: llm,
      generateStream: (async () => llm()) as never,
      researchVehicles: (async () => ({ unavailable: true, paragraphs: [] })) as never,
    });
    const problem = judge(c, r);
    rows.push(`${problem ? "✗" : "✓"} [${c.kind}] ${c.page ? `(${c.page.model}) ` : ""}${c.q}\n   → ${r.reply.replace(/\n/g, " ⏎ ").slice(0, 300)}\n   cards: ${r.vehicles.map((v) => v.model).join(", ")} | policy: ${r.meta?.policy ?? "-"}${problem ? `\n   PROBLEMA: ${problem}` : ""}`);
    if (problem) fails.push(`${c.q} → ${problem}`);
  }
  const ok = CASES.length - fails.length;
  if (process.env.BATERIA_OUT) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(process.env.BATERIA_OUT, `${rows.join("\n")}\n\nACERTO: ${ok}/${CASES.length} (${((100 * ok) / CASES.length).toFixed(1)}%)\n`);
  }
  console.log(`ACERTO: ${ok}/${CASES.length} (${((100 * ok) / CASES.length).toFixed(1)}%)`);
  assert.deepEqual(fails, []);
});


test("opinião rejeita potência e consumo de outro card", async () => {
  const result = await runChatTurn({ mensagem: "o civic exl anda bem?", historico: [], stock, generate: llm, readIntent: async () => null });
  const caseInfo: Case = { q: "o civic exl anda bem?", car: CIVIC_EXL, kind: "opiniao" };
  const foreign = await runChatTurn({ mensagem: "o hb20 1.6 anda bem?", historico: [], stock, generate: llm, readIntent: async () => null });
  for (const number of ["128 cv", "9,7 km/l"]) {
    assert.match(judge(caseInfo, { ...result, reply: `O Civic tem ${number}.`, vehicles: [...result.vehicles, ...foreign.vehicles] }) ?? "", /número inventado/);
  }
});
