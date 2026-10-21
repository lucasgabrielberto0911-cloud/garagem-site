"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUnsavedChangesWarning } from "@/components/admin/useUnsavedChangesWarning";
import { Field, btn, inputClass } from "@/components/admin/ui";
import { adminDate, localDateInput, localTimeInput } from "@/lib/admin-date";
import {
  TIMELINE_KIND_STYLE,
  type LeadTimelineItem,
} from "@/lib/lead-timeline";

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
  const [time, setTime] = useState(
    nextActionAt ? localTimeInput(new Date(nextActionAt)) : "",
  );
  const [history, setHistory] = useState<
    Array<{ id: string; note: string; createdAt: string }>
  >([]);
  const [timeline, setTimeline] = useState<LeadTimelineItem[]>([]);
  const [partial, setPartial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedChangesWarning(dirty);
  async function load() {
    setLoading(true);
    setError("");
    setPartial(false);
    try {
      const response = await fetch(`/api/admin/leads/${id}/activity`);
      if (!response.ok) throw new Error("read");
      const data = await response.json();
      setPartial(data.partial === true);
      setHistory(data.activities ?? []);
      setTimeline(Array.isArray(data.timeline) ? data.timeline : []);
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
        Atendimento e linha do tempo{nextAction ? ` · ${nextAction}` : ""}
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
                body: JSON.stringify({ note, nextAction: action, date, time }),
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
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Dia para retomar">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Hora para retomar" hint="Opcional">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <button type="submit" className={`${btn.outline} w-full sm:w-auto`}>
              {pending ? "Salvando…" : "Registrar atendimento"}
            </button>
          </fieldset>
        </form>
        <div className="space-y-2 border-t border-white/10 pt-3">
          <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted">
            Linha do tempo do lead
          </p>
          {partial && !loading && !error ? (
            <p role="status" className="text-sm text-brand-yellow">
              Histórico parcial: alguns contatos ou vendas não puderam ser carregados.{" "}
              <button type="button" className="underline" onClick={load}>
                Tentar novamente
              </button>
            </p>
          ) : null}
          {loading ? (
            <p role="status" className="text-sm text-muted">
              Carregando histórico…
            </p>
          ) : error ? (
            <button type="button" className={btn.outline} onClick={load}>
              {error} Tentar novamente
            </button>
          ) : timeline.length ? (
            <ol className="space-y-3">
              {timeline.map((item) => (
                <li key={item.id} className="border-l border-white/15 pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TIMELINE_KIND_STYLE[item.kind]}`}
                    >
                      {item.badge}
                    </span>
                    <time dateTime={item.at} className="text-xs text-muted">
                      {adminDate(new Date(item.at), {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-cream">
                    {item.title}
                  </p>
                  {item.detail ? (
                    <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
                  ) : null}
                </li>
              ))}
            </ol>
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
            <p className="text-sm text-muted">
              Nenhum contato registrado ainda.
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
