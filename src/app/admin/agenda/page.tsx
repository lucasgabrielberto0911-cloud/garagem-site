import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, btn, inputClass } from "@/components/admin/ui";
import { LeadFollowUp } from "@/components/admin/LeadFollowUp";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminDate } from "@/lib/admin-date";
import { AGENDA_PERIODS, agendaWhere, parseAgendaPeriod } from "@/lib/admin-agenda";
import { leadSearchWhere } from "@/lib/admin-lead-search";
import { buildLeadWhatsAppUrl } from "@/lib/leads";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export default async function AgendaPage({ searchParams }: {
  searchParams: Promise<{ periodo?: string | string[]; page?: string | string[]; q?: string | string[] }>;
}) {
  if (!(await getSession())) redirect("/admin/login");
  const query = await searchParams;
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  const period = parseAgendaPeriod(first(query.periodo));
  const q = (first(query.q) ?? "").trim();
  const now = new Date();
  const search = leadSearchWhere({ q });
  const counts = await Promise.all(AGENDA_PERIODS.map(({ value }) =>
    prisma.leadVenda.count({ where: { AND: [agendaWhere(value, now), search] } }),
  ));
  const total = counts[AGENDA_PERIODS.findIndex(({ value }) => value === period)];
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Number(first(query.page));
  const page = Math.min(pages, Number.isFinite(requested) ? Math.max(1, Math.trunc(requested)) : 1);
  const leads = await prisma.leadVenda.findMany({
    where: { AND: [agendaWhere(period, now), search] },
    orderBy: [{ nextActionAt: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, name: true, phone: true, vehicleInfo: true, plate: true, source: true, nextAction: true, nextActionAt: true },
  });
  function href(value = period, nextPage = 1) {
    const params = new URLSearchParams({ periodo: value });
    if (q) params.set("q", q);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/admin/agenda?${params}`;
  }

  return <div className="space-y-4 sm:space-y-6">
    <AdminPageHeader title="Agenda" subtitle="Retome os atendimentos no dia combinado." />
    <nav aria-label="Período da agenda" className="grid grid-cols-3 gap-2">
      {AGENDA_PERIODS.map(({ value, label }, index) => <Link key={value} href={href(value)} aria-current={period === value ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-sm transition sm:flex-row sm:gap-3 ${period === value ? "border-brand/40 bg-brand/10 text-cream" : "border-white/10 text-muted hover:text-cream"}`}>
        {label}<span className="text-xs tabular-nums">{counts[index]}</span>
      </Link>)}
    </nav>
    <form role="search" className="flex gap-2">
      <input type="hidden" name="periodo" value={period} />
      <input name="q" type="search" defaultValue={q} aria-label="Buscar atendimento" placeholder="Nome, veículo ou telefone" className={`${inputClass} min-w-0 flex-1`} />
      <button className={btn.outline}>Buscar</button>
    </form>
    {q ? <Link href={`/admin/agenda?periodo=${period}`} className={btn.ghost}>Limpar busca</Link> : null}
    <p className="text-xs text-muted" role="status">{total} atendimento(s){total > PAGE_SIZE ? ` · página ${page} de ${pages}` : ""}</p>
    {leads.length === 0 ? <div className="rounded-lg border border-white/10 p-6 text-sm text-muted">
      {q ? "Nenhum atendimento encontrado nesta busca." : period === "hoje" ? "Nenhum retorno marcado para hoje." : period === "atrasados" ? "Nenhum retorno atrasado." : "Nenhum retorno marcado para os próximos dias."}
      <Link href="/admin/leads" className={`${btn.ghost} mt-2`}>Ver leads e marcar um retorno</Link>
    </div> : <div className="grid gap-3 lg:grid-cols-2">
      {leads.map((lead) => <article key={lead.id} className="min-w-0 space-y-3 rounded-lg border border-white/10 bg-ink/50 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words font-display text-lg font-semibold">{lead.name}</h2>
          <time dateTime={lead.nextActionAt!.toISOString()} className={`shrink-0 text-xs ${period === "atrasados" ? "text-brand-orange" : "text-muted"}`}>{adminDate(lead.nextActionAt!)}</time>
        </div>
        <p className="break-words text-sm text-muted">{lead.vehicleInfo}</p>
        <p className="break-words text-sm">{lead.nextAction || "Retomar atendimento"}</p>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/admin/leads?lead=${encodeURIComponent(lead.id)}`} className={btn.outline}>Abrir lead</Link>
          <a href={buildLeadWhatsAppUrl(lead)} target="_blank" rel="noopener noreferrer" className={btn.outline}>WhatsApp</a>
        </div>
        <LeadFollowUp id={lead.id} nextAction={lead.nextAction} nextActionAt={lead.nextActionAt} />
      </article>)}
    </div>}
    {pages > 1 ? <nav aria-label="Páginas da agenda" className="flex justify-between gap-2">
      {page > 1 ? <Link href={href(period, page - 1)} className={btn.outline}>Anterior</Link> : <span />}
      {page < pages ? <Link href={href(period, page + 1)} className={btn.outline}>Próxima</Link> : null}
    </nav> : null}
  </div>;
}
