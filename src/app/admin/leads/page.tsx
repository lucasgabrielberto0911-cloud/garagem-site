import { redirect } from "next/navigation";
import { LeadsTable } from "@/components/admin/LeadsTable";
import { AdminPageHeader } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { LEAD_STATUSES, isLeadStatus } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const status = (searchParams.status ?? "").trim();
  const valid = isLeadStatus(status);

  const [leads, groups] = await Promise.all([
    prisma.leadVenda.findMany({
      where: valid ? { status } : {},
      orderBy: { createdAt: "desc" },
    }),
    prisma.leadVenda.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts: Record<string, number> & { total: number } = {
    ...Object.fromEntries(
      LEAD_STATUSES.map((value) => [
        value,
        groups.find((group) => group.status === value)?._count._all ?? 0,
      ]),
    ),
    total: groups.reduce((sum, group) => sum + group._count._all, 0),
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Leads de venda"
        subtitle={
          counts.novo > 0
            ? `${counts.total} lead(s) no total · ${counts.novo} aguardando contato`
            : `${counts.total} lead(s) no total`
        }
      />

      <LeadsTable leads={leads} status={valid ? status : ""} counts={counts} />
    </div>
  );
}
