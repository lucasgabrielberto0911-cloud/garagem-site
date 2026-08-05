import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const [total, available, sold] = await Promise.all([
    prisma.vehicle.count(),
    prisma.vehicle.count({ where: { status: "disponivel" } }),
    prisma.vehicle.count({ where: { status: "vendido" } }),
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total de veículos" value={total} />
        <Stat label="Disponíveis" value={available} />
        <Stat label="Vendidos" value={sold} />
      </div>

      <Link
        href="/admin/veiculos"
        className="inline-flex bg-brand px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418]"
      >
        Gerenciar veículos
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-white/10 bg-ink/50 px-5 py-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-cream">{value}</p>
    </div>
  );
}
