import type { FunnelCounts } from "@/lib/lead-funnel";

const STAGES = [
  ["Conversas", "conversas"],
  ["Visitas marcadas", "marcadas"],
  ["Visitou", "visitas"],
  ["Vendeu", "vendas"],
] as const;

/** Celular: um cartão por grupo, sem rolagem lateral. A partir de sm: a tabela de sempre. */
export function LeadWeeklySummary({ cars, sources }: { cars: FunnelCounts[]; sources: FunnelCounts[] }) {
  return <details className="border border-white/10 p-3">
    <summary className="min-h-11 cursor-pointer py-2 font-semibold">Funil das conversas iniciadas nesta semana</summary>
    <p className="my-3 text-xs leading-relaxed text-muted">Segunda a domingo, horário da loja. Etapas registradas até agora, uma vez por conversa; venda não presume visita. Inclui somente compras registradas do WhatsApp, sem os filtros da lista.</p>
    {([ ["Por carro", cars], ["Por origem", sources] ] as const).map(([title, rows]) => <div key={title} className="mt-4">
      <h2 className="mb-2 font-display text-base font-semibold">{title}</h2>
      {rows.length ? <>
        <ul className="space-y-2 sm:hidden">
          {rows.map((row, index) => <li key={index} className="border border-white/10 bg-ink/50 p-3">
            <p className="break-words text-sm font-semibold text-cream">{row.label}</p>
            <dl className="mt-2 grid grid-cols-4 gap-1 text-center">
              {STAGES.map(([label, key]) => <div key={key} className="min-w-0">
                <dd className="font-display text-xl font-bold tabular-nums text-cream">{row[key]}</dd>
                <dt className="text-xs leading-tight text-muted">{label}</dt>
              </div>)}
            </dl>
          </li>)}
        </ul>
        <div className="hidden overflow-x-auto sm:block"><table className="w-full text-left text-xs">
          <thead><tr>{["Grupo", ...STAGES.map(([label]) => label)].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index} className="border-t border-white/10"><td className="p-2">{row.label}</td>{STAGES.map(([, key]) => <td key={key} className="p-2 tabular-nums">{row[key]}</td>)}</tr>)}</tbody>
        </table></div>
      </> : <p className="text-sm text-muted">Nenhuma conversa de compra registrada nesta semana.</p>}
    </div>)}
  </details>;
}
