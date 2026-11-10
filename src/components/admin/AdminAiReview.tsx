"use client";

import { useEffect, useRef, useState } from "react";
import { applySuggestions, type TextSuggestion } from "@/lib/admin-ai/revisar-texto";
import type { CaptionFacts } from "@/lib/admin-ai/melhorar-legenda";
import { btn } from "./ui";

export async function requestAdminAi(feature: string, body: unknown) {
  let response, result;
  try {
    response = await fetch(`/api/admin/ia/${feature}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(28_000) });
    result = await response.json();
  } catch { throw new Error("IA indisponível no momento. Continue editando e salve normalmente."); }
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "IA indisponível no momento.");
  return result;
}

type Proposal = { snapshot: string; revision: number; text: string; suggestions: TextSuggestion[]; caption: boolean };
export function AdminAiReview({ value, onApply, facts, disabled = false }: { value: string; onApply: (text: string) => void; facts?: CaptionFacts; disabled?: boolean }) {
  const snapshot = JSON.stringify([value, facts]);
  const [source, setSource] = useState({ snapshot, revision: 0 });
  if (source.snapshot !== snapshot) setSource({ snapshot, revision: source.revision + 1 });
  const latest = useRef(source);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  useEffect(() => {
    latest.current = source;
  }, [source]);
  const current = proposal?.snapshot === snapshot && proposal.revision === source.revision ? proposal : null;

  async function ask(caption: boolean) {
    const revision = latest.current.revision;
    setBusy(true); setMessage(""); setProposal(null);
    try {
      const result = await requestAdminAi(caption ? "melhorar-legenda" : "revisar-texto", caption ? { facts } : { text: value });
      if (latest.current.snapshot !== snapshot || latest.current.revision !== revision) { setMessage("O texto ou a ficha mudou. Resultado descartado; consulte novamente."); return; }
      const suggestions: TextSuggestion[] = caption ? [] : result.suggestions;
      if (!caption && !suggestions.length) { setMessage("Nenhum erro de português encontrado."); return; }
      setSelected(suggestions.map((_, index) => index));
      setProposal({ snapshot, revision, text: caption ? result.text : value, suggestions, caption });
    } catch (error) {
      setMessage(error instanceof Error && error.name !== "TimeoutError" && error.name !== "TypeError" ? error.message : "IA indisponível no momento. Continue editando e salve normalmente.");
    } finally { setBusy(false); }
  }

  return <div className="mt-2 min-w-0 space-y-2" role="group" aria-label="Sugestões de IA" aria-busy={busy}>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={btn.outline} disabled={disabled || busy || !value.trim()} onClick={() => void ask(false)}>{busy ? "Consultando IA…" : "Revisar português"}</button>
      {facts && <button type="button" className={btn.outline} disabled={disabled || busy} onClick={() => void ask(true)}>Melhorar legenda</button>}
    </div>
    {facts && <p className="text-xs text-muted">A melhoria organiza os dados preenchidos e preserva a descrição. Confira a ficha antes de pedir.</p>}
    <p className="text-xs text-muted">Aplique para alterar apenas este formulário. Use Salvar para gravar. Não informe dados pessoais.</p>
    {message && <p role="status" className="break-words text-sm text-cream">{message}</p>}
    {proposal && !current && <p role="status" className="text-sm text-muted">O texto ou a ficha mudou. Resultado descartado; consulte novamente.</p>}
    {current && <div className="space-y-3 border border-white/15 p-3 text-sm">
      <p className="font-display font-semibold">Original × proposta</p>
      {current.suggestions.map((item, index) => <div key={index} className="space-y-1 break-words border-b border-white/10 pb-2">
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={selected.includes(index)} onChange={event => setSelected(items => event.target.checked ? [...items, index] : items.filter(i => i !== index))} />
          <span>{item.category}: {item.reason}</span>
        </label>
        <p><del className="text-red-300">{item.original}</del>{" → "}<ins className="text-cream">{item.replacement}</ins></p>
      </div>)}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><p className="font-semibold">Original</p><p className="whitespace-pre-wrap break-words">{value}</p></div>
        <div><p className="font-semibold">Proposta</p><p className="whitespace-pre-wrap break-words">{current.caption ? current.text : applySuggestions(value, current.suggestions.filter((_, i) => selected.includes(i)))}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.primary} disabled={disabled || (!current.caption && !selected.length)} onClick={() => {
          if (latest.current.snapshot !== current.snapshot || latest.current.revision !== current.revision) return;
          onApply(current.caption ? current.text : applySuggestions(value, current.suggestions.filter((_, i) => selected.includes(i))));
          setProposal(null); setMessage("Sugestões aplicadas ao formulário. Confira e salve quando estiver pronto.");
        }}>Aplicar sugestões selecionadas</button>
        <button type="button" className={btn.outline} onClick={() => { setProposal(null); setMessage("Sugestões descartadas."); }}>Descartar</button>
      </div>
    </div>}
  </div>;
}
