"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { parsePreparationForm } from "@/lib/preparation";
import { prisma } from "@/lib/prisma";

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

/** Abre o cadastro de estoque pré-preenchido. O item só sai da lista quando o veículo é cadastrado. */
export async function movePreparationToStockAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const item = await prisma.preparationVehicle.findUnique({ where: { id }, select: { ready: true } });
  if (!item) return back("Carro não encontrado.", true);
  if (!item.ready) return back("Marque o carro como pronto antes de mover para o estoque.", true);
  redirect(`/admin/veiculos/novo?prep=${encodeURIComponent(id)}`);
}
