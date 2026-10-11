import assert from "node:assert/strict";
import test from "node:test";
import { runChatTurn } from "./chat-turn";
import { parsePriceLimit, CHAT_SYSTEM_PROMPT, CHAT_FALLBACK_REPLY } from "./chat-prompt";
import { parseChatSearchRanges } from "./chat-search-filters";
import { scopeChatMessage, formatFocusedEquipmentReply, normalizeChatAccessories, CHAT_WARRANTY_REPLY, type ChatVehicleRecord } from "./chat-stock";
import { guardEquipmentClaims, guardUnitClaims, guardSalesTone, UNIT_CLAIM_REPLACEMENT } from "./chat-claims";
import { officialWarrantyDetail } from "./chat-warranty";
import { STORE_WARRANTY } from "./vehicle-conditions";
import { planExpertTurn } from "./chat-expert";
import { VEHICLE_SPECS } from "./chat-specs";
import { generateGroundedResearch } from "./chat-gemini";
import type { ChatTurn } from "./chat-gemini";

const car = (id: string, brand: string, model: string, version: string, yearModel: number, engine: string): ChatVehicleRecord => ({
  id, brand, model, version, yearModel, engine, transmission: "Automático", fuel: "Flex", category: "carro", color: null, price: 84900, km: 60000,
});
const civic = car("civic", "Honda", "Civic", "LXR 2.0", 2015, "2.0");
const newer = { ...civic, id: "newer", version: "EXL 2.0", yearModel: 2020 };
const kicks = car("kicks", "Nissan", "Kicks", "SL 1.6 CVT", 2019, "1.6");
const corolla = car("corolla", "Toyota", "Corolla", "Altis 2.0", 2018, "2.0");
const city = car("city", "Honda", "City", "EXL 1.5 CVT", 2018, "1.5");
const hrv = car("hrv", "Honda", "HR-V", "EXL 1.8 CVT", 2018, "1.8");
const lancer = { ...car("lancer", "Mitsubishi", "Lancer", "2.0 CVT", 2015, "2.0"), fuel: "Gasolina" };
const hb = { ...car("hb", "Hyundai", "HB20", "Premium 1.6 Aut", 2015, "1.6"), price: 56900 };
const stock = [civic, newer, kicks, corolla, city, hrv, hb, lancer];
const noModel = async () => { throw new Error("Sem provedor nesta regressão local"); };

test("aceleração nunca vira preço mínimo, máximo nem memória de orçamento", () => {
  for (const question of ["de 0 a 100", "0–100 km/h", "de 0 até 100", "zero a cem"]) {
    assert.equal(parsePriceLimit(question), null);
    assert.deepEqual(parseChatSearchRanges(question), {});
  }
  assert.equal(parsePriceLimit("faz de 0 a 100? Quero automático até 70 mil"), 70000);
  assert.deepEqual(parseChatSearchRanges("entre 50 e 70 mil"), { minPrice: 50000 });
});

test("conversa exata: Civic → consumo/autonomia do Kicks → marchas do Corolla → e o City", async () => {
  const historico: ChatTurn[] = [];
  for (const [mensagem, pattern] of [
    ["quanto faz de 0 a 100 o Civic?", /Civic.*10,9 segundos/],
    ["e o Kicks, quanto faz de consumo e qual a autonomia com um tanque?", /Kicks.*km\/l.*41 litros/],
    ["quantas marchas tem o Corolla?", /Corolla.*CVT.*simula 7 marchas/],
    ["e o City?", /City.*CVT.*simula 7 marchas/],
  ] as const) {
    const result = await runChatTurn({ mensagem, historico, stock, generate: noModel });
    assert.equal(result.meta?.policy, "spec-direct", mensagem);
    assert.match(result.reply, pattern, mensagem);
    assert.doesNotMatch(result.reply, /100\.000|Olha o que tenho|R\$/);
    historico.push({ role: "user", content: mensagem }, { role: "assistant", content: result.reply });
  }
  assert.doesNotMatch(scopeChatMessage("tem SUV?", historico, stock), /até 100 mil/);
});

