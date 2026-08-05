import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Painel | Garagem",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  /**
   * O contador do menu não pode derrubar o painel se o banco estiver fora,
   * então a consulta falha em silêncio e o badge simplesmente não aparece.
   */
  let newLeads = 0;
  if (session) {
    try {
      newLeads = await prisma.leadVenda.count({ where: { status: "novo" } });
    } catch {
      newLeads = 0;
    }
  }

  return (
    <AdminShell
      email={typeof session?.email === "string" ? session.email : undefined}
      newLeads={newLeads}
    >
      {children}
    </AdminShell>
  );
}
