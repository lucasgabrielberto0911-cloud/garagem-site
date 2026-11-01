import assert from "node:assert/strict";
import test from "node:test";
import { runChatTurn } from "./chat-turn";
import { scopeChatMessage, startsNewChatTopic, type ChatVehicleRecord } from "./chat-stock";
import { GREETING_TEMPLATES } from "./chat-replies";
import { chatLiveAnnouncement, displayChatText, formatChatHandoffMessage } from "./chat-text";
import {
  CHAT_HISTORY_CARD_TTL,
  CHAT_HISTORY_KEY,
  chatSearchContext,
  parseChatHistory,
  withoutFailedAttempt,
  type ChatMessage,
} from "./chat-history";
import { isIntentExpired, partitionIntents, runSingleFlush, OFFLINE_INTENT_TTL_MS } from "./offline-queue";

const car = (id: string, brand: string, model: string, version: string, yearModel: number, engine: string, price: number, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord => ({
  id, brand, model, version, yearModel, engine, transmission: "Automático", fuel: "Flex", category: "carro", color: null, price, km: 50000, ...extra,
});
const stock = [
  car("palio", "Fiat", "Palio Weekend", "Adventure 1.8", 2016, "1.8", 52000, { transmission: "Manual" }),
  car("kicks", "Nissan", "Kicks", "SL 1.6 CVT", 2019, "1.6", 86900),
  car("creta", "Hyundai", "Creta", "Prestige 2.0", 2017, "2.0", 87900),
  car("civic", "Honda", "Civic", "EXL 2.0", 2018, "2.0", 126900),
  car("biz", "Honda", "Biz", "125", 2020, "125", 12000, { category: "moto", transmission: "Semiautomático" }),
  car("cg", "Honda", "CG 160", "Start", 2023, "160", 16000, { category: "moto", transmission: "Manual" }),
];
const noModel = async () => { throw new Error("sem provedor"); };
const filtros = [
  { role: "user" as const, content: "Tem carro automático?" },
  { role: "user" as const, content: "Tem SUV até 90 mil?" },
];

// P1: filtros herdados -------------------------------------------------------
for (const pergunta of [
  "Tem moto?",
  "Tem Onyx?",
  "Quero um carro pra família com bom porta-malas",
  "Faz 48x sem entrada?",
  "Qual o melhor carro pra Uber?",
]) {
  test(`"${pergunta}" não herda automático nem teto de preço de turnos anteriores`, () => {
    const scoped = scopeChatMessage(pergunta, filtros, stock);
    assert.doesNotMatch(scoped, /autom[aá]tico|90 mil|até R\$/i, scoped);
  });
}

test("seguimentos explícitos continuam herdando o recorte", () => {
  assert.match(scopeChatMessage("qual desses é o mais novo?", filtros, stock), /autom[aá]tico/i);
  assert.equal(startsNewChatTopic("mais opções", "carro"), false);
  assert.equal(startsNewChatTopic("e até 60 mil?", "carro"), false);
});

test("conversa longa: categoria, uso e financiamento não repetem 'já te mostrei' nem trazem filtro velho", async () => {
  const historico: Array<{ role: "user" | "assistant"; content: string }> = [];
  const respostas: Record<string, Awaited<ReturnType<typeof runChatTurn>>> = {};
  for (const mensagem of [
    "Tem carro automático?",
    "Tem SUV até 90 mil?",
    "Tem moto?",
    "Quero um carro pra família com bom porta-malas",
    "Qual o melhor carro pra Uber?",
    "Qual o preço do Civic?",
  ]) {
    const result = await runChatTurn({ mensagem, historico: [...historico], stock, generate: noModel });
    respostas[mensagem] = result;
    historico.push({ role: "user", content: mensagem }, { role: "assistant", content: result.reply });
  }
  // P2 item 4: SUV até 90 mil mostra Kicks e Creta, mesmo já tendo aparecido antes.
  assert.deepEqual(respostas["Tem SUV até 90 mil?"]!.vehicles?.map((v) => v.id).sort(), ["creta", "kicks"]);
  assert.deepEqual(respostas["Tem moto?"]!.vehicles?.map((v) => v.id).sort(), ["biz", "cg"]);
  for (const key of ["Quero um carro pra família com bom porta-malas", "Qual o melhor carro pra Uber?"]) {
    assert.doesNotMatch(respostas[key]!.reply, /Já te mostrei|sem repetir as que já mostrei/, key);
    assert.ok((respostas[key]!.vehicles?.length ?? 0) > 0, key);
  }
  // P2 item 3: pergunta de preço diz o preço no texto, mesmo em sessão longa.
  assert.match(respostas["Qual o preço do Civic?"]!.reply, /R\$ 126\.900/);
});

// P1: mensagem do WhatsApp ---------------------------------------------------
const palio = { brand: "Fiat", model: "Palio Weekend", version: "Adventure 1.8", year: 2016, href: "/estoque/palio", transmission: "Manual", price: 52000 };
const kicks = { brand: "Nissan", model: "Kicks", version: "SL 1.6 CVT", year: 2019, href: "/estoque/kicks", transmission: "Automático", price: 86900 };

test("WhatsApp do card não diz 'automático até R$ 90.000' de um carro manual", () => {
  const msg = formatChatHandoffMessage({ vehicles: [palio], transmission: "automatico", priceLimit: 90000 });
  assert.doesNotMatch(msg, /autom[aá]tico/i);
  assert.match(msg, /^Oi! Vi o Fiat Palio Weekend/);
});

test("WhatsApp só cita o preço teto quando o carro cabe nele", () => {
  const caro = { ...kicks, price: 126900 };
  assert.doesNotMatch(formatChatHandoffMessage({ vehicles: [caro], priceLimit: 90000 }), /até R\$/);
  assert.match(formatChatHandoffMessage({ vehicles: [kicks], transmission: "automatico", priceLimit: 90000 }), /automático até R\$ 90\.000/);
});

test("WhatsApp com vários carros só leva o recorte que vale para todos", () => {
  const msg = formatChatHandoffMessage({ vehicles: [kicks, palio], transmission: "automatico", priceLimit: 90000 });
  assert.doesNotMatch(msg, /autom[aá]ticos/i);
  assert.match(msg, /até R\$ 90\.000/);
  // Sem dados do carro (câmbio/preço), nada de recorte.
  const semDados = formatChatHandoffMessage({ vehicles: [{ brand: "Fiat", model: "Uno", year: 2012 }], transmission: "manual", priceLimit: 30000 });
  assert.doesNotMatch(semDados, /manual|até R\$/);
});

// P1: endereço/horário -------------------------------------------------------
test("resposta de horário não termina em dois pontos depois de tirar o link", () => {
  const visivel = displayChatText(`${GREETING_TEMPLATES.hours}\n\nQual outro detalhe você quer conhecer?`);
  assert.match(visivel, /combinada com o consultor no WhatsApp\.\n\nQual outro detalhe/);
  assert.doesNotMatch(visivel, /:\s*(\n|$)/);
});

test("toda frase que acaba em ': <link do WhatsApp>' vira ponto no texto visível", () => {
  assert.equal(
    displayChatText("A visita é com horário marcado: https://wa.me/5527996330706"),
    "A visita é com horário marcado.",
  );
  assert.equal(
    displayChatText("O consultor confirma o histórico no WhatsApp: https://wa.me/5527996330706"),
    "O consultor confirma o histórico no WhatsApp.",
  );
});

test("pergunta de endereço pelo chat sai com frase completa", async () => {
  const result = await runChatTurn({ mensagem: "Qual o endereço e horário?", historico: [], stock, generate: noModel });
  assert.doesNotMatch(displayChatText(result.reply), /:\s*(\n|$)/);
});

// P2: reenvio, leitor de tela, cards velhos -----------------------------------
test("tentar de novo não duplica a pergunta no histórico", () => {
  const abertura: ChatMessage = { role: "assistant", content: "Oi" };
  const falhou: ChatMessage[] = [abertura, { role: "user", content: "Tem Civic?" }];
  assert.deepEqual(withoutFailedAttempt(falhou, "Tem Civic?  "), [abertura]);
  assert.deepEqual(withoutFailedAttempt(falhou, "Tem Kicks?"), falhou);
  const respondida: ChatMessage[] = [...falhou, { role: "assistant", content: "Tenho sim" }];
  assert.deepEqual(withoutFailedAttempt(respondida, "Tem Civic?"), respondida);
});

test("leitor de tela recebe a resposta concluída, sem link seco, e não o streaming", () => {
  const messages = [
    { role: "assistant", content: "Oi" },
    { role: "user", content: "Qual o horário?" },
    { role: "assistant", content: "Atendemos das 8h às 23h: https://wa.me/5527996330706" },
  ];
  assert.equal(chatLiveAnnouncement(messages, true), "Consultando sua pergunta");
  assert.equal(chatLiveAnnouncement(messages, false), "Atendemos das 8h às 23h.");
  assert.equal(chatLiveAnnouncement(messages.slice(0, 1), false), "Assistente aberto");
  const longa = [...messages.slice(0, 2), { role: "assistant", content: "a ".repeat(500) }];
  assert.ok(chatLiveAnnouncement(longa, false).length <= 600);
});

function guardado(savedAt: number): string {
  const card = { id: "kicks", href: "/estoque/kicks", title: "Nissan Kicks 2019", brand: "Nissan", model: "Kicks", version: null, year: 2019, km: 1, price: 86900, color: null, transmission: "Automático", photo: null };
  const messages: ChatMessage[] = [
    { role: "user", content: "Tem SUV?" },
    { role: "assistant", content: "Tenho o Kicks.", vehicles: [card], stockHref: "/estoque?q=suv" },
  ];
  return JSON.stringify({ v: 3, byKey: { site: messages }, savedAt: { site: savedAt } });
}

test("cards do histórico só voltam se foram salvos há pouco; o texto e os ids vistos permanecem", () => {
  const now = Date.now();
  const novo = parseChatHistory(guardado(now - 60_000), now).byKey.site!;
  assert.equal(novo[1]!.vehicles?.length, 1);
  const velho = parseChatHistory(guardado(now - CHAT_HISTORY_CARD_TTL - 1000), now).byKey.site!;
  assert.equal(velho[1]!.content, "Tenho o Kicks.");
  assert.equal(velho[1]!.vehicles, undefined);
  assert.equal(velho[1]!.stockHref, undefined);
  assert.deepEqual(chatSearchContext(velho).shownVehicleIds, ["kicks"]);
  assert.ok(CHAT_HISTORY_KEY);
});

// P1/P2: fila offline -------------------------------------------------------------
test("pedido guardado expira por tipo e é separado antes de enviar", () => {
  const now = Date.now();
  const itens = [
    { type: "whatsapp" as const, createdAt: now - OFFLINE_INTENT_TTL_MS.whatsapp - 1 },
    { type: "whatsapp" as const, createdAt: now - 1000 },
    { type: "sell" as const, createdAt: now - OFFLINE_INTENT_TTL_MS.whatsapp - 1 },
    { type: "sell" as const, createdAt: Number.NaN },
  ];
  assert.equal(isIntentExpired(itens[1]!, now), false);
  const { fresh, expired } = partitionIntents(itens, now);
  assert.equal(fresh.length, 2);
  assert.equal(expired.length, 2);
});

test("duas descargas simultâneas da fila rodam uma vez só", async () => {
  let runs = 0;
  const task = async () => {
    runs += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
  };
  await Promise.all([runSingleFlush(task), runSingleFlush(task), runSingleFlush(task)]);
  assert.equal(runs, 1);
  await runSingleFlush(task);
  assert.equal(runs, 2);
});

test("falha da tarefa libera a trava para a próxima tentativa", async () => {
  await assert.rejects(runSingleFlush(async () => { throw new Error("IDB"); }));
  let ok = false;
  await runSingleFlush(async () => { ok = true; });
  assert.equal(ok, true);
});

test("pop-up bloqueado: o recado só sai da fila quando a pessoa abre ou descarta", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("src/components/site/OfflineLeadFlush.tsx", "utf8");
  const blocked = source.slice(source.indexOf("} else {\n    // Pop-up bloqueado"));
  const beforeToast = blocked.slice(0, blocked.indexOf("notify("));
  assert.doesNotMatch(beforeToast, /deleteIntent/);
  assert.match(blocked, /duration: Infinity/);
  assert.match(blocked, /label: "Abrir"[\s\S]*deleteIntent[\s\S]*label: "Descartar"[\s\S]*deleteIntent/);
  assert.match(source, /runSingleFlush\(flushQueue\)\.catch/);
});