test("ranking considera Lancer após os primeiros 16 anúncios, inclusive depois dos HB20", async () => {
  const many = [...Array.from({ length: 20 }, (_, index) => ({ ...hb, id: `hb-${index}` })), ...stock];
  for (const historico of [[], [{ role: "user", content: "me mostra HB20" }, { role: "assistant", content: "Hyundai HB20 Premium 1.6 Aut 2015 · 60.000 km · R$ 56.900" }]] as ChatTurn[][]) {
    const plan = planExpertTurn({ mensagem: "qual o mais forte da loja?", historico, stock: many, promptStock: many.slice(0, 3) });
    assert.match(plan.stockRanking!, /Lancer 2.0: 160 cv/);
    const result = await runChatTurn({ mensagem: "qual o mais forte?", historico, stock: many, generate: noModel });
    assert.match(result.reply, /Lancer.*160 cv/);
    if (historico.length) assert.match(result.reply, /HB20/);
  }
  const generated = await runChatTurn({ mensagem: "qual o mais forte da loja?", historico: [], stock: many,
    generate: async () => ({ text: "O HB20 1.6 tem 128 cv com etanol.", functionCall: null }),
  });
  assert.match(generated.reply, /No estoque inteiro.*Lancer.*160 cv/);
  const fallback = await runChatTurn({ mensagem: "qual o mais forte?", historico: [], stock: many,
    generate: async () => ({ text: CHAT_FALLBACK_REPLY, functionCall: null }),
  });
  assert.match(fallback.reply, /Lancer.*160 cv/);
  assert.ok(!fallback.reply.startsWith(CHAT_FALLBACK_REPLY));
  for (const question of ["qual o mais rápido?", "qual o mais econômico?"]) {
    const plan = planExpertTurn({ mensagem: question, historico: [], stock: many, promptStock: [hb] });
    assert.ok(plan.subject.vehicles.some(vehicle => vehicle.id === lancer.id));
    assert.ok(plan.stockRanking);
  }
});

test("opcionais respondem o item pedido, sem inferir multimídia ou teto solar e sem fragmentos", () => {
  const mobi = { ...car("mobi", "Fiat", "Mobi", "Like 1.0", 2022, "1.0"), accessories: ['Painel digital TFT de 3,5"', "Ar-condicionado", "Direção hidráulica", "dianteiros com função one-touch e antiesmagamento", "nas 4 portas", "completo"] };
  const result = formatFocusedEquipmentReply(mobi, "esse Mobi tem central multimídia?");
  assert.match(result, /não consta central multimídia/);
  assert.match(result, /Painel digital TFT.*Ar-condicionado.*Direção/);
  assert.doesNotMatch(result, /one-touch|nas 4 portas|completo/);
  assert.match(formatFocusedEquipmentReply({ ...mobi, model: "Gol", version: "Trend", yearModel: 2012 }, "o Gol Trend 2012 tem teto solar?"), /não consta teto solar/);
  assert.deepEqual(normalizeChatAccessories([" Ar-condicionado ", "Ar-condicionado", "nas 4 portas"]), ["Ar-condicionado"]);
});

test("guarda não empresta opcional de outro carro e não trata um modelo genérico como prova de segurança", () => {
  const withItem = { ...kicks, accessories: ["Central multimídia", "ABS"] };
  assert.match(guardEquipmentClaims("O Mobi tem central multimídia.", [withItem, { ...hb, model: "Mobi" }]), /não consigo afirmar/);
  assert.match(guardEquipmentClaims("O Civic tem airbags e ABS.", [civic]), /não consigo afirmar/);
  assert.match(guardEquipmentClaims("O Civic tem teto solar, confirme no WhatsApp.", [civic]), /não consigo afirmar/);
  assert.equal(guardEquipmentClaims("O Kicks tem central multimídia.", [withItem]), "O Kicks tem central multimídia.");
  assert.equal(guardEquipmentClaims("A versão costuma vir com ABS.", [civic]), "A versão costuma vir com ABS.");
});

test("garantia vem do texto oficial com exclusões; estado da unidade continua sem promessa", () => {
  const detail = officialWarrantyDetail();
  assert.ok(STORE_WARRANTY.body.startsWith(detail));
  assert.ok(CHAT_WARRANTY_REPLY.startsWith(detail));
  assert.match(detail, /checagem na loja antes do anúncio/);
  assert.match(detail, /Desgaste natural, mau uso.*pneus, pastilhas, filtros/);
  assert.doesNotMatch(CHAT_WARRANTY_REPLY, /revisa cada|100%|garantia de fábrica/);
  assert.equal(guardUnitClaims(detail), detail);
  for (const text of ["Tem garantia de 1 ano.", "Tem 90 dias de garantia de tudo.", "A correia foi trocada.", "É revisado e tem procedência garantida."]) assert.match(guardUnitClaims(text), /WhatsApp/);
});

