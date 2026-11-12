"use client";

import { useRef, useState } from "react";
import { AdminPageHeader, btn, Card, inputClass } from "@/components/admin/ui";
import { confirmDiscard, useConfirmDialog } from "@/components/admin/useConfirmDialog";
import type { PurchaseInput } from "@/lib/purchase-input";
import { newQuickPurchase, quickFromStored, type QuickPurchase } from "@/lib/purchase-quick";
import type { PreparedPurchase, listPurchases, readPurchase } from "@/lib/purchase-store";
import { Field, MoneyField, money, purchaseRequest } from "./Fields";
import { FipeHistoryPanel, type FipeCandidate } from "./FipeHistoryPanel";
import { PurchaseResult, type PurchaseResultData } from "./PurchaseResult";

type List = Awaited<ReturnType<typeof listPurchases>>;
type Detail = Awaited<ReturnType<typeof readPurchase>>;
type Source = { kind: "vehicle" | "lead"; id: string; title: string };
export function PurchaseForm({ initialList, fipeEnabled }: { initialList: List; fipeEnabled: boolean }) {
  const [input, setInput] = useState(newQuickPurchase);
  const [sources, setSources] = useState<Source[]>([]), [candidates, setCandidates] = useState<FipeCandidate[]>([]);
  const [list, setList] = useState(initialList), [detail, setDetail] = useState<Detail | null>(null);
  const [result, setResult] = useState<PurchaseResultData | null>(null);
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [manual, setManual] = useState(false), [dirty, setDirty] = useState(false);
  const [id, setId] = useState<string | null>(null), [version, setVersion] = useState(0), [key, setKey] = useState<string | null>(null);
  const lookup = useRef("");
  const [confirm, confirmDialog] = useConfirmDialog();
  function change(next: QuickPurchase) { setInput(next); setResult(null); setKey(null); setDirty(true); setMessage(""); setError(""); }
  function patch<K extends keyof QuickPurchase>(field: K, value: QuickPurchase[K]) { change({ ...input, [field]: value }); }
  function identity(field: "brand" | "model" | "modelYear", value: string | number | null) { setCandidates([]); change({ ...input, fipe: null, identity: { ...input.identity, [field]: value, version: "", confirmed: false } }); }
  async function consult() {
    if (busy) return;
    const plate = input.plate.toUpperCase().replace(/[-\s]/g, "");
    if (!plate || lookup.current === plate) return;
    lookup.current = plate; setBusy(true); setError(""); setMessage(""); setCandidates([]);
    try {
      const found = await purchaseRequest<Source[]>("/api/admin/compra/origem", { action: "search", plate });
      setSources(found);
      const data = await purchaseRequest<{ identity: QuickPurchase["identity"]; candidates: FipeCandidate[]; warning: string }>("/api/admin/compra/placa", { plate });
      change({ ...input, plate, fipe: null, identity: data.identity }); setCandidates(data.candidates); setManual(false); setMessage(data.warning);
    } catch (e) { setError((e as Error).message); setManual(true); lookup.current = ""; } finally { setBusy(false); }
  }
  async function searchVersions() {
    setBusy(true); setError(""); setCandidates([]);
    try { const data = await purchaseRequest<{ candidates: FipeCandidate[] }>("/api/admin/fipe-historico", { action: "match", brand: input.identity.brand, model: input.identity.model, year: input.identity.modelYear }); setCandidates(data.candidates); if (!data.candidates.length) setMessage("Nenhuma versão encontrada. Você pode informar uma FIPE manual."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function calculate() {
    setBusy(true); setError("");
    try { const data = await purchaseRequest<PreparedPurchase>("/api/admin/compra/simular", { input }); setResult(data); setStep(2); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function displayRevision(revision: Detail["revisions"][number]) {
    const evidence = revision.evidenceSnapshot as unknown as PreparedPurchase["evidenceSnapshot"];
    setInput(quickFromStored(revision.input as unknown as PurchaseInput, evidence?.quick ?? undefined));
    setResult({ output: revision.output as unknown as PreparedPurchase["output"], score: revision.score as unknown as PreparedPurchase["score"], fipeSnapshot: revision.fipeSnapshot as unknown as PreparedPurchase["fipeSnapshot"], opinion: evidence?.opinion ?? null });
    setCandidates([]); setSources([]); lookup.current = ""; setKey(null); setDirty(false); setStep(2);
  }
  async function open(evaluationId: string) {
    if (dirty && !(await confirmDiscard(confirm, "desta avaliação"))) return;
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
      setMessage(`Avaliação salva. Revisão ${saved.currentVersion}.`); setList(await purchaseRequest<List>("/api/admin/compra"));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function reset() {
    if (dirty && !(await confirmDiscard(confirm, "desta avaliação"))) return;
    setSources([]); setCandidates([]); setInput(newQuickPurchase()); setResult(null); setDetail(null); setId(null); setVersion(0); setKey(null); setStep(0); setDirty(false); setManual(false); setError(""); setMessage(""); lookup.current = "";
  }
  const canContinue = Boolean(input.identity.brand.trim() && input.identity.model.trim() && input.identity.modelYear && (!candidates.length || input.identity.confirmed));
  return <div className="min-w-0 space-y-5">
    <AdminPageHeader title="Avaliador de compra" subtitle="Placa, valor e um parecer para decidir a compra." actions={<button type="button" className={btn.outline} disabled={busy} onClick={reset}>Nova avaliação</button>} />
    <p className="text-xs text-muted">Política provisória: metas e custos ainda são hipóteses. Salvar registra somente a avaliação.</p>
    {error && <p role="alert" className="border border-brand/50 p-3 text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="border border-white/20 p-3 text-sm">{message}</p>}
    <nav aria-label="Etapas da compra" className="grid grid-cols-3 gap-1 [&>button]:px-1 sm:gap-2 sm:[&>button]:px-4">{["Placa", "Compra", "Resultado"].map((label, index) => <button type="button" disabled={busy || (index === 1 && !canContinue) || (index === 2 && !result)} className={step === index ? btn.primary : btn.outline} aria-current={step === index ? "step" : undefined} key={label} onClick={() => setStep(index)}>{index + 1}. {label}</button>)}</nav>
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      {step === 0 && <Card title="Placa do veículo"><div className="space-y-4">
        <Field label="Placa"><input className={`${inputClass} uppercase`} maxLength={10} autoComplete="off" value={input.plate} onChange={e => { lookup.current = ""; setCandidates([]); setSources([]); change({ ...input, plate: e.target.value, source: null, km: null, identity: newQuickPurchase().identity, fipe: null }); }} onBlur={() => void consult()} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void consult(); } }} /></Field>
        <button type="button" className={btn.outline} onClick={() => { lookup.current = ""; void consult(); }}>Consultar placa</button>
        {sources.length > 0 && <div className="space-y-2"><p className="text-sm">Registros internos encontrados. Escolha se deseja vincular uma origem:</p>{sources.map(source => <button type="button" className={`${btn.outline} w-full whitespace-normal text-left`} key={`${source.kind}-${source.id}`} aria-pressed={input.source?.id === source.id && input.source.kind === source.kind} onClick={async () => { setBusy(true); setError(""); try { const loaded = await purchaseRequest<PurchaseInput>("/api/admin/compra/origem", { action: "load", kind: source.kind, id: source.id }); change({ ...input, source: loaded.source, km: input.km ?? loaded.km, ...(!input.identity.brand && loaded.identity.brand ? { identity: loaded.identity, fipe: null } : {}) }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{source.title}</button>)}</div>}
        {input.identity.brand && <p className="text-sm">{input.identity.brand} {input.identity.model} · {input.identity.modelYear}</p>}
        <FipeHistoryPanel key={JSON.stringify(candidates)} candidates={candidates} identity={input.identity} onFailure={message => { setError(message); setManual(true); setCandidates([]); }} onPending={() => change({ ...input, fipe: null, identity: { ...input.identity, confirmed: false } })} onSelect={(candidate, snapshot) => change({ ...input, identity: { brand: snapshot.brand, model: input.identity.model, version: snapshot.model, modelYear: snapshot.modelYear, fuel: candidate.fuel, transmission: input.identity.transmission || "Não informado", confirmed: true }, fipe: { provider: "tabelafipe.info", code: snapshot.code, referenceMonth: snapshot.referenceMonth, valueCents: snapshot.valueCents, source: snapshot.sourceUrl, fuelDecision: "Versão e combustível do candidato escolhidos pelo operador no seletor FIPE." } })} />
        <Field label="KM (opcional)"><input className={inputClass} type="number" inputMode="numeric" min="0" value={input.km ?? ""} onChange={e => patch("km", e.target.value === "" ? null : Number(e.target.value))} /></Field>
        <button type="button" className={btn.ghost} onClick={() => setManual(!manual)}>{manual ? "Recolher preenchimento manual" : "Preencher sem consulta"}</button>
        {manual && <div className="grid gap-3 sm:grid-cols-3">{([['brand', 'Marca'], ['model', 'Modelo']] as const).map(([field, label]) => <Field key={field} label={label}><input className={inputClass} maxLength={field === "brand" ? 80 : 120} value={input.identity[field]} onChange={e => identity(field, e.target.value)} /></Field>)}<Field label="Ano-modelo"><input className={inputClass} type="number" value={input.identity.modelYear ?? ""} onChange={e => identity("modelYear", e.target.value ? Number(e.target.value) : null)} /></Field>{fipeEnabled && <button type="button" className={btn.outline} onClick={searchVersions}>Buscar versões FIPE</button>}</div>}
        <details className="text-sm"><summary className="cursor-pointer">Referência FIPE manual (se a consulta falhar)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><MoneyField label="FIPE manual (R$)" value={input.fipe?.valueCents ?? null} onChange={value => patch("fipe", { provider: "manual", code: "", source: "Referência informada pelo operador; não verificada.", fuelDecision: "", referenceMonth: input.fipe?.referenceMonth || new Date().toISOString().slice(0, 7), valueCents: value ?? 0 })} /><Field label="Mês FIPE"><input className={inputClass} type="month" value={input.fipe?.referenceMonth ?? ""} onChange={e => patch("fipe", { provider: "manual", code: "", source: "Referência informada pelo operador; não verificada.", fuelDecision: "", valueCents: input.fipe?.valueCents ?? 0, referenceMonth: e.target.value })} /></Field></div></details>
        <button type="button" className={btn.primary} disabled={!canContinue} onClick={() => setStep(1)}>Continuar para compra</button>
      </div></Card>}
      {input.fipe && step < 2 && <p className="border border-brand/30 p-3 text-sm">FIPE da versão escolhida · {input.fipe.referenceMonth}: <strong>{money(input.fipe.valueCents)}</strong>{input.fipe.provider === "manual" && " (manual, não verificada)"}</p>}
      {step === 1 && <Card title="Compra"><div className="space-y-5">
        <MoneyField label="Preço de compra (R$) *" value={input.askedPriceCents || null} onChange={v => patch("askedPriceCents", v ?? 0)} />
        <div role="group" aria-label="Tipo do negócio" className="grid gap-2 sm:grid-cols-3">{([["normal", "Compra normal (posso negociar)"], ["sem_oferta", "Sem oferta (avaliar neste valor)"], ["repasse", "Repasse"]] as const).map(([value, label]) => <button type="button" className={`${input.dealType === value ? btn.primary : btn.outline} whitespace-normal`} key={value} aria-pressed={input.dealType === value} onClick={() => patch("dealType", value)}>{label}</button>)}</div>
        <div><p className="mb-2 text-sm">Laudo cautelar (opcional)</p><div role="group" aria-label="Laudo cautelar" className="flex flex-wrap gap-2">{([["nao_feito", "Sem laudo"], ["aprovado", "Aprovado"], ["reprovado", "Não aprovado"]] as const).map(([value, label]) => <button type="button" className={input.inspection === value ? btn.primary : btn.outline} key={value} aria-pressed={input.inspection === value} onClick={() => patch("inspection", value)}>{label}</button>)}</div></div>
        <Field label="O que o carro tem ou precisa fazer? (opcional)"><textarea className={inputClass} rows={5} maxLength={4000} placeholder="Escreva como se contasse para um mecânico: o que o carro tem e o que precisa (pneus carecas, barulho na suspensão, pintura do para-choque, ar sem gelar). A IA estima os custos a partir do seu texto." value={input.notes} onChange={e => patch("notes", e.target.value)} /></Field>
        <button type="button" className={btn.primary} onClick={calculate}>Calcular parecer</button>
      </div></Card>}
      {step === 2 && result && <><PurchaseResult result={result} askedPriceCents={input.askedPriceCents} dealType={input.dealType} /><div className="flex flex-wrap gap-2"><button type="button" className={btn.primary} onClick={save}>{id ? "Salvar nova revisão" : "Salvar avaliação"}</button><button type="button" className={btn.outline} onClick={() => setStep(1)}>Ajustar compra</button></div></>}
    </fieldset>
    {busy && <p role="status" className="text-sm">Aguarde…</p>}
    {detail && <details className="text-sm"><summary className="cursor-pointer py-2">Revisões de {detail.title}</summary><div className="flex flex-wrap gap-2">{detail.revisions.map(r => <button type="button" disabled={busy} className={btn.outline} key={r.id} onClick={async () => { if (!dirty || await confirmDiscard(confirm, "desta avaliação")) displayRevision(r); }}>Revisão {r.number}</button>)}</div></details>}
    <details className="text-sm"><summary className="cursor-pointer py-2">Minhas avaliações</summary><ul className="space-y-2">{list.evaluations.map(e => <li key={e.id}><button type="button" className={`${btn.outline} w-full whitespace-normal justify-start text-left`} disabled={busy} onClick={() => void open(e.id)}>{e.title} · revisão {e.currentVersion}</button></li>)}</ul>{!list.evaluations.length && <p className="text-muted">Nenhuma avaliação salva.</p>}{list.nextCursor && <button type="button" className={`${btn.outline} mt-3`} disabled={busy} onClick={async () => { setBusy(true); try { const next = await purchaseRequest<List>(`/api/admin/compra?cursor=${list.nextCursor}`); setList({ evaluations: [...list.evaluations, ...next.evaluations], nextCursor: next.nextCursor }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Carregar mais avaliações</button>}</details>
    {confirmDialog}
  </div>;
}
