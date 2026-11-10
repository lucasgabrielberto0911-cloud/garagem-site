"use client";

import { Card } from "@/components/admin/ui";
import { SCENARIO_LABELS } from "@/lib/purchase-policy";
import type { PreparedPurchase } from "@/lib/purchase-store";
import { money } from "./Fields";

const verdicts = { compensa: "Compensa sob estas condições", atencao: "Atenção", nao_atende: "Não atende à política", pendente: "Avaliação pendente" };
export function PurchaseResult({ result, askedPriceCents }: { result: Pick<PreparedPurchase, "output" | "score" | "fipeSnapshot">; askedPriceCents: number }) {
  const { output, score } = result;
  return <section aria-label="Resultado da compra" className="space-y-4">
    <div className="border border-brand/50 bg-ink p-4 sm:p-6">
      <h2 className="font-display text-xl font-semibold">{verdicts[score.verdict]}</h2>
      <p className="mt-2 text-sm">Preço avaliado: <strong>{money(askedPriceCents)}</strong></p>
      <p className="mt-2">{score.total === null ? `Nota parcial: ${(score.partial / 10).toFixed(1)} · intervalo ${(score.min / 10).toFixed(1)}–${(score.max / 10).toFixed(1)}` : `Nota: ${(score.total / 10).toFixed(1)}/10`} · confiança {score.confidence === "media" ? "média" : score.confidence}</p>
      <p className="mt-1 text-sm text-muted">Cobertura: {Math.round(score.coverage * 100)}%. Nota não é probabilidade de lucro.</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-muted">Teto recomendado</dt><dd className="font-display text-xl">{output.ceilingCents !== null && output.ceilingCents <= 0 ? "Nenhuma compra positiva atende às premissas" : money(output.ceilingCents)}</dd></div><div><dt className="text-sm text-muted">Preço ideal (folga e passo de oferta)</dt><dd className="font-display text-xl">{money(output.idealCents)}</dd></div></dl>
      <p className="mt-3 text-sm">{score.explanation}</p>
      <p className="mt-2 text-xs text-muted">Desconto necessário para a política: {money(output.requiredDiscountCents)}. Preço fixo não recebe penalidade adicional.</p>
    </div>
    {score.blockers.length > 0 && <Card title="Pendências e riscos"><ul className="list-disc space-y-2 pl-5 text-sm">{score.blockers.map(b => <li key={b}>{b}</li>)}</ul></Card>}
    <div className="grid gap-3 xl:grid-cols-3">{output.scenarios.map(s => <Card key={s.key} title={SCENARIO_LABELS[s.key]}>{s.calculation ? <div className="space-y-2 text-sm">
      <p>{s.calculation.days} dias · venda efetiva {money(s.calculation.resaleCents)}</p>
      <p className="font-display text-lg">Resultado: {money(s.calculation.resultCents)}</p>
      <p>Meta: {money(s.calculation.targetCents)} · teto: {money(s.calculation.ceilingCents)}</p>
      <p>Margem sobre venda: {(s.calculation.margin * 100).toFixed(2)}%</p>
      <p>Retorno sobre capital: {s.calculation.returnOnCapital === null ? "indisponível" : `${(s.calculation.returnOnCapital * 100).toFixed(2)}%`} (base {money(s.calculation.investedCents)})</p>
      <p>Revenda de equilíbrio: {money(s.calculation.breakEvenResaleCents)}</p>
      <details><summary className="cursor-pointer py-2">Conferir custos e equação</summary><ul className="space-y-1">{s.costs?.map(c => <li key={c.key}>{c.label}: {money(c.valueCents)}{c.provisional ? " (premissa provisória)" : ""}</li>)}<li>Permanência: {money(s.holdingCents ?? 0)}</li><li>Proporcionais: {money(s.calculation.proportionalCents)}</li><li>Capital: {money(s.calculation.capitalCents)}</li></ul><p className="mt-2 text-xs">Venda − custos proporcionais − custos fixos − compra − custo de capital = resultado.</p></details>
    </div> : <p className="text-sm text-muted">Informe a revenda efetiva deste cenário.</p>}</Card>)}</div>
    <Card title="Como a nota foi calculada"><ul className="space-y-4 text-sm">{score.dimensions.map(d => <li key={d.key}><strong className="capitalize">{({ financeiro: "Financeiro", liquidez: "Liquidez", condicao: "Condição", documentacao: "Documentação", completude: "Completude" } as Record<string, string>)[d.key]}</strong>: {d.pointsMin.toFixed(1)}–{d.pointsMax.toFixed(1)} de {d.weight} pontos<p className="text-muted">{d.reason}</p><p className="text-xs text-muted">Evidências: {d.evidenceIds.join(", ")}</p></li>)}</ul></Card>
    <Card title="Premissas e evidências"><div className="space-y-2 text-sm text-muted"><p>{output.explanation}</p><p>Política {output.parameters.version}, provisória. Meta {money(output.parameters.targetCents)}; custos sobre venda {(output.parameters.proportionalRate * 100).toFixed(2)}%; capital simples {(output.parameters.monthlyCapitalRate * 100).toFixed(2)}% ao mês. Não representam regime tributário ou médias da loja.</p><p>Sem pesquisa de mercado ou IA nesta entrega. Nenhum bônus por marca/modelo.</p>{result.fipeSnapshot && <div className="space-y-2 border-t border-white/10 pt-3"><p>FIPE {result.fipeSnapshot.referenceMonth}: {money(result.fipeSnapshot.valueCents)}</p><p className="break-words">Origem: {"sourceUrl" in result.fipeSnapshot ? result.fipeSnapshot.sourceUrl : result.fipeSnapshot.source}</p>{"warning" in result.fipeSnapshot && <p>{result.fipeSnapshot.warning}</p>}{"warnings" in result.fipeSnapshot && result.fipeSnapshot.warnings?.map(warning => <p key={warning}>{warning}</p>)}{"history" in result.fipeSnapshot && <details><summary className="cursor-pointer py-2">Histórico usado nesta revisão</summary><ul className="grid gap-1 sm:grid-cols-2">{result.fipeSnapshot.history?.map(point => <li key={point.referenceMonth}>{point.referenceMonth}: {money(point.valueCents)}</li>)}</ul></details>}</div>}</div></Card>
  </section>;
}
