import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isMissingTableError } from "@/lib/prisma-errors";
import { judgeListingQuality } from "@/lib/listing-quality";
import type { ListingDraft } from "@/lib/listing-present";
import {
  parseStoredListingScore,
  refreshListingScoreOnSave,
  type StoredListingScore,
} from "@/lib/listing-score";

/** Para a tela de edição: lê a nota gravada. Nunca chama o Jev. */
export async function getStoredListingScore(
  vehicleId: string,
): Promise<StoredListingScore | null> {
  try {
    const row = await prisma.vehicleListingScore.findUnique({
      where: { vehicleId },
      select: { judgment: true, inputHash: true, updatedAt: true },
    });
    return parseStoredListingScore(row);
  } catch (error) {
    if (isMissingTableError(error, "VehicleListingScore")) {
      console.warn(
        "[nota-anuncio] tabela VehicleListingScore ausente: rode prisma/sql/vehicle-listing-score.sql",
      );
    } else {
      console.error("[nota-anuncio] falha ao ler a nota:", error);
    }
    return null;
  }
}

/** Único ponto do admin que chama o Jev: depois do Salvar. */
export function scoreListingAfterSave(input: {
  vehicleId: string;
  before: ListingDraft | null;
  after: ListingDraft;
}) {
  return refreshListingScoreOnSave(input, {
    load: (vehicleId) =>
      prisma.vehicleListingScore.findUnique({
        where: { vehicleId },
        select: { inputHash: true },
      }),
    save: async (vehicleId, value, inputHash) => {
      const judgment = value as unknown as Prisma.InputJsonObject;
      await prisma.vehicleListingScore.upsert({
        where: { vehicleId },
        create: { vehicleId, judgment, inputHash },
        update: { judgment, inputHash },
      });
    },
    judge: (draft) => judgeListingQuality(draft),
  });
}
