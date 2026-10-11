"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAudit } from "@/lib/admin-audit";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isMissingTableError } from "@/lib/prisma-errors";
import { revalidatePublicStock } from "@/lib/public-stock-revalidate";
import {
  VERIFIED_TOPICS,
  parseVerifiedItems,
  sanitizeVerifiedDrafts,
} from "@/lib/vehicle-verified";

export type VerifiedActionState = {
  ok: boolean;
  message: string;
};

/**
 * Salva os pontos verificados do veículo (campos `text:<ponto>` e
 * `photos:<ponto>`). Tudo vazio apaga o registro: a ficha volta a não ter a
 * seção. Não toca em Vehicle nem em nenhuma outra tabela.
 */
export async function saveVehicleVerifiedInfo(
  vehicleId: string,
  formData: FormData,
): Promise<VerifiedActionState> {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      category: true,
      photos: { select: { id: true } },
    },
  });
  if (!vehicle) return { ok: false, message: "Veículo não encontrado." };

  const drafts = VERIFIED_TOPICS.map((topic) => ({
    key: topic.key,
    text: String(formData.get(`text:${topic.key}`) ?? ""),
    photoIds: formData.getAll(`photos:${topic.key}`).map(String),
  }));
  const result = sanitizeVerifiedDrafts(
    drafts,
    new Set(vehicle.photos.map((photo) => photo.id)),
    vehicle.category === "moto",
  );
  if (!result.ok) return { ok: false, message: result.message };

  try {
    await prisma.$transaction(async (tx) => {
      const previous = await tx.vehicleVerifiedInfo.findUnique({
        where: { vehicleId },
        select: { items: true },
      });
      const before = parseVerifiedItems(previous?.items);
      if (result.items.length === 0) {
        await tx.vehicleVerifiedInfo.deleteMany({ where: { vehicleId } });
      } else {
        await tx.vehicleVerifiedInfo.upsert({
          where: { vehicleId },
          create: { vehicleId, items: result.items },
          update: { items: result.items },
        });
      }
      if (JSON.stringify(before) !== JSON.stringify(result.items)) {
        await recordAdminAudit(tx, session.adminId, vehicleId, "vehicle.verified", {
          pontos: {
            before: before.map((item) => item.key),
            after: result.items.map((item) => item.key),
          },
        });
      }
    });
  } catch (error) {
    if (isMissingTableError(error, "VehicleVerifiedInfo")) {
      return {
        ok: false,
        message:
          "A tabela ainda não existe no banco. Rode prisma/sql/vehicle-verified-info.sql no Supabase.",
      };
    }
    console.error(error);
    return { ok: false, message: "Não foi possível salvar." };
  }

  revalidatePath("/admin/veiculos");
  revalidatePath(`/admin/veiculos/${vehicleId}`);
  // Só a tag pública, home/estoque/sitemap e o slug desta ficha.
  await revalidatePublicStock(vehicleId);
  return {
    ok: true,
    message:
      result.items.length === 0
        ? "Nada preenchido: a ficha não mostra a seção."
        : "Salvo. A ficha já usa estas informações.",
  };
}
