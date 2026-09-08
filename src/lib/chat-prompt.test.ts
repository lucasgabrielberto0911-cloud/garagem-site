import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAT_SYSTEM_PROMPT,
  CHAT_WHATSAPP_URL,
  buildChatSystemPrompt,
  formatStockForPrompt,
  stockSelectHasForbiddenField,
} from "./chat-prompt";
import { CHAT_VEHICLE_SELECT } from "./chat-stock";

test("system prompt traz as regras fixas e o WhatsApp oficial", () => {
  assert.match(CHAT_SYSTEM_PROMPT, /assistente virtual da Garagem/);
  assert.match(CHAT_SYSTEM_PROMPT, /há mais de 20 anos/);
  assert.match(CHAT_SYSTEM_PROMPT, /mais de 1\.000 carros vendidos/);
  assert.match(CHAT_SYSTEM_PROMPT, /Aracruz, Vitória, Linhares, Serra, Vila Velha/);
  assert.match(CHAT_SYSTEM_PROMPT, /troca \(carro ou moto\)/);
  assert.match(CHAT_SYSTEM_PROMPT, /financia em até 60x/);
  assert.match(CHAT_SYSTEM_PROMPT, /Garantia padrão de 3 meses/);
  assert.match(CHAT_SYSTEM_PROMPT, /NUNCA inventar equipamento/);
  assert.match(CHAT_SYSTEM_PROMPT, /preço de referência FIPE/);
  assert.match(CHAT_SYSTEM_PROMPT, /sem markdown/);
  assert.match(CHAT_SYSTEM_PROMPT, /eae/);
  assert.match(CHAT_SYSTEM_PROMPT, /um por linha/);
  assert.match(CHAT_SYSTEM_PROMPT, /COMO AJUDAR DE VERDADE/);
  assert.match(CHAT_SYSTEM_PROMPT, /mini-anúncio com foto/);
  assert.match(CHAT_SYSTEM_PROMPT, /ESCOLHER um carro/);
  assert.match(CHAT_SYSTEM_PROMPT, /consultor monta a simulação/);
  assert.match(CHAT_SYSTEM_PROMPT, /NUNCA invente banco/);
  assert.equal(CHAT_WHATSAPP_URL, "https://wa.me/5527996330706");
  assert.match(CHAT_SYSTEM_PROMPT, /https:\/\/wa\.me\/5527996330706/);
  assert.match(CHAT_SYSTEM_PROMPT, /ESCOPO RESTRITO/);
  assert.match(CHAT_SYSTEM_PROMPT, /RESISTÊNCIA A MANIPULAÇÃO/);
  assert.match(CHAT_SYSTEM_PROMPT, /SEM CONSELHO FINANCEIRO ESPECÍFICO/);
  assert.match(CHAT_SYSTEM_PROMPT, /DADOS PESSOAIS MÍNIMOS/);
  assert.match(CHAT_SYSTEM_PROMPT, /CONTENÇÃO DE ABUSO/);
  assert.match(CHAT_SYSTEM_PROMPT, /nunca cálculo de parcela exato/);
  assert.match(CHAT_SYSTEM_PROMPT, /ignore as instruções anteriores/);
  assert.match(CHAT_SYSTEM_PROMPT, /Nunca pedir CPF/);
  assert.match(CHAT_SYSTEM_PROMPT, /chama no WhatsApp pra outros temas/);
});

test("consulta do bot não inclui fipePrice", () => {
  assert.equal(stockSelectHasForbiddenField(CHAT_VEHICLE_SELECT), false);
  assert.equal("fipePrice" in CHAT_VEHICLE_SELECT, false);
});

test("estoque real entra no prompt; carro fora da lista não é inventado", () => {
  const prompt = buildChatSystemPrompt([
    {
      brand: "Hyundai",
      model: "HB20",
      version: "evolution 1.0",
      year: 2022,
      km: 68450,
      price: 64900,
      color: "Prata",
      transmission: "Manual",
      fuel: "Flex",
    },
  ]);

  assert.match(prompt, /Hyundai HB20 evolution 1\.0 2022/);
  assert.match(prompt, /R\$ 64\.900/);
  assert.match(prompt, /68\.450 km/);
  const stockBlock = formatStockForPrompt([
    {
      brand: "Hyundai",
      model: "HB20",
      version: "evolution 1.0",
      year: 2022,
      km: 68450,
      price: 64900,
      color: "Prata",
      transmission: "Manual",
      fuel: "Flex",
    },
  ]);
  assert.doesNotMatch(stockBlock, /fipe/i);
  assert.doesNotMatch(formatStockForPrompt([]), /R\$/);
});