test("tom positivo na manutenção e resposta honesta à pergunta direta sobre consumo do Lancer", async () => {
  assert.match(CHAT_SYSTEM_PROMPT, /NÃO traga defeitos/);
  assert.match(CHAT_SYSTEM_PROMPT, /DE SÉRIE confirmado.*versão.*ano-modelo exatos/);
  for (const spec of VEHICLE_SPECS) assert.doesNotMatch(spec.manutencao, /ponto de atenção|vale olhar|problemas crônicos|mais caras/);
  const result = await runChatTurn({ mensagem: "o Lancer 2.0 bebe muito?", historico: [], stock, generate: noModel });
  assert.match(result.reply, /8,8 km\/l na cidade.*10,7 km\/l na estrada/);
  assert.match(result.reply, /robusto.*WhatsApp/);
  assert.doesNotMatch(result.reply, /suspensão|bomba|ruim/);
});

test("jornada de seis turnos responde a pergunta e conserva cards na busca", async () => {
  const historico: ChatTurn[] = [];
  for (const mensagem of ["pontos positivos do Kicks", "0 a 100 do Civic", "consumo do Civic", "tem automático até 70 mil?", "Kicks x HR-V", "quero falar com o vendedor"]) {
    const result = await runChatTurn({ mensagem, historico, stock, generate: noModel });
    if (mensagem.includes("pontos positivos")) assert.match(result.reply, /Kicks.*economia.*CVT.*porta-malas/);
    if (mensagem.includes("até 70")) assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), [hb.id]);
    if (mensagem.includes("x HR-V")) assert.match(result.reply, /Kicks.*economia.*HR-V.*conforto e espaço/);
    if (mensagem.includes("vendedor")) assert.match(result.reply, /WhatsApp|wa\.me/);
    assert.doesNotMatch(result.reply, /ponto de atenção|conferir.*suspensão/);
    historico.push({ role: "user", content: mensagem }, { role: "assistant", content: result.reply });
  }
});

test("grounding prioriza 3.5 mesmo com override 2.5, e dois 404 encerram rapidamente", async () => {
  const before = globalThis.fetch;
  const key = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "fixture-local";
  process.env.GEMINI_MODEL = "gemini-2.5-flash-lite";
  const urls: string[] = [];
  try {
    globalThis.fetch = (async (url) => { urls.push(String(url)); return Response.json({}, { status: 404 }); }) as typeof fetch;
    await assert.rejects(generateGroundedResearch("identidade pública"));
    assert.equal(urls.length, 2);
    assert.match(urls[0]!, /gemini-3\.5-flash-lite/);
    assert.match(urls[1]!, /gemini-2\.5-flash-lite/);
  } finally {
    globalThis.fetch = before;
    if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key;
    if (model === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = model;
  }
});


test("tom não sugere conferir suspensão espontaneamente e preserva crítica quando perguntada", () => {
  const reply = "O HB20 tem mecânica conhecida. Vale dar aquela conferida básica na suspensão.";
  assert.equal(guardSalesTone(reply, "esse HB20 é bom de manutenção?"), "O HB20 tem mecânica conhecida.");
  assert.equal(guardSalesTone(reply, "tem problema de suspensão?"), reply);
});

test("guarda conserva cilindrada e garante equipamento só com evidência exata de série", () => {
  assert.equal(guardUnitClaims("O motor 1.6 é econômico. Revisado."), `O motor 1.6 é econômico. ${UNIT_CLAIM_REPLACEMENT}`);
  const claim = "O Civic tem ABS.";
  assert.equal(guardEquipmentClaims(claim, [civic], "Civic LXR 2.0 2015 tem ABS de série."), claim);
  assert.match(guardEquipmentClaims(claim, [civic], "Civic EXL 2.0 2020 tem ABS de série."), /não consigo afirmar/);
});

test("pesquisa fica no contexto da resposta e falha não impede o especialista", async () => {
  const unknown = car("unknown", "Fiat", "Argo", "Drive 1.3", 2023, "1.3");
  for (const unavailable of [false, true]) {
    const result = await runChatTurn({ mensagem: "consumo do Argo?", historico: [], stock: [unknown],
      researchVehicles: async (vehicles) => {
        assert.equal(vehicles[0]?.version, "Drive 1.3");
        assert.equal(vehicles[0]?.yearModel, 2023);
        return unavailable ? { paragraphs: [], unavailable: true } : { paragraphs: [{ text: "Argo Drive 1.3 2023: referência de 12 km/l na cidade, na gasolina.", sources: [{ title: "Fiat", href: "https://www.fiat.com.br/" }] }] };
      },
      generate: async ({systemPrompt}) => {
        if (!unavailable) assert.match(systemPrompt, /incorpore os dados úteis naturalmente.*\nArgo Drive 1.3 2023/);
        return { text: "O Argo Drive 1.3 2023 é uma opção econômica para o dia a dia.", functionCall: null };
      },
    });
    assert.match(result.reply, /^O Argo/);
    assert.equal(Boolean(result.research), !unavailable);
  }
});
