import { PrismaClient } from "@prisma/client";
import { resolveSoldAtDate } from "../../src/lib/vehicle-sold";

const prisma = new PrismaClient();

export type ReconcileResult = {
  dryRun: boolean;
  toSetCount: number;
  toClearCount: number;
  updatedVehicles: Array<{ id: string; model: string; soldAt: Date }>;
  clearedVehicles: Array<{ id: string; model: string }>;
};

export async function reconcileSoldAt(options: { dryRun?: boolean } = {}): Promise<ReconcileResult> {
  const dryRun = Boolean(options.dryRun);

  // 1. Veículos com status "VENDIDO" e soldAt nulo
  const vehiclesToSet = await prisma.vehicle.findMany({
    where: {
      status: "VENDIDO",
      soldAt: null,
    },
    include: {
      sale: true,
    },
  });

  // 2. Veículos com status diferente de "VENDIDO" e soldAt preenchido
  const vehiclesToClear = await prisma.vehicle.findMany({
    where: {
      status: { not: "VENDIDO" },
      soldAt: { not: null },
    },
    select: {
      id: true,
      model: true,
      status: true,
      soldAt: true,
    },
  });

  const updatedVehicles: Array<{ id: string; model: string; soldAt: Date }> = [];
  const clearedVehicles: Array<{ id: string; model: string }> = [];

  for (const v of vehiclesToSet) {
    const resolvedDate = resolveSoldAtDate(v);
    updatedVehicles.push({
      id: v.id,
      model: v.model,
      soldAt: resolvedDate,
    });
  }

  for (const v of vehiclesToClear) {
    clearedVehicles.push({
      id: v.id,
      model: v.model,
    });
  }

  if (!dryRun) {
    for (const item of updatedVehicles) {
      await prisma.vehicle.update({
        where: { id: item.id },
        data: { soldAt: item.soldAt },
      });
    }

    if (clearedVehicles.length > 0) {
      await prisma.vehicle.updateMany({
        where: {
          id: { in: clearedVehicles.map((c) => c.id) },
        },
        data: {
          soldAt: null,
        },
      });
    }
  }

  return {
    dryRun,
    toSetCount: vehiclesToSet.length,
    toClearCount: vehiclesToClear.length,
    updatedVehicles,
    clearedVehicles,
  };
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log(`Iniciando reconciliação de soldAt${isDryRun ? " (MODO DRY-RUN)" : ""}...`);

  const result = await reconcileSoldAt({ dryRun: isDryRun });

  if (isDryRun) {
    console.log(`[dry-run] Veículos VENDIDO sem soldAt a preencher: ${result.toSetCount}`);
    console.log(`[dry-run] Veículos não VENDIDO com soldAt a limpar: ${result.toClearCount}`);
  } else {
    console.log(`Reconciliação concluída com sucesso:`);
    console.log(`- Veículos VENDIDO atualizados com soldAt: ${result.toSetCount}`);
    console.log(`- Veículos não VENDIDO com soldAt limpos: ${result.toClearCount}`);
  }
}

// Executa se chamado diretamente via CLI
if (process.argv[1]?.endsWith("reconcile-soldAt.ts") || process.argv[1]?.endsWith("reconcile-soldAt.js")) {
  main()
    .catch((error) => {
      console.error("Erro na reconciliação de soldAt:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
