import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { redactPurchaseText } from "./admin-ai/redact";
import { parseReview, applySuggestions } from "./admin-ai/revisar-texto";
import { captionBlocks, parseCaption, type CaptionFacts } from "./admin-ai/melhorar-legenda";
import { parseHelp } from "./admin-ai/ajuda-painel";
import { parseFacts, runAdminAi } from "./admin-ai/service";
import { completeNvidia } from "./admin-ai/nvidia-client";

const originalKey = process.env.ADMIN_AI_NVIDIA_API_KEY, fallback = process.env.NVIDIA_API_KEY;
beforeEach(() => { process.env.ADMIN_AI_NVIDIA_API_KEY = "chave-ficticia-ia"; delete process.env.NVIDIA_API_KEY; });
afterEach(() => { if (originalKey === undefined) delete process.env.ADMIN_AI_NVIDIA_API_KEY; else process.env.ADMIN_AI_NVIDIA_API_KEY = originalKey; if (fallback === undefined) delete process.env.NVIDIA_API_KEY; else process.env.NVIDIA_API_KEY = fallback; });
const complete = (data: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify(data) } }] });
const correction = { start: 0, end: 4, original: "Otmo", replacement: "Ótimo", category: "ortografia", reason: "Correção de grafia." };
const facts: CaptionFacts = { brand: "Honda", model: "Civic", version: "EXL 2.0", description: "Aceita troca após avaliação.", accessories: ["Conforto: Ar-condicionado"], data: { year: "2018", yearModel: "2019", km: "50.000", price: "95.000,00", fuel: "Flex", transmission: "CVT" } };

test("dados pessoais são removidos sem depender do prompt", () => {
  const text = "Cliente: João da Silva; CPF: 123.456.789-09; Placa ABC1D23; (27) 99999-1234; chassi 9BWZZZ377VT004251; RENAVAM 12345678901; teste@exemplo.com\ncliente Maria Souza";
  const safe = redactPurchaseText(text);
  for (const value of ["João", "Maria", "123.456", "ABC1D23", "99999", "9BWZZZ", "12345678901", "teste@exemplo.com"]) assert.ok(!safe.includes(value), value);
});
test("revisão usa posições verificadas, seleção e rejeita números alterados e sobreposição", () => {
  const text = "Otmo veículo 2018.";
  assert.equal(applySuggestions(text, parseReview({ suggestions: [correction] }, text)), "Ótimo veículo 2018.");
  assert.equal(applySuggestions(text, []), text);
  for (const raw of [null, { suggestions: {} }, { suggestions: [correction, correction] }, { suggestions: [{ ...correction, start: 1 }] }, { suggestions: [{ ...correction, category: "inventada" }] }, { suggestions: [{ ...correction, replacement: "Ótimo 2026" }] }]) assert.throws(() => parseReview(raw, text));
});
test("legenda aceita somente ficha e preserva números, itens e condições", () => {
  const blocks = captionBlocks(facts);
  const valid = blocks.map(block => ({ id: block.id, text: block.choices[0] }));
  const result = parseCaption({ blocks: valid }, blocks);
  for (const value of ["2018", "2019", "50.000", "95.000,00", "Ar-condicionado", "Aceita troca após avaliação.", "EXL 2.0"]) assert.ok(result.includes(value), value);
  for (const invented of ["Teto solar", "Único dono", "Revisado", "Sem detalhes", "Garantia", "Laudo aprovado", "Ano: 2024", "Km: 10.000", "Preço: 1,00"]) {
    assert.throws(() => parseCaption({ blocks: valid.map((block, i) => i === 1 ? { ...block, text: `${block.text}\n${invented}` } : block) }, blocks), /bloqueada/);
  }
  assert.throws(() => parseCaption({ blocks: valid.slice(0, -1) }, blocks));
  assert.throws(() => parseCaption({ blocks: [valid[0], valid[0], valid[2]] }, blocks));
  assert.throws(() => parseFacts({ ...facts, accessories: [null] }));
  assert.throws(() => parseFacts({ ...facts, description: "Cliente: Maria Souza" }));
});
test("sem chave não usa fallback de compra nem chama rede; falhas e JSON inválido ficam indisponíveis", async t => {
  delete process.env.ADMIN_AI_NVIDIA_API_KEY; process.env.NVIDIA_API_KEY = "somente-compra";
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Rede proibida"); });
  await assert.rejects(runAdminAi("revisar-texto", { text: "Otmo" }));
  assert.equal(fetch.mock.callCount(), 0);
  process.env.ADMIN_AI_NVIDIA_API_KEY = "chave-ficticia-ia";
  for (const response of [new Response(null, { status: 429 }), new Response("inválido"), complete({ answer: 10 }), Response.json({ choices: [{ message: { content: "{texto" } }] })]) {
    fetch.mock.mockImplementation(async () => response);
    await assert.rejects(runAdminAi("ajuda-painel", { question: `Caso ${Math.random()}` }));
  }
  fetch.mock.mockImplementation(async () => { throw new DOMException("Prazo", "TimeoutError"); });
  await assert.rejects(runAdminAi("ajuda-painel", { question: "Timeout específico" }));
});
test("contexto de ajuda é estático, sem ferramentas; pergunta é anonimizada e cache deduplica", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.tools, undefined);
    assert.equal(body.messages.length, 2);
    assert.match(body.messages[0].content, /Guia do painel/);
    assert.ok(!body.messages[1].content.includes("João"));
    assert.equal(init?.cache, "no-store"); assert.ok(init?.signal);
    return complete({ answer: "Abra Veículos e use Novo veículo." });
  });
  const question = "Como cadastrar? Cliente: João Silva";
  assert.match((await runAdminAi("ajuda-painel", { question })).answer!, /Veículos/);
  await runAdminAi("ajuda-painel", { question }); assert.equal(fetch.mock.callCount(), 1);
  assert.throws(() => parseHelp({ answer: "" }));
});
test("textos sensíveis e entradas grandes falham antes de enviar; respostas são validadas", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => complete({ suggestions: [correction] }));
  await assert.rejects(runAdminAi("revisar-texto", { text: "Cliente: Maria Souza" }));
  await assert.rejects(runAdminAi("revisar-texto", { text: "a".repeat(8001) }));
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal((await runAdminAi("revisar-texto", { text: "Otmo carro." })).suggestions?.length, 1);
  fetch.mock.mockImplementation(async () => complete({ suggestions: [{ ...correction, replacement: "Ótimo 100" }] }));
  await assert.rejects(runAdminAi("revisar-texto", { text: "Otmo carro diferente." }));
  fetch.mock.mockImplementation(async (_url: unknown, init?: RequestInit) => {
    const payload = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
    return complete({ blocks: payload.blocks.map((block: { id: string; choices: string[] }) => ({ id: block.id, text: block.choices[0] })) });
  });
  assert.match((await runAdminAi("melhorar-legenda", { facts })).text!, /Civic/);
});
test("cliente NVIDIA não aceita envelope sem conteúdo", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ choices: [] }));
  await assert.rejects(completeNvidia("envelope-invalido-teste", {}, "Somente JSON."));
});
