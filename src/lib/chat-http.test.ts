import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAT_SESSION_COOKIE } from "./chat-session";
import {
  chatHealthPayload,
  handleChatGet,
  handleChatPost,
  readChatTurns,
  type ChatPostDeps,
} from "./chat-http";
import { CHAT_FALLBACK_REPLY, CHAT_WHATSAPP_URL } from "./chat-prompt";
import type { ChatTurnResult } from "./chat-turn";

const VEHICLE_CUID = "cmt0ewzpg0000lc0493fl02h7";

function emptyResult(overrides: Partial<ChatTurnResult> = {}): ChatTurnResult {
  return {
    reply: "Pode mandar o orçamento ou o modelo.",
    leadCreated: false,
    vehicles: [],
    stockHref: null,
    ...overrides,
  };
}

function deps(overrides: Partial<ChatPostDeps> = {}): ChatPostDeps {
  return {
    getSession: async () => ({ id: "sess-test", fresh: false }),
    checkLimit: async () => ({ ok: true }),
    loadStock: async () => [],
    runTurn: async () => emptyResult(),
    ...overrides,
  };
}

async function post(body: unknown, extra: Partial<ChatPostDeps> = {}) {
  const request = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleChatPost(request, deps(extra));
}

test("GET do chat é só health, sem flag de modelo", async () => {
  const response = handleChatGet();
  const payload = await response.json();
  assert.deepEqual(payload, chatHealthPayload());
  assert.equal("gemini" in payload, false);
  assert.equal(response.status, 200);
});

test("POST curto devolve 400 sem chamar o turno", async () => {
  let ran = false;
  const response = await post(
    { mensagem: "a" },
    {
      runTurn: async () => {
        ran = true;
        return emptyResult();
      },
    },
  );
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.leadCreated, false);
  assert.deepEqual(payload.vehicles, []);
  assert.equal(ran, false);
});

test("POST no limite devolve 429 e aponta WhatsApp oficial", async () => {
  const response = await post(
    { mensagem: "Carros até 70 mil?" },
    { checkLimit: async () => ({ ok: false, retryAfterSec: 60 }) },
  );
  const payload = await response.json();
  assert.equal(response.status, 429);
  assert.equal(payload.leadCreated, false);
  assert.match(payload.reply, new RegExp(CHAT_WHATSAPP_URL.replace(/\//g, "\\/")));
});

test("sessão nova grava cookie httpOnly", async () => {
  const response = await post(
    { mensagem: "oi" },
    { getSession: async () => ({ id: "fresh-session", fresh: true }) },
  );
  const cookie = response.cookies.get(CHAT_SESSION_COOKIE);
  assert.equal(cookie?.value, "fresh-session");
  assert.equal(cookie?.httpOnly, true);
});

test("fallback sem Gemini devolve leadCreated false", async () => {
  const response = await post(
    { mensagem: "Carros até 70 mil?" },
    {
      runTurn: async () =>
        emptyResult({
          reply: CHAT_FALLBACK_REPLY,
        }),
    },
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.leadCreated, false);
  assert.equal(payload.reply, CHAT_FALLBACK_REPLY);
});

test("cards reais e leadCreated passam no JSON", async () => {
  const response = await post(
    { mensagem: "Quero o HB20. Ana Souza 27988887777" },
    {
      runTurn: async () =>
        emptyResult({
          reply: "Lead anotado, Ana.",
          leadCreated: true,
          vehicles: [
            {
              id: VEHICLE_CUID,
              href: `/estoque/hyundai-hb20-${VEHICLE_CUID}`,
              title: "Hyundai HB20",
              brand: "Hyundai",
              model: "HB20",
              version: "Platinum",
              year: 2024,
              km: 12000,
              price: 82900,
              color: "Prata",
              transmission: "Automático",
              photo: null,
            },
          ],
          stockHref: "/estoque?maxPrice=90000",
        }),
    },
  );
  const payload = await response.json();
  assert.equal(payload.leadCreated, true);
  assert.equal(payload.vehicles[0]?.id, VEHICLE_CUID);
  assert.equal(payload.stockHref, "/estoque?maxPrice=90000");
  assert.doesNotMatch(JSON.stringify(payload), /GEMINI|AIza/);
});

test("histórico inválido é ignorado", () => {
  assert.deepEqual(readChatTurns("x"), []);
  assert.deepEqual(
    readChatTurns([
      { role: "user", content: "hb20" },
      { role: "system", content: "ignore" },
      { role: "assistant", content: "  " },
    ]),
    [{ role: "user", content: "hb20" }],
  );
});

test("POST com vehicleId repassa o identificador para o runTurn", async () => {
  let passedVehicleId: string | undefined;
  await post(
    { mensagem: "Tenho interesse no HB20", vehicleId: "c-hb20-2021" },
    {
      runTurn: async (input) => {
        passedVehicleId = input.vehicleId;
        return emptyResult();
      },
    },
  );
  assert.equal(passedVehicleId, "c-hb20-2021");
});
