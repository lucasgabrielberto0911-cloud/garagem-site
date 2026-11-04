import Link from "next/link";
import { redirect } from "next/navigation";
import { PromissoryManager, type PromissoryRow } from "@/components/admin/PromissoryManager";
import { AdminPageHeader, StatCard, adminStatGrid } from "@/components/admin/ui";
import { formatAdminMoney } from "@/lib/admin-money";
import { localDateInput } from "@/lib/admin-date";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PROMISSORY_DUE_FILTERS,
  PROMISSORY_COMPAT_OMIT,
  PROMISSORY_FILTERS,
  addDaysCivil,
  dateOnly,
  parsePromissoryDueFilter,
  parsePromissoryFilter,
  promissoryListWhere,
  type PromissoryDueFilter,
  type PromissoryFilter,
} from "@/lib/promissory-notes";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
const OPEN = ["emitida", "vinculada"];

export default async function PromissoriasPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    vencimento?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  if (!(await getSession())) redirect("/admin/login");

  const query = await searchParams;
  const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
  const filter = parsePromissoryFilter(first(query.status));
  const rawDue = parsePromissoryDueFilter(first(query.vencimento));
  const due: PromissoryDueFilter = filter === "pagas" || filter === "canceladas" ? "todos" : rawDue;
  const q = (first(query.q) ?? "").trim().slice(0, 80);
  const requested = Number(first(query.page));
  const today = localDateInput();
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const next7Date = new Date(`${addDaysCivil(today, 7)}T00:00:00.000Z`);
  const next30Date = new Date(`${addDaysCivil(today, 30)}T00:00:00.000Z`);
  const where = promissoryListWhere(filter, q, { due, today });

  const [total, open, overdue, dueToday, due7Days, due30Days, paid, canceled] = await Promise.all([
    prisma.promissoryNote.count({ where }),
    prisma.promissoryNote.aggregate({ where: { status: { in: OPEN } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.promissoryNote.aggregate({ where: { status: { in: OPEN }, dueDate: { lt: todayDate } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.promissoryNote.count({ where: { status: { in: OPEN }, dueDate: todayDate } }),
    prisma.promissoryNote.count({ where: { status: { in: OPEN }, dueDate: { gte: todayDate, lte: next7Date } } }),
    prisma.promissoryNote.count({ where: { status: { in: OPEN }, dueDate: { gte: todayDate, lte: next30Date } } }),
    prisma.promissoryNote.count({ where: { status: "paga" } }),
    prisma.promissoryNote.count({ where: { status: "cancelada" } }),
  ]);

  const statusCounts: Record<PromissoryFilter, number> = {
    abertas: open._count._all,
    pagas: paid,
    canceladas: canceled,
    todas: open._count._all + paid + canceled,
  };

  const dueCounts: Record<PromissoryDueFilter, number> = {
    todos: open._count._all,
    vencidas: overdue._count._all,
    hoje: dueToday,
    "7dias": due7Days,
    "30dias": due30Days,
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Number.isFinite(requested) ? Math.max(1, Math.trunc(requested)) : 1);
  const orderBy =
    filter === "pagas"
      ? [{ paidAt: "desc" as const }, { number: "desc" as const }]
      : filter === "abertas" || due !== "todos"
        ? [{ dueDate: "asc" as const }, { number: "asc" as const }]
        : [{ number: "desc" as const }];

  const rows = await prisma.promissoryNote.findMany({
    omit: PROMISSORY_COMPAT_OMIT,
    where,
    orderBy,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const openCpfs = Array.from(new Set(rows.filter((row) => OPEN.includes(row.status)).map((row) => row.issuerCpf)));
  const openGroups = openCpfs.length
    ? await prisma.promissoryNote.groupBy({
        by: ["issuerCpf"],
        where: { status: { in: OPEN }, issuerCpf: { in: openCpfs } },
        _count: { _all: true },
      })
    : [];
  const openCountByCpf = new Map(openGroups.map((group) => [group.issuerCpf, group._count._all]));

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
    openIssuerCount: openCountByCpf.get(row.issuerCpf) ?? 0,
  }));

  function filterHref(nextStatus: PromissoryFilter, nextDue: PromissoryDueFilter = "todos") {
    const params = new URLSearchParams();
    if (nextStatus !== "abertas") params.set("status", nextStatus);
    if (nextDue !== "todos" && (nextStatus === "abertas" || nextStatus === "todas")) {
      params.set("vencimento", nextDue);
    }
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs ? `/admin/promissorias?${qs}` : "/admin/promissorias";
  }

  const overdueCount = overdue._count._all;
  const overdueAmount = Number(overdue._sum.amount?.toString() ?? 0);
  const showDueFilters = filter === "abertas" || filter === "todas";

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Promissórias"
        subtitle="Notas promissórias da loja, separadas da venda: emita parcelas, acompanhe vencimentos, imprima o PDF e dê baixa."
      />

      <section className={adminStatGrid} aria-label="Resumo de promissórias">
        <StatCard
          label="A receber"
          value={formatAdminMoney(Number(open._sum.amount?.toString() ?? 0))}
          hint={`${open._count._all} nota(s) em aberto`}
          href={filterHref("abertas", "todos")}
        />
        <StatCard
          label="Vencidas"
          value={overdueCount}
          hint={overdueCount > 0 ? `${formatAdminMoney(overdueAmount)} em atraso` : "Nenhuma em atraso"}
          tone={overdueCount > 0 ? "warning" : "default"}
          href={filterHref("abertas", "vencidas")}
        />
        <StatCard
          label="Próximos 7 dias"
          value={due7Days}
          hint={dueToday > 0 ? `${dueToday} vence(m) hoje` : "Vencimentos da semana"}
          tone={due7Days > 0 ? "brand" : "default"}
          href={filterHref("abertas", "7dias")}
        />
        <StatCard
          label="Pagas"
          value={paid}
          hint={paid > 0 ? "Notas quitadas" : "Nenhuma quitada"}
          tone={paid > 0 ? "success" : "default"}
          href={filterHref("pagas", "todos")}
        />
      </section>

      <div className="space-y-2.5">
        <nav aria-label="Filtro por situação" className="flex flex-wrap gap-2">
          {PROMISSORY_FILTERS.map((item) => {
            const active = filter === item.value;
            const keepDue = item.value === "abertas" || item.value === "todas" ? due : "todos";
            return (
              <Link
                key={item.value}
                href={filterHref(item.value, keepDue)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 border px-3.5 text-sm transition touch-manipulation sm:px-4 ${
                  active ? "border-brand/40 bg-brand/10 font-medium text-cream" : "border-white/10 text-muted hover:text-cream"
                }`}
              >
                <span>{item.label}</span>
                <span className="text-xs tabular-nums opacity-75">{statusCounts[item.value]}</span>
              </Link>
            );
          })}
        </nav>

        {showDueFilters ? (
          <nav aria-label="Filtro por vencimento" className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="mr-1 text-xs font-medium uppercase tracking-wider text-muted">Vencimento:</span>
            {PROMISSORY_DUE_FILTERS.map((item) => {
              const active = due === item.value;
              const isAlert = item.value === "vencidas" && dueCounts.vencidas > 0;
              return (
                <Link
                  key={item.value}
                  href={filterHref(filter, item.value)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center gap-1.5 border px-3 text-xs font-medium transition touch-manipulation ${
                    active
                      ? "border-brand/40 bg-brand/10 text-cream"
                      : isAlert
                        ? "border-brand-orange/40 text-brand-orange hover:border-brand-orange"
                        : "border-white/10 text-muted hover:text-cream"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="tabular-nums opacity-75">{dueCounts[item.value]}</span>
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>

      <PromissoryManager
        notes={notes}
        today={today}
        filter={filter}
        due={due}
        query={q}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </div>
  );
}
