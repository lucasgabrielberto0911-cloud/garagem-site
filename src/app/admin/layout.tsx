import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { getNewLeadsBadgeCount } from "@/lib/admin-stats";
import { getSession } from "@/lib/auth";

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
  const newLeads = session ? await getNewLeadsBadgeCount() : 0;

  return (
    <AdminShell newLeads={newLeads}>
      {children}
    </AdminShell>
  );
}
