import { redirect } from "next/navigation";
import { LeadsTable } from "@/components/admin/LeadsTable";
import { AdminPageHeader } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { LEAD_STATUSES, isLeadStatus } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { ADMIN_LEADS_PAGE_SIZE } from "@/lib/admin-vehicles";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const query = await searchParams;
  const status = (query.status ?? "").trim();
  const valid = isLeadStatus(status);
  const q = (query.q ?? "").trim();
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = ADMIN_LEADS_PAGE_SIZE;
  const digits = q.replace(/\D/g, "");
  const searchWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { vehicleInfo: { contains: q, mode: "insensitive" as const } },
          { plate: { contains: q.replace(/[^a-zA-Z0-9]/g, ""), mode: "insensitive" as const } },
          ...(digits ? [{ phone: { contains: digits } }] : []),
        ],
      }
    : {};
  const where = {
    ...(valid ? { status } : {}),
    ...searchWhere,
  };

  const [leads, groups, total] = await Promise.all([
    prisma.leadVenda.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.leadVenda.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.leadVenda.count({ where }),
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
          [
            counts.novo > 0
              ? `${counts.total} lead(s) no total · ${counts.novo} aguardando contato`
              : `${counts.total} lead(s) no total`,
            counts.total > leads.length
              ? ` · mostrando ${leads.length} de ${total}`
              : "",
          ].join("")
        }
      />

      <LeadsTable
        leads={leads}
        status={valid ? status : ""}
        query={q}
        counts={counts}
        page={page}
        pageSize={pageSize}
        total={total}
      />
    </div>
  );
}
