"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TESTIMONIALS_CACHE_TAG } from "@/lib/vehicles";

export type TestimonialActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function saveTestimonial(
  formData: FormData,
): Promise<TestimonialActionState> {
  await requireAdmin();

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const city = String(formData.get("city") || "").trim() || null;
  const message = String(formData.get("message") || "").trim();
  const photoUrl = String(formData.get("photoUrl") || "").trim() || null;
  const vehicleLabel = String(formData.get("vehicleLabel") || "").trim() || null;
  const published = formData.get("published") === "on";
  const orderRaw = Number(formData.get("order"));
  const order = Number.isFinite(orderRaw) ? orderRaw : 0;
  const ratingRaw = Number(formData.get("rating"));
  const rating =
    Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5
      ? Math.round(ratingRaw)
      : 5;

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Informe o nome de quem avaliou.";
  if (message.length < 10) {
    fieldErrors.message = "O depoimento precisa de pelo menos 10 caracteres.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Corrija os campos destacados.", fieldErrors };
  }

  const data = { name, city, message, photoUrl, vehicleLabel, published, order, rating };

  try {
    if (id) {
      await prisma.testimonial.update({ where: { id }, data });
    } else {
      await prisma.testimonial.create({ data });
    }
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Não foi possível salvar o depoimento." };
  }

  revalidateTag(TESTIMONIALS_CACHE_TAG);
  revalidatePath("/admin/depoimentos");
  revalidatePath("/");
  return {
    ok: true,
    message: id ? "Depoimento atualizado." : "Depoimento publicado.",
  };
}

export async function setTestimonialPublished(id: string, published: boolean) {
  await requireAdmin();

  await prisma.testimonial.update({ where: { id }, data: { published } });
  revalidateTag(TESTIMONIALS_CACHE_TAG);
  revalidatePath("/admin/depoimentos");
  revalidatePath("/");
  return {
    ok: true,
    message: published ? "Depoimento publicado." : "Depoimento ocultado do site.",
  };
}

export async function deleteTestimonial(
  id: string,
): Promise<TestimonialActionState> {
  await requireAdmin();

  await prisma.testimonial.delete({ where: { id } });
  revalidateTag(TESTIMONIALS_CACHE_TAG);
  revalidatePath("/admin/depoimentos");
  revalidatePath("/");
  return { ok: true, message: "Depoimento excluído." };
}
