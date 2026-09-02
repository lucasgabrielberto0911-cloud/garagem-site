"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  createSessionToken,
  getSession,
  sessionCookieOptions,
} from "@/lib/auth";
import { ADMIN_SEED_PASSWORD_TAG } from "@/lib/admin-cache";
import { prisma } from "@/lib/prisma";

export type AccountActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

async function requireAdmin() {
  const session = await getSession();
  if (!session?.adminId) redirect("/admin/login");
  return session;
}

export async function updateAdminProfile(
  formData: FormData,
): Promise<AccountActionState> {
  const session = await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Informe o seu nome.";
  if (!email.includes("@")) fieldErrors.email = "E-mail inválido.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Corrija os campos destacados.", fieldErrors };
  }

  const taken = await prisma.admin.findFirst({
    where: { email, id: { not: String(session.adminId) } },
  });
  if (taken) {
    return {
      ok: false,
      message: "Já existe outro acesso com esse e-mail.",
      fieldErrors: { email: "E-mail em uso." },
    };
  }

  await prisma.admin.update({
    where: { id: String(session.adminId) },
    data: { name, email },
  });

  // Atualiza o cookie para o e-mail novo aparecer no menu sem precisar sair.
  if (email !== session.email) {
    const token = await createSessionToken(String(session.adminId), email);
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  }

  revalidatePath("/admin/conta");
  revalidatePath("/admin");
  return { ok: true, message: "Dados atualizados." };
}

export async function changeAdminPassword(
  formData: FormData,
): Promise<AccountActionState> {
  const session = await requireAdmin();

  const current = String(formData.get("currentPassword") || "");
  const next = String(formData.get("newPassword") || "");
  const confirm = String(formData.get("confirmPassword") || "");

  const fieldErrors: Record<string, string> = {};
  if (!current) fieldErrors.currentPassword = "Informe a senha atual.";
  if (next.length < 8) {
    fieldErrors.newPassword = "A nova senha precisa de pelo menos 8 caracteres.";
  }
  if (next !== confirm) fieldErrors.confirmPassword = "As senhas não coincidem.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Corrija os campos destacados.", fieldErrors };
  }

  const admin = await prisma.admin.findUnique({
    where: { id: String(session.adminId) },
  });
  if (!admin) return { ok: false, message: "Acesso não encontrado." };

  const valid = await bcrypt.compare(current, admin.passwordHash);
  if (!valid) {
    return {
      ok: false,
      message: "A senha atual está incorreta.",
      fieldErrors: { currentPassword: "Senha incorreta." },
    };
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });

  revalidateTag(ADMIN_SEED_PASSWORD_TAG, "max");
  revalidatePath("/admin");
  revalidatePath("/admin/conta");
  return { ok: true, message: "Senha alterada com sucesso." };
}
