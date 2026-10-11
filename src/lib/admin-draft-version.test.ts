import assert from "node:assert/strict";
import { test } from "node:test";
import { draftVersionMatches } from "./admin-draft-version";

test("rascunhos só criam sem versão existente e só atualizam a versão lida", () => {
  const first = new Date("2026-10-05T12:00:00Z");
  const second = new Date("2026-10-05T12:00:01Z");
  assert.equal(draftVersionMatches(null, null), true);
  assert.equal(draftVersionMatches(null, first), false);
  assert.equal(draftVersionMatches(first.toISOString(), first), true);
  assert.equal(draftVersionMatches(first.toISOString(), second), false);
  assert.equal(draftVersionMatches(first.toISOString(), null), false);
});

test("concorrência entre abas: segunda aba detecta conflito quando a primeira já salvou", () => {
  const v0 = new Date("2026-10-05T14:00:00.000Z");
  const v1 = new Date("2026-10-05T14:00:05.123Z");

  // Ambas as abas leram a versão v0
  const expectedAbaA = v0.toISOString();
  const expectedAbaB = v0.toISOString();

  // Aba A salva primeiro: o banco atualiza para v1
  assert.equal(draftVersionMatches(expectedAbaA, v0), true);

  // Aba B tenta salvar logo depois com a versão antiga v0 contra o banco agora em v1
  assert.equal(draftVersionMatches(expectedAbaB, v1), false);
});

test("tentativa de criar novo rascunho colide se outra aba já criou", () => {
  const criadoPorOutraAba = new Date("2026-10-05T15:30:00.000Z");
  // Aba que achava que estava criando do zero (expected null) encontra rascunho existente
  assert.equal(draftVersionMatches(null, criadoPorOutraAba), false);
});

test("salvamento sequencial legítimo pela mesma aba avança versão com sucesso", () => {
  const t1 = new Date("2026-10-05T10:00:00.000Z");
  const t2 = new Date("2026-10-05T10:01:00.000Z");
  const t3 = new Date("2026-10-05T10:02:00.000Z");

  // 1. Criação inicial sem versão prévia
  assert.equal(draftVersionMatches(null, null), true);

  // 2. Primeiro autosave com a versão t1 obtida na criação
  assert.equal(draftVersionMatches(t1.toISOString(), t1), true);

  // 3. Segundo autosave com a versão t2 obtida após a primeira gravação
  assert.equal(draftVersionMatches(t2.toISOString(), t2), true);

  // 4. Terceiro autosave com a versão t3
  assert.equal(draftVersionMatches(t3.toISOString(), t3), true);
});

test("diferença mínima de 1 milissegundo gera conflito", () => {
  const tBase = new Date("2026-10-05T12:00:00.000Z");
  const tDiff1ms = new Date("2026-10-05T12:00:00.001Z");
  assert.equal(draftVersionMatches(tBase.toISOString(), tDiff1ms), false);
});

test("entradas inválidas, indefinidas e tipos incorretos não casam com versão", () => {
  const current = new Date("2026-10-05T12:00:00.000Z");

  // undefined não é aceito como equivalente a null
  assert.equal(draftVersionMatches(undefined, null), false);
  assert.equal(draftVersionMatches(undefined, current), false);

  // Strings vazias ou lixo
  assert.equal(draftVersionMatches("", null), false);
  assert.equal(draftVersionMatches("", current), false);
  assert.equal(draftVersionMatches("data-invalida", current), false);

  // Tipos não-string (número, boolean, objeto, instância de Date direta)
  assert.equal(draftVersionMatches(1728129600000, current), false);
  assert.equal(draftVersionMatches(true, current), false);
  assert.equal(draftVersionMatches({}, current), false);
  assert.equal(draftVersionMatches(current, current), false);
});
