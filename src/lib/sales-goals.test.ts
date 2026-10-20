import test from "node:test";
import assert from "node:assert/strict";
import {
  computeMonthlySalesGoal,
  computeSalesLeaderboard,
  extractSaleSeller,
  extractSaleCommission,
  formatSaleNotes,
} from "./sales-goals";

test("computeMonthlySalesGoal: calcula progresso, restantes e ritmo diário", () => {
  // Dia 15 de um mês de 31 dias (ex: 15 de Outubro de 2026) -> 17 dias restantes (31 - 15 + 1)
  const now = new Date(2026, 9, 15);
  const result = computeMonthlySalesGoal({
    now,
    salesCount: 6,
    salesRevenue: 300_000,
    goalUnits: 10,
    goalRevenue: 500_000,
  });

  assert.equal(result.monthCount, 6);
  assert.equal(result.goalUnits, 10);
  assert.equal(result.unitsPercent, 60);
  assert.equal(result.revenuePercent, 60);
  assert.equal(result.unitsRemaining, 4);
  assert.equal(result.revenueRemaining, 200_000);
  assert.equal(result.daysRemaining, 17);
  // 4 restantes / 17 dias = ~0.24 carros/dia
  assert.equal(result.paceNeededPerDay, 0.24);
  assert.equal(result.isGoalReached, false);
});

test("computeMonthlySalesGoal: atinge e supera a meta", () => {
  const result = computeMonthlySalesGoal({
    salesCount: 12,
    salesRevenue: 600_000,
    goalUnits: 10,
    goalRevenue: 500_000,
  });

  assert.equal(result.unitsPercent, 100);
  assert.equal(result.revenuePercent, 100);
  assert.equal(result.unitsRemaining, 0);
  assert.equal(result.isGoalReached, true);
});

test("extractSaleSeller e extractSaleCommission: extrai de campos diretos ou de notes", () => {
  // Campo direto
  assert.equal(extractSaleSeller({ sellerName: "Carlos" }), "Carlos");
  assert.equal(
    extractSaleCommission({ salePrice: 100_000, commission: 1500 }),
    1500,
  );

  // Fallback padrão 1,5%
  assert.equal(
    extractSaleCommission({ salePrice: 100_000, commission: null }, 1.5),
    1500,
  );

  // Embutido em notes
  const notesWithMeta = "Cliente de Linhares [vendedor: Roberto | comissao: 1800]";
  assert.equal(extractSaleSeller({ notes: notesWithMeta }), "Roberto");
  assert.equal(
    extractSaleCommission({ salePrice: 100_000, notes: notesWithMeta }),
    1800,
  );
});

test("formatSaleNotes: formata notas preservando texto e metadados", () => {
  const notes = formatSaleNotes("Pago à vista no PIX", "Lucas", 2000);
  assert.equal(notes, "Pago à vista no PIX [vendedor: Lucas | comissao: 2000]");

  const clean = formatSaleNotes(
    "Pago à vista no PIX [vendedor: Lucas | comissao: 2000]",
    "Marcos",
    2500,
  );
  assert.equal(clean, "Pago à vista no PIX [vendedor: Marcos | comissao: 2500]");
});

test("computeSalesLeaderboard: agrega por vendedor e ranqueia vendas", () => {
  const sales = [
    {
      id: "s1",
      salePrice: 100_000,
      sellerName: "Lucas",
      commission: 1500,
    },
    {
      id: "s2",
      salePrice: 80_000,
      sellerName: "Lucas",
      commission: 1200,
    },
    {
      id: "s3",
      salePrice: 120_000,
      sellerName: "Carlos",
      commission: 1800,
    },
    {
      id: "s4",
      salePrice: 50_000,
      sellerName: null,
      notes: "Sem vendedor",
    },
  ];

  const result = computeSalesLeaderboard(sales, 1.5);
  // Total comissão: 1500 + 1200 + 1800 + (50.000 * 1,5% = 750) = 5250
  assert.equal(result.totalCommission, 5250);

  // Lucas: 2 vendas, 180k faturamento, 2700 comissão
  // Carlos: 1 venda, 120k faturamento, 1800 comissão
  // Geral: 1 venda, 50k faturamento, 750 comissão
  assert.equal(result.leaderboard[0].seller, "Lucas");
  assert.equal(result.leaderboard[0].count, 2);
  assert.equal(result.leaderboard[0].revenue, 180_000);
  assert.equal(result.leaderboard[0].commission, 2700);

  assert.equal(result.leaderboard[1].seller, "Carlos");
  assert.equal(result.leaderboard[2].seller, "Geral");
});
