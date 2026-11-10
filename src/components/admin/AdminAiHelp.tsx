"use client";

import { useState } from "react";
import { requestAdminAi } from "./AdminAiReview";
import { btn, inputClass } from "./ui";

export function AdminAiHelp() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <form className="max-w-2xl space-y-4" onSubmit={async event => {
    event.preventDefault();
    if (busy || !question.trim()) return;
    setBusy(true); setAnswer(""); setError("");
    try { setAnswer((await requestAdminAi("ajuda-painel", { question })).answer); }
    catch (error) { setError(error instanceof Error && !["TimeoutError", "TypeError"].includes(error.name) ? error.message : "IA indisponível no momento. O restante do painel continua funcionando."); }
    finally { setBusy(false); }
  }}>
    <p className="text-sm text-muted">Pergunte como usar as telas. A ajuda consulta um guia do painel, sem acessar cadastros ou executar ações. Não informe nomes de clientes, documentos ou senhas.</p>
    <label htmlFor="admin-help-question" className="block font-display text-sm">Sua dúvida sobre o painel</label>
    <textarea id="admin-help-question" className={`${inputClass} min-h-32`} value={question} maxLength={1500} onChange={event => setQuestion(event.target.value)} placeholder="Como cadastrar um veículo e conferir a legenda?" />
    <button type="submit" className={btn.primary} disabled={busy || !question.trim()}>{busy ? "Consultando IA…" : "Perguntar"}</button>
    {error && <p role="status" className="text-sm">{error}</p>}
    {answer && <div role="status" className="whitespace-pre-wrap break-words border border-white/15 p-4 text-sm leading-relaxed">{answer}</div>}
  </form>;
}
