import type { FunnelCounts } from "@/lib/lead-funnel";
export function LeadWeeklySummary({ cars, sources }: { cars: FunnelCounts[]; sources: FunnelCounts[] }) {
  return <details className="rounded border border-white/10 p-3">
    <summary className="min-h-11 cursor-pointer py-2 font-semibold">Funil das conversas iniciadas nesta semana</summary>
    <p className="my-3 text-xs text-muted">Segunda a domingo, horário da loja. Etapas registradas até agora, uma vez por conversa; venda não presume visita. Inclui somente compras registradas do WhatsApp, sem os filtros da lista.</p>
    {([ ["Por carro", cars], ["Por origem", sources] ] as const).map(([title, rows]) => <div key={title} className="mt-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs">
        <thead><tr>{["Grupo", "Conversas", "Visitas marcadas", "Visitou", "Vendeu"].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index} className="border-t border-white/10"><td className="p-2">{row.label}</td>{[row.conversas, row.marcadas, row.visitas, row.vendas].map((count, i) => <td key={i} className="p-2 tabular-nums">{count}</td>)}</tr>)}</tbody>
      </table></div> : <p className="text-sm text-muted">Nenhuma conversa de compra registrada nesta semana.</p>}
    </div>)}
  </details>;
}
