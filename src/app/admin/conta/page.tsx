import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { AccountForms } from "@/components/admin/AccountForms";
import { AdminPageHeader } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Senha criada pelo seed: se ainda estiver valendo, o painel avisa. */
const SEED_PASSWORD = "troque-esta-senha";

export default async function ContaPage() {
  const session = await getSession();
  if (!session?.adminId) redirect("/admin/login");

  const admin = await prisma.admin.findUnique({
    where: { id: String(session.adminId) },
    select: { name: true, email: true, passwordHash: true },
  });

  if (!admin) redirect("/admin/login");

  const usingSeedPassword = await bcrypt.compare(
    SEED_PASSWORD,
    admin.passwordHash,
  );

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
