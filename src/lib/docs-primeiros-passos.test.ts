import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("primeiros passos e runbook de ambiente existem e apontam conflitos e banco local", () => {
  const passos = readFileSync("docs/PRIMEIROS-PASSOS-IA.md", "utf8");
  const ambiente = readFileSync("docs/runbooks/ambiente-agente.md", "utf8");
  const indice = readFileSync("docs/README.md", "utf8");
  assert.match(passos, /agentes-conflitos/);
  assert.match(passos, /revalidatePublicStock/);
  assert.match(ambiente, /DATABASE_URL/);
  assert.match(ambiente, /R2_/);
  assert.match(indice, /PRIMEIROS-PASSOS-IA/);
  assert.match(readFileSync("docs/prompts/antigravity.md", "utf8"), /agy\//);
});
