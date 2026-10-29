import Link from "next/link";
import { redirect } from "next/navigation";
import { PromissoryManager, type PromissoryRow } from "@/components/admin/PromissoryManager";
import { AdminPageHeader, StatCard } from "@/components/admin/ui";
import { formatAdminMoney } from "@/lib/admin-money";
import { localDateInput } from "@/lib/admin-date";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PROMISSORY_FILTERS, dateOnly, parsePromissoryFilter, promissoryListWhere } from "@/lib/promissory-notes";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
const OPEN = ["emitida", "vinculada"];

export default async function PromissoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; q?: string | string[]; page?: string | string[] }>;
}) {
  if (!(await getSession())) redirect("/admin/login");

  const query = await searchParams;
  const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
  const filter = parsePromissoryFilter(first(query.status));
  const q = (first(query.q) ?? "").trim().slice(0, 80);
  const requested = Number(first(query.page));
  const today = localDateInput();
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const where = promissoryListWhere(filter, q);

  const [total, open, overdue, paid] = await Promise.all([
    prisma.promissoryNote.count({ where }),
    prisma.promissoryNote.aggregate({ where: { status: { in: OPEN } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.promissoryNote.count({ where: { status: { in: OPEN }, dueDate: { lt: todayDate } } }),
    prisma.promissoryNote.count({ where: { status: "paga" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Number.isFinite(requested) ? Math.max(1, Math.trunc(requested)) : 1);
  const rows = await prisma.promissoryNote.findMany({
    where,
    orderBy: filter === "abertas" ? [{ dueDate: "asc" }, { number: "asc" }] : [{ number: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const notes: PromissoryRow[] = rows.map((row) => ({
    id: row.id,
    number: row.number,
    issuerName: row.issuerName,
    issuerCpf: row.issuerCpf,
    issuerPhone: row.issuerPhone,
    amount: Number(row.amount.toString()),
    dueDate: dateOnly(row.dueDate),
    issuedAt: dateOnly(row.issuedAt),
    installmentNo: row.installmentNo,
    installmentCount: row.installmentCount,
    status: row.status,
    paidAt: row.paidAt?.toISOString() ?? null,
    overdue: OPEN.includes(row.status) && dateOnly(row.dueDate) < today,
    notes: row.notes,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Promissórias"
        subtitle="Notas promissórias da loja, separadas da venda: emita, acompanhe os vencimentos, baixe o PDF e marque como paga."
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="A receber" value={formatAdminMoney(Number(open._sum.amount?.toString() ?? 0))} hint={`${open._count._all} nota(s) em aberto`} />
        <StatCard label="Vencidas" value={overdue} tone={overdue > 0 ? "warning" : "default"} />
        <StatCard label="Pagas" value={paid} tone={paid > 0 ? "success" : "default"} />
      </section>

      <nav aria-label="Filtro por situação" className="flex flex-wrap gap-2">
        {PROMISSORY_FILTERS.map((item) => (
          <Link
            key={item.value}
            href={item.value === "abertas" ? "/admin/promissorias" : `/admin/promissorias?status=${item.value}`}
            aria-current={filter === item.value ? "page" : undefined}
            className={`inline-flex min-h-11 items-center border px-4 text-sm transition ${filter === item.value ? "border-brand/40 bg-brand/10 text-cream" : "border-white/10 text-muted hover:text-cream"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <PromissoryManager notes={notes} today={today} filter={filter} query={q} page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}
