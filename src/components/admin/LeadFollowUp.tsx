"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUnsavedChangesWarning } from "@/components/admin/useUnsavedChangesWarning";
import { Field, btn, inputClass } from "@/components/admin/ui";
import { adminDate, localDateInput } from "@/lib/admin-date";
export function LeadFollowUp({
  id,
  nextAction,
  nextActionAt,
}: {
  id: string;
  nextAction: string | null;
  nextActionAt: Date | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [action, setAction] = useState(nextAction || "");
  const [date, setDate] = useState(
    nextActionAt ? localDateInput(new Date(nextActionAt)) : "",
  );
  const [history, setHistory] = useState<
    Array<{ id: string; note: string; createdAt: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedChangesWarning(dirty);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/leads/${id}/activity`);
      if (!response.ok) throw new Error("read");
      const data = await response.json();
      setHistory(data.activities);
    } catch {
      setError("Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <details
      className="border-t border-white/10"
      onToggle={(event) => {
        if (event.currentTarget.open) void load();
      }}
    >
      <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold">
        Atendimento e próxima ação{nextAction ? ` · ${nextAction}` : ""}
      </summary>
      <div className="space-y-4 px-4 pb-4">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending) return;
            setPending(true);
            try {
              const response = await fetch(`/api/admin/leads/${id}/activity`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note, nextAction: action, date }),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error);
              setNote("");
              setDirty(false);
              toast.success(
                "Atendimento registrado. Nenhuma mensagem foi enviada.",
              );
              await load();
              router.refresh();
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Falha ao salvar.",
              );
            } finally {
              setPending(false);
            }
          }}
          onChange={() => setDirty(true)}
        >
          <fieldset disabled={pending} className="min-w-0 space-y-3">
            <Field label="Registro de contato" required>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                required
                className={inputClass}
                placeholder="O que foi conversado ou combinado?"
              />
            </Field>
            <Field label="Próxima ação">
              <input
                value={action}
                onChange={(e) => setAction(e.target.value)}
                maxLength={300}
                className={inputClass}
                placeholder="Ex.: combinar visita"
              />
            </Field>
            <Field label="Dia para retomar">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <button type="submit" className={`${btn.outline} w-full sm:w-auto`}>
              {pending ? "Salvando…" : "Registrar atendimento"}
            </button>
          </fieldset>
        </form>
        {loading ? (
          <p role="status" className="text-sm text-muted">
            Carregando histórico…
          </p>
        ) : error ? (
          <button type="button" className={btn.outline} onClick={load}>
            {error} Tentar novamente
          </button>
        ) : history.length ? (
          <ol className="space-y-3">
            {history.map((item) => (
              <li key={item.id} className="border-l border-white/15 pl-3">
                <p className="text-xs text-muted">
                  {adminDate(new Date(item.createdAt), {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-cream">
                  {item.note.replace(/^\[funil:[^\]]+\]\s*/, "")}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">Nenhum contato registrado ainda.</p>
        )}
      </div>
    </details>
  );
}
