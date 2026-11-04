"use client";

import { submissionId } from "@/lib/submission-id";

import { useEffect, useState } from "react";
import { availableSalePromissories } from "@/app/admin/vendas/actions";
import { createPromissoryNotes } from "@/app/admin/promissorias/actions";
import { btn, inputClass } from "./ui";
import type { Customer } from "./SaleFlowStages";
import type { ContractPaymentItem, ContractPromissoryNote } from "@/lib/admin-commercial";
import { adminMutation } from "@/lib/admin-mutation";
import { formatAdminMoney, moneyInput, moneySum, parseMoneyBR } from "@/lib/admin-money";
import { localDateInput } from "@/lib/admin-date";
import { formatCivilDate, PROMISSORY_DEFAULT_PLACE } from "@/lib/promissory-notes";

export function SalePromissoryPayment({ payment, customer, remaining, onChange, onBusyChange }: {
  payment: ContractPaymentItem; customer: Customer | null; remaining: number;
  onChange: (patch: Partial<ContractPaymentItem>) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [notes, setNotes] = useState<ContractPromissoryNote[]>([]);
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [issueAmount, setIssueAmount] = useState(remaining > 0 ? moneyInput(remaining) : "");
  const [issueCount, setIssueCount] = useState("1");
  const cpf = customer?.cpf ?? "";
  const selected = payment.notes ?? [];

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      availableSalePromissories(cpf, query).then((rows) => {
        if (current) { setNotes(rows); setError(""); }
      }).catch(() => { if (current) setError("Não foi possível buscar as notas. Tente atualizar a lista."); })
        .finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [cpf, query, version]);

  function select(rows: ContractPromissoryNote[]) {
    onChange({ noteIds: rows.map((note) => note.id), notes: rows, amount: moneySum(rows.map((note) => note.amount)) });
  }

  async function issue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (selected.length + Number(form.get("count")) > 60) {
      setError("Selecione no máximo 60 notas por venda. Reduza a quantidade a emitir ou remova notas selecionadas.");
      return;
    }
    form.set("customerId", customer?.id ?? "");
    for (const key of ["name", "cpf", "phone", "rg", "address"] as const) form.set(key, customer?.[key] ?? "");
    setBusy(true); onBusyChange(true); setError(""); setErrors({});
    try {
      const clearRequest = await submissionId(form, "promissoria");
      const response = await adminMutation(() => createPromissoryNotes(form));
      if (!response.ok) { setErrors(response.fieldErrors ?? {}); setError(response.message); return; }
      // Os IDs vêm da emissão, evitando selecionar notas antigas por engano.
      const rows = await availableSalePromissories(cpf, "", response.noteIds);
      const added = rows.filter((note) => response.noteIds?.includes(note.id));
      if (added.length !== response.noteIds?.length) {
        setNotice("Notas emitidas. Busque pelo número para selecioná-las.");
      } else {
        select([...selected, ...added]);
        setNotice(response.message);
      }
      setNotes(rows); setCreating(false); clearRequest();
    } catch {
      setError("Confira a lista antes de tentar emitir novamente: as notas podem ter sido salvas.");
    } finally { setBusy(false); onBusyChange(false); }
  }

  return (
    <section aria-label="Pagamento em promissórias" className="min-w-0 space-y-3 rounded border border-line p-3">
      <h3 className="font-semibold">Promissórias</h3>
      <p className="text-sm text-muted">Escolha notas livres do CPF do comprador. O valor entra na soma automaticamente.</p>
      {!cpf && <p role="alert">Preencha o CPF do comprador na etapa Cliente.</p>}
      <label className="block text-sm">Buscar pelo número da nota
        <input type="search" inputMode="numeric" className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <button type="button" className={btn.outline} disabled={busy} onClick={() => { select([]); setVersion((value) => value + 1); }}>Atualizar notas</button>
      {loading ? <p role="status">Buscando notas…</p> : <>
        {!notes.length && <p className="text-sm">Nenhuma nota livre encontrada. Você pode emitir abaixo.</p>}
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {notes.map((note) => <label key={note.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-line p-2 text-sm">
            <input type="checkbox" disabled={busy || (!selected.some((item) => item.id === note.id) && selected.length >= 60)} checked={selected.some((item) => item.id === note.id)} onChange={(event) => select(event.target.checked ? [...selected, note] : selected.filter((item) => item.id !== note.id))} />
            <span>Nota nº {note.number} · {formatAdminMoney(note.amount)}<br />Vencimento {formatCivilDate(note.dueDate)}</span>
          </label>)}
        </div>
        {notes.length === 100 && <p className="text-sm">Exibindo 100 notas. Busque pelo número para encontrar outras.</p>}
      </>}
      <p role="status">{selected.length} nota(s) selecionada(s) · {formatAdminMoney(payment.amount)}</p>
      <ul className="space-y-1 text-sm">{selected.map((note) => <li key={note.id}>
        Nº {note.number} · {formatAdminMoney(note.amount)} · {formatCivilDate(note.dueDate)}{" "}
        <button type="button" disabled={busy} className="min-h-11 underline" onClick={() => select(selected.filter((item) => item.id !== note.id))}>Remover nota {note.number}</button>
      </li>)}</ul>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {!creating ? <button type="button" className={btn.outline} disabled={!cpf || busy} onClick={() => setCreating(true)}>Emitir notas nesta venda</button> : <form onSubmit={issue} onChange={(event) => {
        if (!(event.target instanceof HTMLInputElement)) return;
        const name = event.target.name;
        setErrors((current) => { const next = { ...current }; delete next[name]; return next; });
        setError("");
      }} aria-label="Emitir notas nesta venda" className="space-y-3 border-t border-line pt-3" noValidate>
        <p className="text-sm">Emitente: {customer?.name}. As notas são emitidas agora e vinculadas ao concluir a venda. Se sair, continuam na aba Promissórias.</p>
        <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="text-sm">Data de nascimento<input name="birthDate" type="date" className={inputClass} /></label>
          <label className="text-sm">Valor de cada nota (R$)<input name="amount" inputMode="decimal" value={issueAmount} onChange={(event) => setIssueAmount(event.target.value)} className={inputClass} /></label>
          <label className="text-sm">Quantidade de notas<input name="count" type="number" min="1" max="60" value={issueCount} onChange={(event) => setIssueCount(event.target.value)} className={inputClass} /></label>
          <label className="text-sm">Primeiro vencimento<input name="firstDueDate" type="date" min={localDateInput()} className={inputClass} /></label>
          <label className="text-sm">Praça de pagamento<input name="paymentPlace" defaultValue={PROMISSORY_DEFAULT_PLACE} className={inputClass} /></label>
          <input name="issuedAt" type="hidden" value={localDateInput()} />
          <input name="issuePlace" type="hidden" value={PROMISSORY_DEFAULT_PLACE} />
        </fieldset>
        <p role="status" className="text-sm">Emissão: {issueCount || "0"} nota(s) de {formatAdminMoney(parseMoneyBR(issueAmount) ?? 0)} · total {formatAdminMoney((parseMoneyBR(issueAmount) ?? 0) * (Number(issueCount) || 0))}. Falta cobrir nesta venda: {formatAdminMoney(Math.max(remaining, 0))}.</p>
        <p className="text-sm text-muted">Vencimentos mensais a partir da primeira data.</p>
        {Object.entries(errors).map(([field, message]) => <p key={field} role="alert" className="text-sm text-red-400">{message}</p>)}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btn.primary} disabled={busy}>{busy ? "Emitindo…" : "Emitir e selecionar notas"}</button>
          <button type="button" className={btn.outline} disabled={busy} onClick={() => setCreating(false)}>Fechar emissão</button>
        </div>
      </form>}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
