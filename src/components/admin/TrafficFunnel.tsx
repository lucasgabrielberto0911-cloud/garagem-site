import Link from "next/link";
import { getAdminTrafficFunnel } from "@/lib/admin-funnel";
const stages = [["Acessos", "acessos"], ["Cliques WhatsApp", "cliques"], ["Leads", "conversas"], ["Visitas marcadas", "marcadas"], ["Visitou", "visitas"], ["Vendeu", "vendas"]] as const;
export async function TrafficFunnel() {
  let data;
  try { data = await getAdminTrafficFunnel(); } catch { return <p role="status" className="text-sm text-muted">Funil indisponível. Tente atualizar o painel.</p>; }
  return <details className="border border-white/10 p-3" open><summary className="min-h-11 cursor-pointer py-2 font-display font-semibold">Funil por origem e veículo</summary>
    <p className="my-3 text-xs leading-relaxed text-muted">Semana corrente, segunda a domingo no horário da loja. Acessos e cliques são eventos com consentimento, coletados desde a ativação; não são pessoas únicas. Leads e etapas vêm das conversas de compra do WhatsApp cadastradas no admin nesta semana. São contagens independentes, sem atribuir automaticamente uma venda a um clique. Atualização em até 60 segundos.</p>
    {([["Por origem", data.sources], ["Por veículo", data.cars]] as const).map(([title, rows]) => <section key={title} className="mt-5"><h2 className="font-display text-lg">{title}</h2>{!rows.length ? <p className="mt-2 text-sm text-muted">Sem registros neste período.</p> : <ul className="mt-3 grid gap-3 lg:grid-cols-2">{rows.map(row => <li key={row.key} className="min-w-0 border border-white/10 p-3"><p className="break-words font-display">{row.label}</p><dl className="mt-3 grid grid-cols-3 gap-3">{stages.map(([label, key]) => <div key={key}><dt className="text-xs text-muted">{label}</dt><dd className="font-display text-xl tabular-nums">{row[key]}</dd></div>)}</dl></li>)}</ul>}</section>)}
    <section className="mt-5"><h2 className="font-display">Anúncios com 10 ou mais acessos e nenhum clique</h2>{data.attention.length ? <ul className="mt-2">{data.attention.map(row => <li key={row.key}><Link className="inline-flex min-h-11 items-center underline" href={`/admin/veiculos/${row.key}`}>{row.label} · {row.acessos} acessos</Link></li>)}</ul> : <p className="mt-2 text-sm text-muted">Nenhum anúncio disponível atende ao critério no período medido.</p>}</section>
  </details>;
}
