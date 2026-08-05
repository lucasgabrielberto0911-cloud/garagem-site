import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const [total, available, sold, newLeads] = await Promise.all([
    prisma.vehicle.count(),
    prisma.vehicle.count({ where: { status: "disponivel" } }),
    prisma.vehicle.count({ where: { status: "vendido" } }),
    prisma.leadVenda.count({ where: { status: "novo" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 h-1 w-16 bg-brand-gradient" aria-hidden="true" />
        <h1 className="font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
          Dashboard
        </h1>
        <p className="mt-2 text-muted">
          Olá, <span className="text-cream">{session.email}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total de veículos" value={total} />
        <Stat label="Disponíveis" value={available} />
        <Stat label="Vendidos" value={sold} />
        <Stat label="Leads novos" value={newLeads} highlight={newLeads > 0} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/veiculos"
          className="inline-flex bg-brand px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418]"
        >
          Gerenciar veículos
        </Link>
        <Link
          href="/admin/leads"
          className="inline-flex border border-white/15 px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:border-brand"
        >
          Ver leads
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border bg-ink/50 px-5 py-4 ${
        highlight ? "border-brand/50" : "border-white/10"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p
        className={`mt-2 font-display text-3xl font-bold ${
          highlight ? "text-brand" : "text-cream"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
