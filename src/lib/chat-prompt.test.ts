import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAT_PING_REPLY,
  CHAT_SYSTEM_PROMPT,
  CHAT_WHATSAPP_URL,
  buildChatSystemPrompt,
  formatStockForPrompt,
  stockSelectHasForbiddenField,
} from "./chat-prompt";
import { CHAT_VEHICLE_SELECT } from "./chat-stock";

test("saudação de ping ajuda a escolher sem jargão de 60x", () => {
  assert.match(CHAT_PING_REPLY, /estoque/);
  assert.match(CHAT_PING_REPLY, /orçamento|modelo/);
  assert.doesNotMatch(CHAT_PING_REPLY, /60x/);
});

test("system prompt traz as regras fixas e o WhatsApp oficial", () => {
  assert.match(CHAT_SYSTEM_PROMPT, /assistente virtual da Garagem/);
  assert.match(CHAT_SYSTEM_PROMPT, /há mais de 20 anos/);
  assert.match(CHAT_SYSTEM_PROMPT, /mais de 1\.000 carros vendidos/);
  assert.match(CHAT_SYSTEM_PROMPT, /Aracruz, Vitória, Linhares, Serra, Vila Velha/);
  assert.match(CHAT_SYSTEM_PROMPT, /troca \(carro ou moto\)/);
  assert.match(CHAT_SYSTEM_PROMPT, /financia em até 60x/);
  assert.match(CHAT_SYSTEM_PROMPT, /cartão de crédito em até 18x/);
  assert.match(CHAT_SYSTEM_PROMPT, /POLÍTICA DA LOJA/);
  assert.match(CHAT_SYSTEM_PROMPT, /Garantia padrão de 3 meses/);
  assert.match(CHAT_SYSTEM_PROMPT, /NUNCA inventar equipamento/);
  assert.match(CHAT_SYSTEM_PROMPT, /preço de referência FIPE/);
  assert.match(CHAT_SYSTEM_PROMPT, /sem markdown/);
  assert.match(CHAT_SYSTEM_PROMPT, /eae/);
  assert.match(CHAT_SYSTEM_PROMPT, /um por linha/);
  assert.match(CHAT_SYSTEM_PROMPT, /COMO AJUDAR DE VERDADE/);
  assert.match(CHAT_SYSTEM_PROMPT, /mini-anúncio com foto/);
  assert.match(CHAT_SYSTEM_PROMPT, /não pergunte hatch/);
  assert.match(CHAT_SYSTEM_PROMPT, /faixa típica de catálogo/);
  assert.match(CHAT_SYSTEM_PROMPT, /2 a 4 frases comparando/);
  assert.match(CHAT_SYSTEM_PROMPT, /Não comece com/);
  assert.match(CHAT_SYSTEM_PROMPT, /frase falada de recorte/);
  assert.match(CHAT_SYSTEM_PROMPT, /consultor humano/);
  assert.match(CHAT_SYSTEM_PROMPT, /um pouco animado/);
  assert.match(CHAT_SYSTEM_PROMPT, /Nunca começar com “não posso”/);
  assert.match(CHAT_SYSTEM_PROMPT, /NUNCA invente outro número/);
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
      engine: "1.0 12V",
      doors: 4,
      accessories: ["Ar condicionado", "Direção hidráulica"],
    },
  ]);
  assert.match(stockBlock, /motor 1\.0 12V/);
  assert.match(stockBlock, /4 portas/);
  assert.match(stockBlock, /Ar condicionado/);
  assert.match(stockBlock, /consumo típico|faixa típica de catálogo/);
  assert.match(stockBlock, /11–14 km\/l/);
  assert.match(stockBlock, /não foi medido/);
  assert.doesNotMatch(stockBlock, /fipe/i);
  assert.doesNotMatch(formatStockForPrompt([]), /R\$/);
});
