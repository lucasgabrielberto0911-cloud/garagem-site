import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStockPending, stockPendingWhere } from "./admin-stock-pending";
import { staleCutoffDate } from "./stock-quality";

test("pendências aceitam apenas filtros conhecidos e preservam a regra dos 60 dias", () => {
  assert.equal(parseStockPending("todos"), "");
  assert.equal(parseStockPending("sem-fotos"), "sem-fotos");
  assert.deepEqual(stockPendingWhere("sem-fotos"), { photos: { none: {} } });
  assert.deepEqual(stockPendingWhere(""), {});
  const before = Date.now() - 60 * 86400000;
  const result = stockPendingWhere("antigos");
  assert.equal(result.status, "disponivel");
  const cutoff = (result.createdAt as { lt: Date }).lt.getTime();
  assert.ok(cutoff >= before && cutoff <= Date.now() - 60 * 86400000);
});

test("parseStockPending: sanitiza entradas inválidas, nulas e desconhecidas", () => {
  assert.equal(parseStockPending(null), "");
  assert.equal(parseStockPending(undefined), "");
  assert.equal(parseStockPending(""), "");
  assert.equal(parseStockPending("   "), "");
  assert.equal(parseStockPending("invalido"), "");
  assert.equal(parseStockPending("SEM-FOTOS"), "");
  assert.equal(parseStockPending("ANTIGOS"), "");
  assert.equal(parseStockPending("consignado"), "");
  assert.equal(parseStockPending("sem-preco"), "");
});

test("stockPendingWhere: pendência de fotos usa photos.none para identificar veículos sem imagem", () => {
  const where = stockPendingWhere("sem-fotos");
  assert.deepEqual(where, { photos: { none: {} } });
});

test("stockPendingWhere: pendência de antigos restringe a status disponivel e data de corte", () => {
  const where = stockPendingWhere("antigos");
  assert.equal(where.status, "disponivel");

  const expectedCutoff = staleCutoffDate().getTime();
  const actualCutoff = (where.createdAt as { lt: Date }).lt.getTime();

  // A data de corte calculada deve ser exata com staleCutoffDate (60 dias)
  assert.ok(Math.abs(actualCutoff - expectedCutoff) < 1000);
});

test("stockPendingWhere: vazio não restringe campos nem status", () => {
  assert.deepEqual(stockPendingWhere(""), {});
});

test("cenário de negócio: consignados e próprios no estoque com pendências", () => {
  // Tanto veículos próprios quanto consignados no estoque estão sujeitos às pendências:
  // 1. Veículo sem foto cadastrada
  const pendenciaFotos = stockPendingWhere(parseStockPending("sem-fotos"));
  assert.deepEqual(pendenciaFotos, { photos: { none: {} } });

  // 2. Veículo antigo (>60 dias) disponível
  const pendenciaAntigos = stockPendingWhere(parseStockPending("antigos"));
  assert.equal(pendenciaAntigos.status, "disponivel");
  assert.ok((pendenciaAntigos.createdAt as { lt: Date }).lt instanceof Date);

  // 3. Filtro sem pendência retorna objeto limpo
  const pendenciaLimpa = stockPendingWhere(parseStockPending("todos"));
  assert.deepEqual(pendenciaLimpa, {});
});
