import assert from "node:assert/strict";
import test from "node:test";
import { runChatTurn } from "./chat-turn";
import { scopeChatMessage, type ChatVehicleRecord } from "./chat-stock";
import type { ChatTurn } from "./chat-gemini";

const car = (id: string, brand: string, model: string, version: string, yearModel: number, engine: string, price: number, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord => ({
  id, brand, model, version, yearModel, engine, transmission: "Automático", fuel: "Flex", category: "carro", color: null, price, km: 50000, ...extra,
});
const stock = [
  car("hb", "Hyundai", "HB20", "Premium 1.0", 2019, "1.0", 60000),
  car("civic", "Honda", "Civic", "EXL 2.0", 2018, "2.0", 95000, { consigned: true }),
  car("kicks", "Nissan", "Kicks", "SL 1.6 CVT", 2019, "1.6", 90000),
];
const historico: ChatTurn[] = [
  { role: "user", content: "automático até 70 mil" },
  { role: "assistant", content: "Olha os automáticos até R$ 70.000." },
];
const noModel = async () => { throw new Error("sem provedor"); };

test("pergunta geral 'mais econômico' não herda o teto de 70 mil nem o câmbio", () => {
  const scoped = scopeChatMessage("Qual o mais econômico?", historico, stock);
  assert.doesNotMatch(scoped, /70|mil|automático/i);
});

test("follow-up explícito ainda herda o recorte", () => {
  assert.match(scopeChatMessage("qual desses é o mais econômico?", historico, stock), /70 mil/);
});

test("mais econômico: ordena pela ficha, links em negrito, máx. 3, sem local nem parcela", async () => {
  const result = await runChatTurn({ mensagem: "Qual o mais econômico?", historico, stock, generate: noModel });
  const rows = result.reply.split("\n").filter((line) => line.startsWith("• "));
  assert.ok(rows.length >= 2 && rows.length <= 3, result.reply);
  for (const row of rows) assert.match(row, /^• \*\*\[[^\]]+\]\(\/estoque\/[^)]+\)\*\* — \d+,\d km\/l/);
  assert.match(rows[0]!, /Kicks/);
  assert.match(rows[1]!, /Civic/); // consignado aparece normalmente
  assert.doesNotMatch(result.reply, /Linhares|parcela|taxa|juros/i);
});
