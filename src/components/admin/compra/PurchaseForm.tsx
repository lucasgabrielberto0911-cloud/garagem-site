"use client";

import { useState } from "react";
import { AdminPageHeader, btn, Card, inputClass } from "@/components/admin/ui";
import { CONDITION_KEYS, newPurchaseInput, type PurchaseInput, type Presence, type ConditionState } from "@/lib/purchase-input";
import { SCENARIO_KEYS, SCENARIO_LABELS, type CostItem } from "@/lib/purchase-policy";
import type { PreparedPurchase, listPurchases, readPurchase } from "@/lib/purchase-store";
import { Check, Field, MoneyField, purchaseRequest, SelectField } from "./Fields";
import { FipeHistoryPanel } from "./FipeHistoryPanel";
import { PurchaseResult } from "./PurchaseResult";

type List = Awaited<ReturnType<typeof listPurchases>>;
type Detail = Awaited<ReturnType<typeof readPurchase>>;
const presenceOptions: [Presence, string][] = [["desconhecido", "Não informado"], ["verificado", "Presente e comprovado"], ["ausente", "Ausente"]];
const conditionOptions: [ConditionState, string][] = [["desconhecido", "Desconhecido"], ["verificado", "OK verificado"], ["orcado", "Precisa fazer, com orçamento"], ["grave", "Problema relevante sem diagnóstico"], ["nao_se_aplica", "Não se aplica (justifique)"]];
const conditionLabels = { mecanica: "Mecânica", pneus: "Pneus", lataria: "Lataria/pintura", interior: "Interior", revisao: "Revisão", documentacao: "Documentação" };

