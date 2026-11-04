import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { afterSaleMessage, AFTER_SALE } from "@/lib/admin-commercial";
import { completeAfterSale } from "@/app/admin/veiculos/commercial-actions";
import { dismissPromissoryNotice } from "@/app/admin/promissorias/actions";
import { redirect } from "next/navigation";
import { AdminPageHeader, btn, inputClass } from "@/components/admin/ui";
import { LeadFollowUp } from "@/components/admin/LeadFollowUp";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminActionDate } from "@/lib/admin-date";
import { AGENDA_PERIODS, agendaWhere, parseAgendaPeriod } from "@/lib/admin-agenda";
import { leadSearchWhere } from "@/lib/admin-lead-search";
import { LeadWhatsAppMenu } from "@/components/admin/LeadWhatsAppMenu";
import { leadDisplayName, leadHasPhone } from "@/lib/leads";
import { promissoryPaidNotice } from "@/lib/promissory-notes";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export default async function AgendaPage({ searchParams }: {
  searchParams: Promise<{ periodo?: string | string[]; page?: string | string[]; q?: string | string[]; tarefas?: string; avisos?: string }>;
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
  const taskDate = agendaWhere(period, now).nextActionAt;
  const contains = { contains: q, mode: "insensitive" as const };
  const afterWhere: Prisma.AfterSaleTaskWhereInput = {
    completedAt: null, dueAt: taskDate as Prisma.DateTimeFilter,
    ...(q ? { sale: { OR: [{ customer: { name: contains } }, { customer: { phone: contains } }, { vehicle: { brand: contains } }, { vehicle: { model: contains } }, { vehicle: { plate: contains } }] } } : {}),
  };
  const paidWhere: Prisma.PromissoryNoteWhereInput = { status: "paga", paidNoticeDoneAt: null,
    ...(q ? { OR: [{ issuerName: contains }, { issuerPhone: contains }, ...(Number.isSafeInteger(Number(q)) && Number(q) > 0 && Number(q) <= 2147483647 ? [{ number: Number(q) }] : [])] } : {}),
  };
  const [afterTotal, paidTotal] = await Promise.all([prisma.afterSaleTask.count({ where: afterWhere }), prisma.promissoryNote.count({ where: paidWhere })]);
  function paginate(input: string | undefined, total: number) {
    const pages = Math.max(1, Math.ceil(total / 50));
    const number = Number(input);
    return { pages, page: Math.min(pages, Number.isFinite(number) ? Math.max(1, Math.trunc(number)) : 1) };
  }
  const tasks = paginate(query.tarefas, afterTotal);
  const notices = paginate(query.avisos, paidTotal);
  const [afterSales, siteSettings, paidNotes] = await Promise.all([
    prisma.afterSaleTask.findMany({ where: afterWhere, orderBy: [{ dueAt: "asc" }, { id: "asc" }], skip: (tasks.page - 1) * 50, take: 50, include: { sale: { include: { customer: true, vehicle: true } } } }),
    prisma.siteSettings.findUnique({ where: { id: "default" }, select: { googleProfileUrl: true } }),
    prisma.promissoryNote.findMany({ where: paidWhere, orderBy: [{ paidAt: "asc" }, { id: "asc" }], skip: (notices.page - 1) * 50, take: 50, select: { id: true, number: true, issuerName: true, paidAt: true } }),
  ]);
  function href(value = period, nextPage = 1, taskPage = tasks.page, noticePage = notices.page) {
    const params = new URLSearchParams({ periodo: value });
    if (q) params.set("q", q);
    if (nextPage > 1) params.set("page", String(nextPage));
    if (value === period && taskPage > 1) params.set("tarefas", String(taskPage));
    if (noticePage > 1) params.set("avisos", String(noticePage));
    return `/admin/agenda?${params}`;
  }

  return <div className="space-y-4 sm:space-y-6">
    <AdminPageHeader title="Agenda" subtitle="Retome os atendimentos no dia combinado." />
    <nav aria-label="Período da agenda" className="grid grid-cols-3 gap-2">
      {AGENDA_PERIODS.map(({ value, label }, index) => <Link key={value} href={href(value)} aria-current={period === value ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-sm transition sm:flex-row sm:gap-3 ${period === value ? "border-brand/40 bg-brand/10 text-cream" : "border-white/10 text-muted hover:text-cream"}`}>
        {label}<span className="text-[10px]">Atendimentos</span><span className="text-xs tabular-nums">{counts[index]}</span>
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
          <h2 className="min-w-0 break-words font-display text-lg font-semibold">{leadDisplayName(lead)}</h2>
          <time dateTime={lead.nextActionAt!.toISOString()} className={`shrink-0 text-xs ${period === "atrasados" ? "text-brand-orange" : "text-muted"}`}>{adminActionDate(lead.nextActionAt!)}</time>
        </div>
        <p className="break-words text-sm text-muted">{lead.vehicleInfo}</p>
        <p className="break-words text-sm">{lead.nextAction || "Retomar atendimento"}</p>
        <div className="flex gap-2">
          <Link href={`/admin/leads?lead=${encodeURIComponent(lead.id)}`} className={`${btn.outline} flex-1`}>Abrir lead</Link>
          {leadHasPhone(lead)
            ? <LeadWhatsAppMenu lead={lead} leadId={lead.id} className={`${btn.outline} flex-1 gap-2`} menuClassName={`${btn.outline} -ml-2 w-11 shrink-0 px-0`} />
            : <span className="flex-1 self-center text-xs text-muted">Sem telefone</span>}
        </div>
        <LeadFollowUp id={lead.id} nextAction={lead.nextAction} nextActionAt={lead.nextActionAt} />
      </article>)}
    </div>}
    <section className="space-y-3" aria-label="Pós-venda">
      <h2 className="font-display text-xl font-semibold">Pós-venda automático</h2>
      <p className="text-sm text-muted">Tarefas geradas ao registrar vendas com cliente: entrega, 7 dias, 30 dias e 180 dias. Envio pelo vendedor. {afterTotal} tarefa(s) neste período · página {tasks.page} de {tasks.pages}.</p>
      {afterSales.length === 0 ? <p className="text-sm text-muted">Nenhuma tarefa neste período.</p> : afterSales.map((task) => {
        const customer = task.sale.customer;
        const label = `${task.sale.vehicle.brand} ${task.sale.vehicle.model} ${task.sale.vehicle.yearModel}`;
        const message = afterSaleMessage(task.kind, customer?.name ?? "cliente", label, siteSettings?.googleProfileUrl?.startsWith("https://") ? siteSettings.googleProfileUrl : null);
        const phone = customer?.phone.replace(/\D/g, "") ?? "";
        return <article key={task.id} className="space-y-3 rounded-lg border border-white/10 p-4">
          <h3 className="font-display">{customer?.name ?? "Cliente não cadastrado"} · {AFTER_SALE.find((item) => item.kind === task.kind)?.label}</h3>
          <p className="text-xs text-muted">{adminActionDate(task.dueAt)} · {label}</p><p className="text-sm">{message}</p>
          <div className="flex flex-wrap gap-2">{phone.length >= 10 ? <a href={`https://wa.me/${phone.startsWith("55") && phone.length > 11 ? phone : `55${phone}`}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={btn.outline}>Abrir mensagem no WhatsApp</a> : <span className="text-sm text-muted">Cliente sem telefone válido</span>}
          <form action={completeAfterSale.bind(null, task.id)}><button className={btn.primary}>Marcar tarefa concluída</button></form></div>
        </article>;
      })}
      {tasks.pages > 1 && <nav aria-label="Páginas do pós-venda" className="flex justify-between gap-2">
        {tasks.page > 1 ? <Link className={btn.outline} href={href(period, page, tasks.page - 1)}>Tarefas anteriores</Link> : <span />}
        {tasks.page < tasks.pages && <Link className={btn.outline} href={href(period, page, tasks.page + 1)}>Próximas tarefas</Link>}
      </nav>}
    </section>
    {paidNotes.length ? <section className="space-y-3" aria-label="Promissórias pagas">
      <h2 className="font-display text-xl font-semibold">Promissórias pagas</h2>
      <p className="text-sm text-muted">Avisos gerados quando uma nota é marcada como paga. Caixa de entrada de todos os períodos: {paidTotal} aviso(s) · página {notices.page} de {notices.pages}. Dê ciência depois de conferir o recebimento.</p>
      {paidNotes.map((note) => <article key={note.id} className="space-y-3 rounded-lg border border-white/10 p-4">
        <h3 className="font-display">Nota nº {note.number} · {note.issuerName}</h3>
        <p className="text-xs text-muted">{note.paidAt ? `Baixada em ${adminActionDate(note.paidAt)}` : "Baixada"}</p>
        <p className="text-sm">{promissoryPaidNotice(note)}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/promissorias?status=pagas&q=${note.number}`} className={btn.outline}>Abrir nota</Link>
          <form action={dismissPromissoryNotice.bind(null, note.id)}><button className={btn.primary}>Dar ciência</button></form>
        </div>
      </article>)}
      {notices.pages > 1 && <nav aria-label="Páginas dos avisos" className="flex justify-between gap-2">
        {notices.page > 1 ? <Link className={btn.outline} href={href(period, page, tasks.page, notices.page - 1)}>Avisos anteriores</Link> : <span />}
        {notices.page < notices.pages && <Link className={btn.outline} href={href(period, page, tasks.page, notices.page + 1)}>Próximos avisos</Link>}
      </nav>}
    </section> : null}
    {pages > 1 ? <nav aria-label="Páginas da agenda" className="flex justify-between gap-2">
      {page > 1 ? <Link href={href(period, page - 1)} className={btn.outline}>Anterior</Link> : <span />}
      {page < pages ? <Link href={href(period, page + 1)} className={btn.outline}>Próxima</Link> : null}
    </nav> : null}
  </div>;
}
