import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("edição M5 abre o sheet pelo nome do veículo, não um dialog genérico", () => {
  const source = readFileSync("e2e/admin-veiculo-edicao.spec.ts", "utf8");
  assert.match(source, /ensureNoUnsavedDialog/);
  assert.match(source, /new RegExp\(fixture\.modelName\)/);
});

test("venda com cliente novo espera o listbox fechar antes do checkbox", () => {
  const source = readFileSync("e2e/admin-comercial.spec.ts", "utf8");
  assert.match(source, /ensureNoUnsavedDialog/);
  assert.match(source, /getByRole\("listbox"\)/);
});
