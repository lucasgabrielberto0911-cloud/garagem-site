"use client";

import { useState } from "react";
import { inputClass } from "@/components/admin/ui";
import type { PurchaseInput } from "@/lib/purchase-input";
import { type FipeSnapshot, type parseFipeCandidates } from "@/lib/fipe-history";
import { Field, money, purchaseRequest } from "./Fields";

export type FipeCandidate = ReturnType<typeof parseFipeCandidates>[number];
export function FipeHistoryPanel({ candidates, identity, onPending, onFailure, onSelect }: { candidates: FipeCandidate[]; identity: PurchaseInput["identity"]; onPending: () => void; onFailure: (message: string) => void; onSelect: (candidate: FipeCandidate, snapshot: FipeSnapshot) => void }) {
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  async function select(code: string) {
    setSelected(code); onPending();
    const candidate = candidates.find(c => c.code === code);
    if (!candidate) return;
    setBusy(true);
    try {
      const snapshot = await purchaseRequest<FipeSnapshot>("/api/admin/fipe-historico", { action: "history", code: candidate.code, modelYear: candidate.modelYear, expectedFuel: candidate.fuel, versionLabel: candidate.model, transmission: identity.transmission || "Não informado", confirmed: true, fuelDecision: "Versão e combustível do candidato escolhidos pelo operador no seletor FIPE." });
      onSelect(candidate, snapshot);
    } catch (e) { onFailure((e as Error).message); setSelected(""); } finally { setBusy(false); }
  }
  if (!candidates.length) return null;
  return <div className="space-y-2">
    <Field label="Confirme a versão FIPE"><select className={inputClass} disabled={busy} value={selected} onChange={e => void select(e.target.value)}><option value="">Escolha a versão do veículo</option>{candidates.map(c => <option key={c.code} value={c.code}>{c.model} · {c.modelYear} · {c.fuel} · {money(c.valueCents)}</option>)}</select></Field>
    <p className="text-xs text-muted">Escolher a versão confirma a identidade. Confira o acabamento e o câmbio.</p>
    {busy && <p role="status" className="text-sm">Consultando FIPE e histórico…</p>}
  </div>;
}
