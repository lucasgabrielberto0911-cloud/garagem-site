import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";

// Uso: DATABASE_URL local com schema=reconcile_soldat_test_<nome>, já criado por db push.
test("reconcilia datas, preserva histórico, é idempotente e reverte toda a transação em caso de erro", async () => {
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "Exporte DATABASE_URL do banco local de teste.");
  const target = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname));
  assert.match(target.searchParams.get("schema") ?? "", /^reconcile_soldat_test_[a-z0-9_]+$/);
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const ids = Array.from({ length: 6 }, () => randomUUID());
  const updatedAt = new Date("2026-10-20T12:00:00Z");
  const saleDate = new Date("2025-01-02T12:00:00Z");
  const existingDate = new Date("2024-01-02T12:00:00Z");
  function run(url = databaseUrl) {
    return spawnSync(process.execPath, ["--import", "tsx", "prisma/scripts/reconcile-soldAt.ts"], {
      encoding: "utf8", timeout: 30000,
      env: { ...process.env, DATABASE_URL: url, ALLOW_REMOTE_RECONCILE_SOLD_AT: "false" },
    });
  }
  try {
    await prisma.vehicle.createMany({ data: ids.map((id, index) => ({
      id, brand: "Teste", model: "Reconciliação", year: 2020, yearModel: 2020,
      km: 1, price: 1, fuel: "Flex", transmission: "Manual", updatedAt,
      status: index < 3 ? "vendido" : index === 4 ? "reservado" : "disponivel",
      soldAt: index >= 2 && index <= 4 ? existingDate : null,
    })) });
    await prisma.sale.createMany({ data: [1, 2].map(index => ({
      vehicleId: ids[index], salePrice: 1, paymentMethod: "Pix", saleDate,
    })) });

    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /Vendidos sem soldAt corrigidos: 2/);
    assert.match(first.stdout, /Não vendidos com soldAt limpos: 2/);
    const rows = await prisma.vehicle.findMany({ where: { id: { in: ids } } });
    for (const [index, id] of ids.entries()) {
      const row = rows.find(vehicle => vehicle.id === id)!;
      const expected = [updatedAt, saleDate, existingDate, null, null, null][index];
      assert.equal(row.soldAt?.toISOString() ?? null, expected?.toISOString() ?? null);
      assert.equal(row.updatedAt.toISOString(), updatedAt.toISOString());
    }
    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /Vendidos sem soldAt corrigidos: 0/);
    assert.match(second.stdout, /Não vendidos com soldAt limpos: 0/);

    await prisma.vehicle.updateMany({ where: { id: { in: ids.slice(0, 2) } }, data: { soldAt: null } });
    await prisma.vehicle.update({ where: { id: ids[4] }, data: { soldAt: existingDate } });
    await prisma.$executeRaw`ALTER TABLE "Vehicle" ADD CONSTRAINT "reconcile_soldat_test_reject_clear"
      CHECK ("status" <> 'reservado' OR "soldAt" IS NOT NULL)`;
    const failed = run();
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /Nenhuma alteração foi confirmada/);
    assert.doesNotMatch(failed.stdout, /corrigidos:|limpos:/);
    assert.equal(await prisma.vehicle.count({ where: { id: { in: ids.slice(0, 2) }, soldAt: null } }), 2);
    assert.equal((await prisma.vehicle.findUniqueOrThrow({ where: { id: ids[4] } })).soldAt?.toISOString(), existingDate.toISOString());

    const remote = run("postgresql://usuario:segredo@banco.invalid:5432/teste");
    assert.equal(remote.status, 1);
    assert.doesNotMatch(remote.stdout + remote.stderr, /segredo/);
  } finally {
    await prisma.$executeRaw`ALTER TABLE "Vehicle" DROP CONSTRAINT IF EXISTS "reconcile_soldat_test_reject_clear"`;
    await prisma.sale.deleteMany({ where: { vehicleId: { in: ids } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