export function PurchaseForm({ initialList, fipeEnabled }: { initialList: List; fipeEnabled: boolean }) {
  const [sources, setSources] = useState<Array<{ kind: "vehicle" | "lead"; id: string; title: string }>>([]);
  const [input, setInput] = useState<PurchaseInput>(newPurchaseInput);
  const [list, setList] = useState(initialList), [detail, setDetail] = useState<Detail | null>(null);
  const [result, setResult] = useState<Pick<PreparedPurchase, "output" | "score" | "fipeSnapshot"> | null>(null);
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [id, setId] = useState<string | null>(null), [version, setVersion] = useState(0), [key, setKey] = useState<string | null>(null), [dirty, setDirty] = useState(false);
  function change(next: PurchaseInput) { setInput(next); setResult(null); setKey(null); setDirty(true); setMessage(""); setError(""); }
  function patch<K extends keyof PurchaseInput>(field: K, value: PurchaseInput[K]) { change({ ...input, [field]: value }); }
  function identity(field: keyof PurchaseInput["identity"], value: string | number | boolean | null) { change({ ...input, fipe: input.fipe?.provider === "tabelafipe.info" ? null : input.fipe, identity: { ...input.identity, [field]: value, ...(field !== "confirmed" ? { confirmed: false } : {}) } }); }
  async function calculate() {
    setBusy(true); setError("");
    try { const data = await purchaseRequest<PreparedPurchase>("/api/admin/compra/simular", { input }); setResult(data); setStep(2); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function displayRevision(revision: Detail["revisions"][number]) {
    setInput(revision.input as unknown as PurchaseInput);
    setResult({ output: revision.output as unknown as PreparedPurchase["output"], score: revision.score as unknown as PreparedPurchase["score"], fipeSnapshot: revision.fipeSnapshot as unknown as PreparedPurchase["fipeSnapshot"] });
    setKey(null); setDirty(false); setStep(2);
  }
  async function open(evaluationId: string) {
    if (dirty && !window.confirm("Descartar as alterações ainda não salvas e reabrir esta avaliação?")) return;
    setBusy(true); setError(""); setMessage("");
    try { const data = await purchaseRequest<Detail>(`/api/admin/compra/${evaluationId}`); setDetail(data); setId(data.id); setVersion(data.currentVersion); displayRevision(data.revisions[0]); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function save() {
    const requestKey = key ?? crypto.randomUUID(); setKey(requestKey); setBusy(true); setError(""); setMessage("");
    try {
      const saved = await purchaseRequest<{ id: string; currentVersion: number }>(id ? `/api/admin/compra/${id}/revisoes` : "/api/admin/compra", { input, requestKey, expectedVersion: version });
      const data = await purchaseRequest<Detail>(`/api/admin/compra/${saved.id}`);
      setId(saved.id); setVersion(data.currentVersion); setDetail(data); displayRevision(data.revisions[0]);
      setMessage(`Avaliação salva. Revisão ${saved.currentVersion}.`);
      setList(await purchaseRequest<List>("/api/admin/compra"));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function reset() {
    if (dirty && !window.confirm("Descartar as alterações ainda não salvas?")) return;
    setSources([]); setInput(newPurchaseInput()); setResult(null); setDetail(null); setId(null); setVersion(0); setKey(null); setStep(0); setDirty(false); setError(""); setMessage("");
  }
  function costChange(index: number, patchCost: Partial<CostItem>) { patch("costs", input.costs.map((c, j) => j === index ? { ...c, ...patchCost, fromProfile: false } : c)); }
  function manualFipe(field: string, value: string | number) { patch("fipe", { code: "", referenceMonth: "", valueCents: 0, source: "", fuelDecision: "", ...input.fipe, [field]: value, ...{ provider: "manual" as const } }); }
  return <div className="min-w-0 space-y-5">
    <AdminPageHeader title="Avaliador de compra" subtitle="Decida no preço pedido, com teto, preço ideal e riscos explicados. Uso exclusivo do painel." actions={<button type="button" className={btn.outline} disabled={busy} onClick={reset}>Nova avaliação</button>} />
    <p className="border border-amber-400/30 p-3 text-sm text-amber-200">Política provisória: metas, custos e taxas são hipóteses editáveis. Salvar registra somente a avaliação.</p>
    {error && <p role="alert" className="border border-brand/50 p-3 text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="border border-white/20 p-3 text-sm">{message}</p>}
    {result && <PurchaseResult result={result} askedPriceCents={input.askedPriceCents} />}
    <nav aria-label="Etapas da compra" className="grid gap-2 sm:grid-cols-3">{["Veículo e condição", "Preço e custos", "Resultado e evidências"].map((label, index) => <button type="button" className={step === index ? btn.primary : btn.outline} aria-current={step === index ? "step" : undefined} key={label} onClick={() => setStep(index)}>{index + 1}. {label}</button>)}</nav>
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      {step === 0 && <>
        <Card title="Veículo"><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Descrição do veículo *"><input className={inputClass} maxLength={160} value={input.title} onChange={e => patch("title", e.target.value)} /></Field>
          <Field label="Placa (opcional e privada)"><input className={inputClass} maxLength={10} value={input.plate} onChange={e => patch("plate", e.target.value)} /></Field>
          {([["brand", "Marca"], ["model", "Modelo"], ["version", "Versão"], ["fuel", "Combustível"], ["transmission", "Câmbio"]] as const).map(([key, label]) => <Field key={key} label={label}><input className={inputClass} maxLength={key === "version" ? 160 : 80} value={input.identity[key]} onChange={e => identity(key, e.target.value)} /></Field>)}
          <Field label="Ano-modelo"><input className={inputClass} type="number" min="1950" max={new Date().getFullYear() + 1} value={input.identity.modelYear ?? ""} onChange={e => identity("modelYear", e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Quilometragem"><input className={inputClass} type="number" min="0" value={input.km ?? ""} onChange={e => patch("km", e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Região (privada)"><input className={inputClass} maxLength={100} value={input.region} onChange={e => patch("region", e.target.value)} /></Field>
        </div><div className="mt-3 space-y-2"><button type="button" className={btn.outline} onClick={async () => { setBusy(true); setError(""); try { setSources(await purchaseRequest<typeof sources>("/api/admin/compra/origem", { action: "search", plate: input.plate })); setMessage("Busca interna concluída. Escolha uma origem, se encontrada; nenhuma é selecionada automaticamente."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Buscar placa nos registros internos</button><p className="text-xs text-muted">Busca exata e privada. Sem consulta por placa a provedor externo. Dados carregados precisam ser conferidos.</p>{sources.map(source => <button type="button" className={`${btn.outline} w-full justify-start text-left`} key={`${source.kind}-${source.id}`} onClick={async () => { if (dirty && !window.confirm("Carregar outra origem descarta os campos atuais. Continuar?")) return; setBusy(true); setError(""); try { change(await purchaseRequest<PurchaseInput>("/api/admin/compra/origem", { action: "load", kind: source.kind, id: source.id })); setId(null); setVersion(0); setDetail(null); setSources([]); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{source.kind === "vehicle" ? "Veículo" : "Lead"}: {source.title}</button>)}</div><Check label="Conferi versão, ano-modelo, combustível e câmbio" checked={input.identity.confirmed} onChange={v => identity("confirmed", v)} /></Card>
        <FipeHistoryPanel key={`${id ?? "nova"}-${version}`} identity={input.identity} enabled={fipeEnabled} onIdentity={v => change({ ...input, identity: v, fipe: null })} onReference={v => patch("fipe", v)} />
        <Card title="FIPE usada (opcional)"><div className="grid gap-3 sm:grid-cols-3"><MoneyField label="Valor FIPE (R$)" value={input.fipe?.valueCents ?? null} onChange={v => manualFipe("valueCents", v ?? 0)} /><Field label="Mês FIPE"><input className={inputClass} type="month" value={input.fipe?.referenceMonth ?? ""} onChange={e => manualFipe("referenceMonth", e.target.value)} /></Field><Field label="Origem da FIPE"><input className={inputClass} maxLength={1000} value={input.fipe?.source ?? ""} onChange={e => manualFipe("source", e.target.value)} /></Field></div><p className="mt-2 text-xs text-muted">{input.fipe?.provider === "tabelafipe.info" ? "Referência consultada; o servidor confere o snapshot ao salvar." : "Referência manual não verificada. Não altera as hipóteses de revenda."}</p>{input.fipe && <button type="button" className={btn.ghost} onClick={() => patch("fipe", null)}>Remover referência</button>}</Card>
        <Card title="Condição e preparação"><div className="space-y-4">{CONDITION_KEYS.map(key => <div key={key} className="grid gap-2 sm:grid-cols-2"><SelectField label={conditionLabels[key]} value={input.conditions[key].state} options={conditionOptions} onChange={state => patch("conditions", { ...input.conditions, [key]: { ...input.conditions[key], state } })} /><Field label={`Evidência de ${conditionLabels[key].toLowerCase()}`}><input className={inputClass} maxLength={500} value={input.conditions[key].note} onChange={e => patch("conditions", { ...input.conditions, [key]: { ...input.conditions[key], note: e.target.value } })} /></Field></div>)}</div></Card>
        <Card title="Laudo, restrições e completude"><div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Laudo cautelar" value={input.inspection} options={[["desconhecido", "Não informado"], ["nao_feito", "Não feito"], ["pendente", "Pendente"], ["aprovado", "Aprovado"], ["apontamentos", "Aprovado com apontamentos"], ["reprovado", "Reprovado"]]} onChange={v => change({ ...input, inspection: v, inspectionVerified: false })} />
          <SelectField label="Leilão, sinistro ou restrição" value={input.restriction} options={[["desconhecido", "Desconhecido"], ["nao_verificado", "Declarado, não verificado"], ["resolvida", "Verificado sem pendências"], ["grave", "Restrição relevante não resolvida"]]} onChange={v => patch("restriction", v)} />
          <Field label="Data, emissor e apontamentos do laudo"><textarea className={inputClass} maxLength={500} value={input.inspectionNote} onChange={e => change({ ...input, inspectionNote: e.target.value, inspectionVerified: false })} /></Field>
          <Check label="Laudo conferido documentalmente" checked={input.inspectionVerified} onChange={v => patch("inspectionVerified", v)} />
          <SelectField label="Manual" value={input.manual} options={presenceOptions} onChange={v => patch("manual", v)} /><SelectField label="Chave reserva" value={input.spareKey} options={presenceOptions} onChange={v => patch("spareKey", v)} /><SelectField label="Histórico de manutenção" value={input.maintenanceHistory} options={presenceOptions} onChange={v => patch("maintenanceHistory", v)} />
        </div></Card>
      </>}
      {step === 1 && <>
        <Card title="Preço e revenda"><div className="grid gap-4 sm:grid-cols-2">
          <MoneyField label="Preço pedido pelo proprietário (R$) *" value={input.askedPriceCents || null} onChange={v => patch("askedPriceCents", v ?? 0)} />
          <SelectField label="Negociação" value={input.priceMode} options={[["fixo", "Preço fixo / avaliar neste valor"], ["negociavel", "Posso negociar"]]} onChange={v => patch("priceMode", v)} />
          <MoneyField label="Preço no anúncio de origem (R$)" value={input.sourceAdPriceCents} onChange={v => patch("sourceAdPriceCents", v)} /><MoneyField label="Anúncio pretendido pela Garagem (R$)" value={input.intendedAdPriceCents} onChange={v => patch("intendedAdPriceCents", v)} />
          {SCENARIO_KEYS.map(key => <MoneyField key={key} label={`Venda efetiva ${SCENARIO_LABELS[key].toLowerCase()} (R$)`} value={input.resaleCents[key]} onChange={v => patch("resaleCents", { ...input.resaleCents, [key]: v })} />)}
        </div><p className="mt-3 text-xs text-muted">Informe venda efetiva futura em 30/60/90 dias, já após negociação e eventual desvalorização. O motor não reaplica esses descontos. Anúncios não são vendas realizadas.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Fonte / premissa da revenda"><textarea className={inputClass} maxLength={1000} value={input.resaleEvidence.source} onChange={e => patch("resaleEvidence", { ...input.resaleEvidence, source: e.target.value, verified: false })} /></Field><Field label="Data da evidência de revenda"><input className={inputClass} type="date" value={input.resaleEvidence.date} onChange={e => patch("resaleEvidence", { ...input.resaleEvidence, date: e.target.value, verified: false })} /></Field></div><Check label="Conferi as evidências de revenda, distinguindo anúncios e vendas" checked={input.resaleEvidence.verified} onChange={v => patch("resaleEvidence", { ...input.resaleEvidence, verified: v })} /></Card>
        <Card title="Custos por serviço"><p className="mb-4 text-sm text-muted">Valores em reais. Desconhecido usa reserva provisória de R$ 300 na base e R$ 1.000 no adverso por item, e impede recomendação favorável. Zero, não se aplica ou incluído exigem justificativa. Sem pacote obrigatório.</p>
          <div className="space-y-5">{input.costs.map((cost, index) => <div key={cost.key} className="space-y-3 border-b border-white/10 pb-4">
            <h3 className="font-display text-sm font-semibold">{cost.label}</h3>
            <div className="grid gap-3 sm:grid-cols-2"><SelectField label={`Situação: ${cost.label}`} value={cost.status} options={[["desconhecido", "Desconhecido"], ["ok", "Valor confirmado"], ["estimado", "Faixa estimada"], ["nao_se_aplica", "Não se aplica"], ["incluido", "Incluído em outro item"]]} onChange={v => costChange(index, { status: v })} /><SelectField label={`Fonte: ${cost.label}`} value={cost.source ?? "premissa"} options={[["premissa", "Premissa provisória"], ["orcamento", "Orçamento específico"], ["historico", "Histórico verificado"]]} onChange={v => costChange(index, { source: v })} /></div>
            {["ok", "estimado"].includes(cost.status) && <div className="grid gap-3 sm:grid-cols-3">{(["minCents", "baseCents", "maxCents"] as const).filter(field => cost.status === "estimado" || field === "baseCents").map(field => <MoneyField key={field} label={`${({ minCents: "Mínimo", baseCents: "Base", maxCents: "Máximo" })[field]}: ${cost.label} (R$)`} value={cost[field] ?? null} onChange={v => costChange(index, { [field]: v ?? undefined })} />)}</div>}
            <SelectField label={`Área do orçamento: ${cost.label}`} value={cost.conditionKey ?? "nenhuma"} options={[["nenhuma", "Sem vínculo com a condição"], ...CONDITION_KEYS.map(k => [k, conditionLabels[k]] as const)]} onChange={v => costChange(index, { conditionKey: v === "nenhuma" ? undefined : v })} /><Field label={`Justificativa: ${cost.label}`}><input className={inputClass} maxLength={500} value={cost.note ?? ""} onChange={e => costChange(index, { note: e.target.value })} /></Field>
            <Field label={`Data: ${cost.label}`}><input className={inputClass} type="date" value={cost.date ?? ""} onChange={e => costChange(index, { date: e.target.value })} /></Field><Check label={`Desembolso antecipado: ${cost.label}`} checked={cost.upfront !== false} onChange={v => costChange(index, { upfront: v })} />
          </div>)}</div>
          <button type="button" className={`${btn.outline} mt-4`} onClick={() => { const label = window.prompt("Nome do serviço ou custo adicional (até 100 caracteres):"); if (label?.trim()) patch("costs", [...input.costs, { key: `extra-${crypto.randomUUID()}`, label: label.trim().slice(0, 100), status: "desconhecido", source: "premissa", upfront: true }]); }} disabled={input.costs.length >= 40}>Adicionar serviço/custo</button>
        </Card>
        <Card title="Parâmetros provisórios"><div className="grid gap-3 sm:grid-cols-2">{([["targetCents", "Meta de resultado (R$)"], ["holdingDailyCents", "Permanência por dia (R$)"], ["slackCents", "Folga abaixo do teto (R$)"], ["stepCents", "Passo de oferta (R$)"]] as const).map(([key, label]) => <MoneyField key={key} label={label} value={input.parameters[key]} onChange={v => patch("parameters", { ...input.parameters, [key]: v ?? 0 })} />)}{([["monthlyCapitalRate", "Capital simples por mês (%)"], ["proportionalRate", "Comissão/taxas sobre venda (%)"]] as const).map(([key, label]) => <Field key={key} label={label}><input type="number" className={inputClass} step="0.01" min="0" max="99.99" value={input.parameters[key] * 100} onChange={e => patch("parameters", { ...input.parameters, [key]: Number((Number(e.target.value) / 100).toFixed(8)) })} /></Field>)}</div><p className="mt-3 text-xs text-muted">Custos proporcionais são uma hipótese comercial, não regra fiscal. Teto usa a menor capacidade de compra dos três cenários; preço ideal subtrai folga e arredonda para baixo.</p></Card>
      </>}
      {step === 2 && <Card title="Evidências de liquidez"><p className="mb-3 text-sm text-muted">Sem vendas verificadas, deixe o prazo vazio. Não estime giro pela reputação do modelo. Estoque aberto não é venda concluída. Rubrica provisória exige 5 vendas e amostra efetiva de 3 para pontuar liquidez; sem cálculo verificado, deixe em branco.</p><div className="grid gap-3 sm:grid-cols-2"><Field label="Mediana de dias até venda"><input className={inputClass} type="number" min="1" value={input.liquidity.days ?? ""} onChange={e => patch("liquidity", { ...input.liquidity, days: e.target.value ? Number(e.target.value) : null, verified: false })} /></Field><Field label="Quantidade de vendas comparáveis"><input className={inputClass} type="number" min="1" value={input.liquidity.sampleCount ?? ""} onChange={e => patch("liquidity", { ...input.liquidity, sampleCount: e.target.value ? Number(e.target.value) : null, verified: false })} /></Field><Field label="Tamanho efetivo da amostra"><input className={inputClass} type="number" min="0.01" step="0.01" value={input.liquidity.effectiveSampleSize ?? ""} onChange={e => patch("liquidity", { ...input.liquidity, effectiveSampleSize: e.target.value ? Number(e.target.value) : null, verified: false })} /></Field><Field label="Fonte e tamanho da amostra de liquidez"><textarea className={inputClass} maxLength={1000} value={input.liquidity.source} onChange={e => patch("liquidity", { ...input.liquidity, source: e.target.value, verified: false })} /></Field><Field label="Data da evidência de liquidez"><input className={inputClass} type="date" value={input.liquidity.date} onChange={e => patch("liquidity", { ...input.liquidity, date: e.target.value, verified: false })} /></Field><Check label="Liquidez conferida em vendas comparáveis" checked={input.liquidity.verified} onChange={v => patch("liquidity", { ...input.liquidity, verified: v })} /></div>{!result && <p className="mt-4 text-sm">Calcule para ver cenários e nota no topo. Descrição e preço pedido bastam para salvar um rascunho com pendências.</p>}</Card>}
      <div className="flex flex-wrap gap-2"><button type="button" className={btn.primary} onClick={calculate}>{busy ? "Aguarde…" : "Calcular no preço pedido"}</button><button type="button" className={btn.outline} onClick={save}>{id ? "Salvar nova revisão" : "Salvar avaliação"}</button>{step < 2 && <button type="button" className={btn.outline} onClick={() => setStep(step + 1)}>Próxima etapa</button>}</div>
    </fieldset>
    {detail && <Card title={`Revisões de ${detail.title}`}><p className="mb-2 text-xs text-muted">Últimas 20 revisões. Reabrir uma anterior preserva o snapshot; salvar cria outra revisão.</p><div className="flex flex-wrap gap-2">{detail.revisions.map(r => <button type="button" disabled={busy} className={btn.outline} key={r.id} onClick={() => { if (!dirty || window.confirm("Descartar alterações não salvas?")) displayRevision(r); }}>Revisão {r.number}</button>)}</div></Card>}
    <Card title="Minhas avaliações"><ul className="space-y-2">{list.evaluations.map(e => <li key={e.id}><button type="button" className={`${btn.outline} w-full justify-start text-left`} disabled={busy} onClick={() => open(e.id)}>{e.title} · revisão {e.currentVersion}</button></li>)}</ul>{!list.evaluations.length && <p className="text-sm text-muted">Nenhuma avaliação salva.</p>}{list.nextCursor && <button type="button" className={`${btn.outline} mt-3`} disabled={busy} onClick={async () => { setBusy(true); try { const next = await purchaseRequest<List>(`/api/admin/compra?cursor=${list.nextCursor}`); setList({ evaluations: [...list.evaluations, ...next.evaluations], nextCursor: next.nextCursor }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Carregar mais avaliações</button>}</Card>
  </div>;
}
