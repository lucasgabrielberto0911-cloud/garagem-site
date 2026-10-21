"use server";

import { redirect } from "next/navigation";
import { recordAdminAudit } from "@/lib/admin-audit";
import { expireAdminData } from "@/lib/admin-revalidate";
import { getSession } from "@/lib/auth";
import { parsePreparationForm } from "@/lib/preparation";
import { prisma } from "@/lib/prisma";
import { revalidatePublicStock } from "@/lib/public-stock-revalidate";

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

const back = (message: string, error = false) =>
  redirect(`/admin/em-preparacao?${error ? "erro" : "ok"}=${encodeURIComponent(message)}`);

export async function savePreparationAction(form: FormData) {
  await requireAdmin();
  const parsed = parsePreparationForm(form);
  if (!parsed.ok) return back(parsed.message, true);
  const id = String(form.get("id") ?? "");
  if (id) await prisma.preparationVehicle.update({ where: { id }, data: parsed.data });
  else await prisma.preparationVehicle.create({ data: parsed.data });
  return back(id ? "Carro atualizado." : "Carro cadastrado.");
}

export async function deletePreparationAction(form: FormData) {
  await requireAdmin();
  await prisma.preparationVehicle.deleteMany({ where: { id: String(form.get("id") ?? "") } });
  return back("Carro excluído.");
}

/**
 * Cria o veículo no estoque e remove o item da lista. O estoque ainda não tem
 * estado "rascunho": o veículo nasce `historical` (fora da vitrine pública) e
 * sem preço; o admin completa o anúncio na ficha.
 */
export async function movePreparationToStockAction(form: FormData) {
  const session = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const item = await prisma.preparationVehicle.findUnique({ where: { id } });
  if (!item) return back("Carro não encontrado.", true);
  if (!item.ready) return back("Marque o carro como pronto antes de mover para o estoque.", true);
  const year = item.year ?? new Date().getFullYear();
  const vehicleId = await prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.create({
      data: {
        brand: item.brand, model: item.model, color: item.color, year, yearModel: year,
        km: item.km ?? 0, plate: item.plate, price: 0, purchasePrice: item.purchasePrice,
        fuel: "Flex", transmission: "Manual", status: "disponivel", historical: true,
      },
    });
    await tx.preparationVehicle.delete({ where: { id } });
    await recordAdminAudit(tx, session.adminId, vehicle.id, "preparation.move", { from: id });
    return vehicle.id;
  });
  expireAdminData();
  revalidatePublicStock();
  redirect(`/admin/veiculos/${vehicleId}`);
}

/** Publica o carro movido: só com preço informado, tira de `historical` e invalida o site. */
export async function publishPreparedVehicleAction(form: FormData) {
  const session = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, historical: true, sale: null, status: "disponivel" },
    select: { id: true, price: true },
  });
  if (!vehicle) return back("Carro não encontrado para publicar.", true);
  if (vehicle.price <= 0) return back("Informe o preço na ficha antes de publicar.", true);
  await prisma.$transaction(async (tx) => {
    await tx.vehicle.update({ where: { id }, data: { historical: false } });
    await recordAdminAudit(tx, session.adminId, id, "preparation.publish", {});
  });
  expireAdminData();
  revalidatePublicStock();
  return back("Carro publicado no estoque.");
}
