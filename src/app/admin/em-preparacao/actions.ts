"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { parsePreparationForm, type PreparationFormErrors } from "@/lib/preparation";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

const back = (message: string, error = false) =>
  redirect(`/admin/em-preparacao?${error ? "erro" : "ok"}=${encodeURIComponent(message)}`);

export type PreparationActionState = {
  ok?: boolean;
  message?: string;
  errors?: PreparationFormErrors;
  fields?: Record<string, string>;
};

export async function savePreparationAction(
  stateOrForm: PreparationActionState | FormData | undefined,
  formDataMaybe?: FormData,
): Promise<PreparationActionState> {
  await requireAdmin();
  const form =
    formDataMaybe instanceof FormData
      ? formDataMaybe
      : stateOrForm instanceof FormData
        ? stateOrForm
        : new FormData();

  const rawFields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") rawFields[key] = value;
  }

  const parsed = parsePreparationForm(form);
  if (!parsed.ok) {
    return {
      ok: false,
      message: parsed.message,
      errors: parsed.errors,
      fields: rawFields,
    };
  }

  const id = String(form.get("id") ?? "");
  if (id) {
    await prisma.preparationVehicle.update({ where: { id }, data: parsed.data });
  } else {
    await prisma.preparationVehicle.create({ data: parsed.data });
  }

  revalidatePath("/admin/em-preparacao");
  return {
    ok: true,
    message: id ? "Carro atualizado com sucesso." : "Carro cadastrado com sucesso.",
  };
}

export async function deletePreparationAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (id) {
    await prisma.preparationVehicle.deleteMany({ where: { id } });
  }
  revalidatePath("/admin/em-preparacao");
  return back("Carro excluído.");
}

/** Abre o cadastro de estoque pré-preenchido. O item só sai da lista quando o veículo é cadastrado. */
export async function movePreparationToStockAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const item = await prisma.preparationVehicle.findUnique({
    where: { id },
    select: { ready: true },
  });
  if (!item) return back("Carro não encontrado.", true);
  if (!item.ready)
    return back("Marque o carro como pronto antes de criar o anúncio.", true);
  redirect(`/admin/veiculos/novo?prep=${encodeURIComponent(id)}`);
}
