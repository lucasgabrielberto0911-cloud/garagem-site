import { redirect } from "next/navigation";
import { LeadsTable } from "@/components/admin/LeadsTable";
import { getSession } from "@/lib/auth";
import { isLeadStatus } from "@/lib/leads";
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

  const [leads, newCount] = await Promise.all([
    prisma.leadVenda.findMany({
      where: valid ? { status } : {},
      orderBy: { createdAt: "desc" },
    }),
    prisma.leadVenda.count({ where: { status: "novo" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 h-1 w-16 bg-brand-gradient" aria-hidden="true" />
        <h1 className="font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
          Leads de venda
        </h1>
        <p className="mt-2 text-sm text-muted">
          {leads.length} {leads.length === 1 ? "registro" : "registros"}
          {newCount > 0 ? ` · ${newCount} aguardando contato` : ""}
        </p>
      </div>

      <LeadsTable leads={leads} status={valid ? status : ""} />
    </div>
  );
}
