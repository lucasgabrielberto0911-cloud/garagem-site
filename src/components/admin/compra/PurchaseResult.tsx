"use client";

import { SCENARIO_LABELS } from "@/lib/purchase-policy";
import type { DealType } from "@/lib/purchase-quick";
import type { PreparedPurchase } from "@/lib/purchase-store";
import { money } from "./Fields";

export type PurchaseResultData = Pick<PreparedPurchase, "output" | "score" | "fipeSnapshot"> & { opinion?: PreparedPurchase["opinion"] };
export function PurchaseResult({ result, askedPriceCents, dealType }: { result: PurchaseResultData; askedPriceCents: number; dealType: DealType }) {
  const { output, opinion, score } = result;
  const scenario = output.scenarios.find(s => s.key === (dealType === "repasse" ? "rapida" : "normal"));
  const calculation = scenario?.calculation;
  const grade = opinion?.grade ?? (score.total === null ? null : score.total / 10);
  return <section aria-label="Resultado da compra" className="space-y-4">
    <div className="space-y-4 border border-brand/50 bg-ink p-4 sm:p-6">
      <h2 className="font-display text-xl font-semibold">Nota da compra neste valor</h2>
      <p className="font-display text-3xl">{grade === null ? "Sem nota financeira" : `${grade.toFixed(1).replace(".", ",")}/10`}</p>
      <p className="text-sm">Preço de compra: <strong>{money(askedPriceCents)}</strong></p>
      {opinion?.available ? <div className="space-y-2 text-sm"><p><strong>Veículo:</strong> {opinion.vehicle}</p><p><strong>Negócio:</strong> {opinion.deal}</p></div> : <p className="text-sm text-muted">{opinion?.warning || "Parecer de IA indisponível."} {calculation ? "Nota financeira e valores calculados pelo motor com premissas provisórias." : "Informe uma referência FIPE para estimar revenda e resultado."}</p>}
      <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-muted">{calculation && calculation.resultCents < 0 ? "Prejuízo estimado" : "Lucro estimado"}</dt><dd className="font-display text-2xl">{money(calculation?.resultCents ?? null)}</dd></div><div><dt className="text-sm text-muted">Preço ideal de compra{dealType === "normal" ? "" : " (referência)"}</dt><dd className="font-display text-xl">{money(output.idealCents)}</dd></div></dl>
      <p className="text-xs text-muted">{dealType === "repasse" ? "Repasse: hipótese de giro curto, no cenário rápido da política." : `Hipótese de revenda em ${calculation?.days ?? 60} dias: FIPE × fator da política.`} {dealType !== "normal" && "A nota avalia o valor informado; o ideal serve apenas de referência."} Resultado após custos configurados, sem equivaler a lucro líquido contábil.</p>
    </div>
    <div className="space-y-2 border border-white/10 p-4"><h3 className="font-display font-semibold">Custos estimados</h3><p className="text-xs text-muted">Estimados pela IA a partir do que você escreveu e do perfil do carro; sem a IA, valem as reservas padrão da política. São premissas, não orçamento da Garagem.</p><ul className="space-y-2 text-sm">{scenario?.costs?.map(c => <li key={c.key}><div className="flex justify-between gap-3"><span>{c.label}</span><span className="shrink-0">{money(c.valueCents)}</span></div>{"note" in c && c.note ? <p className="text-xs text-muted">{c.note}</p> : null}</li>) ?? <li>Sem hipótese de revenda para calcular.</li>}</ul></div>
    <details className="border border-white/10 p-4 text-sm"><summary className="cursor-pointer">Detalhes técnicos e premissas</summary><div className="mt-3 space-y-3 text-muted">
      <p>Política {output.parameters.version}. Metas, custos e giro são hipóteses; não são médias reais da loja.</p>
      <p>Teto financeiro: {money(output.ceilingCents)}. Meta: {money(output.parameters.targetCents)}.</p>
      {output.scenarios.map(s => <p key={s.key}>{SCENARIO_LABELS[s.key]}: {s.calculation ? `${s.calculation.days} dias · revenda ${money(s.calculation.resaleCents)} · resultado ${money(s.calculation.resultCents)} · permanência ${money(s.holdingCents ?? 0)} · proporcionais ${money(s.calculation.proportionalCents)} · capital ${money(s.calculation.capitalCents)}` : "Indisponível sem FIPE."}</p>)}
      {opinion && <p>{opinion.warning}</p>}
      {result.fipeSnapshot && <p>FIPE {result.fipeSnapshot.referenceMonth}: {money(result.fipeSnapshot.valueCents)}.</p>}
      <ul className="list-disc space-y-1 pl-4">{score.blockers.map(b => <li key={b}>{b}</li>)}</ul>
    </div></details>
  </section>;
}
