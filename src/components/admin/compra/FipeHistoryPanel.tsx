"use client";

import { useState } from "react";
import { btn, Card, inputClass } from "@/components/admin/ui";
import type { PurchaseInput } from "@/lib/purchase-input";
import { fipeVariation, type FipeSnapshot, type parseFipeCandidates } from "@/lib/fipe-history";
import { Field, money, purchaseRequest } from "./Fields";

type Candidate = ReturnType<typeof parseFipeCandidates>[number];
export function FipeHistoryPanel({ identity, enabled, onIdentity, onReference }: { identity: PurchaseInput["identity"]; enabled: boolean; onIdentity: (i: PurchaseInput["identity"]) => void; onReference: (f: PurchaseInput["fipe"]) => void }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [snapshot, setSnapshot] = useState<FipeSnapshot | null>(null);
  const [fuelDecision, setFuelDecision] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function search() {
    setBusy(true); setError(""); setSelected(null); setSnapshot(null); setCandidates([]);
    try { const data = await purchaseRequest<{ candidates: Candidate[] }>("/api/admin/fipe-historico", { action: "match", brand: identity.brand, model: `${identity.model} ${identity.version}`.trim(), year: identity.modelYear }); setCandidates(data.candidates); if (!data.candidates.length) setError("Nenhum candidato encontrado. Use FIPE manual."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function history() {
    if (!selected) return;
    setBusy(true); setError(""); setSnapshot(null);
    try { const data = await purchaseRequest<FipeSnapshot>("/api/admin/fipe-historico", { action: "history", code: selected.code, modelYear: identity.modelYear, expectedFuel: identity.fuel, versionLabel: identity.version, transmission: identity.transmission, confirmed: identity.confirmed, fuelDecision }); setSnapshot(data); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Card title="Referência FIPE e histórico">
    <p className="mb-3 text-sm text-muted">FIPE é referência nacional, não teto de revenda nem preço de compra de lojista. Match apenas sugere candidatos.</p>
    {!enabled ? <p className="text-sm text-muted">Consulta externa desativada. Você pode informar FIPE manual com mês e origem.</p> : <div className="space-y-3">
      <button type="button" className={btn.outline} disabled={busy} onClick={search}>Sugerir versões FIPE</button>
      <p className="text-xs text-muted">Nenhuma versão é selecionada automaticamente. Confirme também o câmbio; EX e EXL podem empatar.</p>
      {candidates.map(c => <label className="flex gap-3 border border-white/10 p-3 text-sm" key={`${c.code}-${c.modelYear}`}><input type="radio" name="fipe-candidate" checked={selected?.code === c.code} onChange={() => { setSelected(c); setSnapshot(null); onIdentity({ ...identity, brand: c.brand, version: c.model, modelYear: c.modelYear, fuel: identity.fuel || c.fuel, confirmed: false }); }} /><span>{c.model} · {c.modelYear} · {c.fuel} · {c.code} · similaridade {c.score}</span></label>)}
      {selected && <><Field label="Decisão sobre combustível divergente (se houver)"><textarea className={inputClass} maxLength={500} value={fuelDecision} onChange={e => { setFuelDecision(e.target.value); setSnapshot(null); }} /></Field><button type="button" className={btn.outline} disabled={busy || !identity.confirmed} onClick={history}>Consultar histórico da versão confirmada</button></>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {snapshot && <div className="space-y-3 text-sm">
        <p>{snapshot.model} · {snapshot.modelYear} · {snapshot.referenceMonth}: <strong>{money(snapshot.valueCents)}</strong></p>
        <p className="text-muted">Combustível bruto: {snapshot.fuelRaw}. Coletado em {new Date(snapshot.fetchedAt).toLocaleString("pt-BR")}.</p>
        {snapshot.warnings.map(w => <p className="text-amber-300" key={w}>{w}</p>)}
        <dl className="grid grid-cols-2 gap-2">{[3, 6, 12, 24].map(months => { const variation = fipeVariation(snapshot, months); return <div key={months}><dt>{months} meses</dt><dd>{variation ? `${(variation.change * 100).toFixed(2)}%` : "Indisponível: mês exato ausente"}</dd></div>; })}</dl>
        <details><summary className="cursor-pointer py-2">Pontos mensais (lacunas preservadas)</summary><ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">{snapshot.history.map(p => <li key={p.referenceMonth}>{p.referenceMonth}: {money(p.valueCents)}</li>)}</ul></details>
        <button type="button" disabled={!identity.confirmed || identity.version !== snapshot.model || identity.modelYear !== snapshot.modelYear} className={btn.outline} onClick={() => onReference({ provider: "tabelafipe.info", code: snapshot.code, referenceMonth: snapshot.referenceMonth, valueCents: snapshot.valueCents, source: snapshot.sourceUrl, fuelDecision })}>Usar esta referência FIPE</button>
      </div>}
    </div>}
    <a className="mt-3 inline-block text-xs underline" href="https://tabelafipe.info" target="_blank" rel="noopener noreferrer">dados via tabelafipe.info (Tabela FIPE)</a>
  </Card>;
}
