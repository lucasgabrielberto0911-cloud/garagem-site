/**
 * Uso: exporte DATABASE_URL de um banco local/isolado e rode
 * npx tsx prisma/scripts/reconcile-soldAt.ts após a migração 20261022180400.
 * Em host remoto, exige autorização operacional separada e
 * ALLOW_REMOTE_RECONCILE_SOLD_AT=true. Não carrega arquivos .env.
 * Prefere Sale.saleDate; sem venda, usa Vehicle.updatedAt como estimativa.
 * Preserva datas já preenchidas e updatedAt; a segunda execução altera zero linhas.
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");
  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL inválida.");
  }
  if (!["postgres:", "postgresql:"].includes(target.protocol)) {
    throw new Error("DATABASE_URL deve apontar para PostgreSQL.");
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
    && process.env.ALLOW_REMOTE_RECONCILE_SOLD_AT !== "true") {
    throw new Error("Reconciliação bloqueada: banco remoto exige autorização explícita.");
  }

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const result = await prisma.$transaction(async (tx) => {
      // SQL evita que @updatedAt troque a data usada como fallback na reconciliação.
      const filled = await tx.$executeRaw`
        UPDATE "Vehicle" AS vehicle
        SET "soldAt" = COALESCE(
          (SELECT sale."saleDate" FROM "Sale" AS sale WHERE sale."vehicleId" = vehicle."id"),
          vehicle."updatedAt"
        )
        WHERE vehicle."status" = 'vendido' AND vehicle."soldAt" IS NULL
      `;
      const cleared = await tx.$executeRaw`
        UPDATE "Vehicle" SET "soldAt" = NULL
        WHERE "status" <> 'vendido' AND "soldAt" IS NOT NULL
      `;
      const inconsistent = await tx.vehicle.count({
        where: { OR: [
          { status: "vendido", soldAt: null },
          { status: { not: "vendido" }, soldAt: { not: null } },
        ] },
      });
      if (inconsistent !== 0) throw new Error("Reconciliação inconsistente; transação revertida.");
      return { filled, cleared };
    });
    console.log(`Vendidos sem soldAt corrigidos: ${result.filled}`);
    console.log(`Não vendidos com soldAt limpos: ${result.cleared}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error("Reconciliação não concluída; confira DATABASE_URL, autorização e migração 20261022180400. Nenhuma alteração foi confirmada.");
  process.exitCode = 1;
});
