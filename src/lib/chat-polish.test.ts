import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyChatReplyGuards,
  closeTruncatedReply,
  ensureWarrantyCopy,
  looksTruncated,
  polishPortuguese,
  stripInventedAccessories,
} from "./chat-polish";
import type { ChatVehicleRecord } from "./chat-stock";

const etios: ChatVehicleRecord = {
  id: "c-etios-xs",
  brand: "Toyota",
  model: "Etios",
  version: "XS",
  yearModel: 2017,
  km: 90000,
  price: 60900,
  color: "Branco",
  transmission: "Automático",
  fuel: "Flex",
  accessories: ["Ar-condicionado", "Bluetooth"],
};

test("detecta resposta cortada no meio da frase", () => {
  assert.equal(looksTruncated("O Etios tem ar-condicionado, direção", "STOP"), true);
  assert.equal(looksTruncated("O Etios tem ar-condicionado e", "STOP"), true);
  assert.equal(looksTruncated("Beleza, te mostro o estoque.", "STOP"), false);
  assert.equal(
    looksTruncated("Hyundai HB20 2022 · 68.450 km · R$ 64.900", "STOP"),
    false,
  );
  assert.equal(looksTruncated("texto incompleto", "MAX_TOKENS"), true);
});

test("fecha no último ponto e não deixa frase pela metade", () => {
  const closed = closeTruncatedReply(
    "O Etios tem ar-condicionado. Também tem direção",
  );
  assert.equal(closed, "O Etios tem ar-condicionado.");
});

test("corrige pelo loja e reescreve garantia", () => {
  assert.equal(
    polishPortuguese("A avaliação é feita pelo loja no WhatsApp."),
    "A avaliação é feita pela loja no WhatsApp.",
  );
  assert.match(
    ensureWarrantyCopy("Todos os seminovos saem com garantia de 3 meses."),
    /3 meses de motor e câmbio/,
  );
});

test("acessório inventado some; o da ficha permanece", () => {
  const raw =
    "O Etios tem ar digital e multimídia, além de Bluetooth e ar-condicionado.";
  const cleaned = stripInventedAccessories(raw, [etios]);
  assert.doesNotMatch(cleaned, /ar digital/i);
  assert.doesNotMatch(cleaned, /multimídia/i);
  assert.match(cleaned, /Bluetooth/i);
  assert.match(cleaned, /ar-condicionado/i);
});

test("guards combinam polimento, garantia e corte", () => {
  const text = applyChatReplyGuards(
    "A garantia de 3 meses é dada pelo loja, com ar digital e",
    [etios],
    { truncated: true },
  );
  assert.match(text, /pela loja/);
  assert.match(text, /motor e câmbio/);
  assert.doesNotMatch(text, /ar digital/i);
});