// P1: reenvio de avaliação não duplica o lead -------------------------------------
test("chave da solicitação: só aceita formato seguro", async () => {
  const { normalizeRequestKey } = await import("./lead-venda");
  assert.equal(normalizeRequestKey("q-abc123-xyz789"), "q-abc123-xyz789");
  assert.equal(normalizeRequestKey("  q-abc123-xyz789 "), "q-abc123-xyz789");
  assert.equal(normalizeRequestKey("curta"), null);
  assert.equal(normalizeRequestKey("com espaço e <script>"), null);
  assert.equal(normalizeRequestKey("x".repeat(65)), null);
  assert.equal(normalizeRequestKey(undefined), null);
});

test("avaliação: schema, migration (só arquivo), servidor e formulário usam a mesma chave", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (path: string) => readFileSync(path, "utf8");
  assert.match(read("prisma/schema.prisma"), /requestKey\s+String\?\s+@unique/);
  const migration = read("supabase/migrations/20261101000100_lead_venda_request_key.sql");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "requestKey"/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "LeadVenda_requestKey_key"/);
  assert.match(read("supabase/rollback/20261101000100_lead_venda_request_key.sql"), /DROP COLUMN IF EXISTS "requestKey"/);
  const lead = read("src/lib/lead-venda.ts");
  assert.match(lead, /findUnique\(\{\s*where: \{ requestKey \}/);
  assert.match(lead, /duplicate: true/);
  assert.match(lead, /P2002/);
  const action = read("src/app/(site)/vender/actions.ts");
  assert.match(action, /normalizeRequestKey\(text\(data, "requestKey"/);
  assert.match(action, /lead\.duplicate/);
  assert.match(read("src/components/site/SellForm.tsx"), /data\.set\("requestKey", requestKeyRef\.current\)/);
});

// P2 item 5: cumprimento composto tem resposta fixa -------------------------------
test('"Oi, tudo bem?" recebe a saudação fixa, sem depender da IA', async () => {
  for (const mensagem of ["Oi, tudo bem?", "Bom dia, tudo bem?", "oi tudo bem", "Olá, boa tarde!"]) {
    let chamouIa = false;
    const result = await runChatTurn({
      mensagem, historico: [], stock,
      generate: async () => { chamouIa = true; throw new Error("sem provedor"); },
    });
    assert.equal(result.reply.startsWith(GREETING_TEMPLATES.ping), true, `${mensagem}: ${result.reply}`);
    assert.equal(chamouIa, false, mensagem);
  }
  const busca = await runChatTurn({ mensagem: "Oi, tem Civic?", historico: [], stock, generate: noModel });
  assert.doesNotMatch(busca.reply, /^Oi, tô aqui/);
});

// P2 item 14: telefone do cliente ------------------------------------------------------
test("telefone brasileiro: aceita DDD com ou sem 55 e recusa sequência longa ou inventada", async () => {
  const { normalizeBrazilPhone } = await import("./phone-br");
  assert.equal(normalizeBrazilPhone("(27) 99633-0706"), "27996330706");
  assert.equal(normalizeBrazilPhone("+55 27 99633-0706"), "27996330706");
  assert.equal(normalizeBrazilPhone("(27) 3333-4444"), "2733334444");
  assert.equal(normalizeBrazilPhone("27996330706123456"), null);
  assert.equal(normalizeBrazilPhone("0123456789"), null);
  assert.equal(normalizeBrazilPhone("27 89633-0706"), null);
  assert.equal(normalizeBrazilPhone("9633-0706"), null);
  assert.equal(normalizeBrazilPhone(undefined), null);
});

for (const prefixo of ["você", "voce", "vc", "vcs", "vocês"]) {
  test(`"${prefixo} tem Onyx?" começa assunto novo`, () => {
    assert.equal(startsNewChatTopic(`${prefixo} tem Onyx?`, "carro"), true);
  });
}

for (const pergunta of ["você tem algum automático?", "voce tem alguma opção?", "vc tem algum carro?", "tem algum SUV?"]) {
  test(`"${pergunta}" não vira modelo`, () => {
    assert.equal(startsNewChatTopic(pergunta, "carro"), false);
  });
}
