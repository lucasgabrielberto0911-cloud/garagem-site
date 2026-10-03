"use server";
import { getSession } from "@/lib/auth";
import { expireAdminData } from "@/lib/admin-revalidate";
export async function refreshDashboard() {
  if (!(await getSession())) return { ok: false, message: "Sessão expirada." };
  expireAdminData();
  return { ok: true, message: "Atualizando…" };
}
