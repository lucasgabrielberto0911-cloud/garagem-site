import { PurchaseLeadForm } from "@/components/admin/PurchaseLeadForm";
import { LeadWeeklySummary } from "@/components/admin/LeadWeeklySummary";
import { leadWeekStart, weeklyLeadSummary } from "@/lib/lead-funnel";
import Link from "next/link";
import { leadSearchWhere } from "@/lib/admin-lead-search";
import { redirect } from "next/navigation";
import { LeadsTable } from "@/components/admin/LeadsTable";
import { AdminPageHeader, btn } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { findLeadVendas, findWeeklyPurchaseLeads } from "@/lib/lead-venda";
import { LEAD_STATUSES, isLeadSource, isLeadStatus } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { ADMIN_LEADS_PAGE_SIZE } from "@/lib/admin-vehicles";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    page?: string;
    q?: string;
    origem?: string;
    lead?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const query = await searchParams;
  const status = (query.status ?? "").trim();
  const valid = isLeadStatus(status);
  const q = (query.q ?? "").trim();
  const origem = isLeadSource(query.origem || "") ? query.origem! : "";
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = ADMIN_LEADS_PAGE_SIZE;
  const where = query.lead
    ? { id: query.lead }
    : leadSearchWhere({ status, q, origem });

  const filtered =
    Boolean(query.lead) || valid || Boolean(q) || Boolean(origem);
  const now = new Date();
  const [leads, groups, filteredTotal, stock, weekly] = await Promise.all([
    findLeadVendas({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.leadVenda.groupBy({
      by: ["status"],
      where: origem ? { source: origem } : undefined,
      _count: { _all: true },
    }),
    // Sem filtro, o total já sai do groupBy.
    filtered ? prisma.leadVenda.count({ where }) : Promise.resolve(null),
    prisma.vehicle.findMany({
      select: { id: true, brand: true, model: true, version: true, yearModel: true, status: true },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
    }),
    findWeeklyPurchaseLeads(leadWeekStart(now), now),
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
  const total = filteredTotal ?? counts.total;
  const vehicles = stock.map(vehicle => ({ id: vehicle.id, label: [vehicle.brand, vehicle.model, vehicle.version, vehicle.yearModel, vehicle.status === "vendido" ? "(vendido)" : ""].filter(Boolean).join(" ") }));
  const summary = weeklyLeadSummary(weekly, now);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Leads e conversas"
        actions={<Link href="/admin/agenda" className={btn.outline}>Ver agenda</Link>}
        subtitle={[
          counts.novo > 0
            ? `${counts.total} lead(s) no total · ${counts.novo} aguardando contato`
            : `${counts.total} lead(s) no total`,
          counts.total > leads.length
            ? ` · mostrando ${leads.length} de ${total}`
            : "",
        ].join("")}
      />

      <PurchaseLeadForm vehicles={vehicles.filter(v => !v.label.endsWith("(vendido)"))} />
      <LeadWeeklySummary {...summary} />
      <LeadsTable
        vehicles={vehicles}
        leadId={query.lead}
        leads={leads}
        status={valid ? status : ""}
        query={q}
        origem={origem}
        counts={counts}
        page={page}
        pageSize={pageSize}
        total={total}
      />
    </div>
  );
}
