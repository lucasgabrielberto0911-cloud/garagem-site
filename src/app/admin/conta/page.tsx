import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { AccountForms } from "@/components/admin/AccountForms";
import { AdminPageHeader } from "@/components/admin/ui";
import { WEAK_ADMIN_PASSWORDS } from "@/lib/admin-security";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ContaPage() {
  const session = await getSession();
  if (!session?.adminId) redirect("/admin/login");

  const admin = await prisma.admin.findUnique({
    where: { id: String(session.adminId) },
    select: { name: true, email: true, passwordHash: true },
  });

  if (!admin) redirect("/admin/login");

  const usingSeedPassword = (
    await Promise.all(
      WEAK_ADMIN_PASSWORDS.map((password) =>
        bcrypt.compare(password, admin.passwordHash),
      ),
    )
  ).some(Boolean);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Minha conta"
        subtitle="Altere seus dados de acesso ao painel."
      />
      <AccountForms
        name={admin.name}
        email={admin.email}
        usingSeedPassword={usingSeedPassword}
      />
    </div>
  );
}
