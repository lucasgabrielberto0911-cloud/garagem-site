"use client";

import { submissionId } from "@/lib/submission-id";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelPromissory,
  createPromissoryNotes,
  markPromissoryPaid,
  reversePromissoryPayment,
  type CreatedPromissorySummary,
} from "@/app/admin/promissorias/actions";
import { SearchSelect } from "@/components/admin/SearchSelect";
import { IconCash, IconCheck, IconDownload, IconPlus, IconPrinter } from "@/components/admin/icons";
import { Badge, Card, EmptyState, Field, btn, inputClass, mobileActionCell, type BadgeTone } from "@/components/admin/ui";
import { confirmDiscard, useConfirmDialog } from "@/components/admin/useConfirmDialog";
import { useUnsavedChangesWarning } from "@/components/admin/useUnsavedChangesWarning";
import { adminMutation } from "@/lib/admin-mutation";
import { focusAdminError } from "@/lib/admin-form-focus";
import { formatAdminMoney, moneyTyping, parseMoneyBR } from "@/lib/admin-money";
import { formatCpfBR, formatPhoneBR } from "@/lib/format";
import {
  PROMISSORY_DEFAULT_PLACE,
  PROMISSORY_DUE_FILTERS,
  PROMISSORY_MAX_INSTALLMENTS,
  PROMISSORY_STATUS_LABEL,
  addDaysCivil,
  canCancelPromissory,
  canMarkPromissoryPaid,
  describePromissoryDue,
  formatCivilDate,
  nextMonthDayCivil,
  parsePromissoryStatus,
  promissoryInstallmentDates,
  type PromissoryDueFilter,
  type PromissoryFilter,
  type PromissoryFormFields,
} from "@/lib/promissory-notes";

export type PromissoryRow = {
  id: string;
  number: number;
  issuerName: string;
  issuerCpf: string;
  issuerPhone: string;
  amount: number;
  /** Datas civis AAAA-MM-DD. */
  dueDate: string;
  issuedAt: string;
  installmentNo: number;
  installmentCount: number;
  status: string;
  paidAt: string | null;
  overdue: boolean;
  notes: string | null;
  openIssuerCount: number;
};

type CustomerOption = { id: string; label: string; name: string; phone: string; cpf: string | null; rg: string | null; address: string | null };

const STATUS_TONE: Record<string, BadgeTone> = { emitida: "info", vinculada: "info", paga: "success", cancelada: "neutral" };
const QUICK_COUNTS = [1, 2, 3, 6, 12] as const;

async function searchCustomers(q: string, signal?: AbortSignal): Promise<CustomerOption[]> {
  const response = await fetch(`/api/admin/clientes?q=${encodeURIComponent(q)}&take=20`, { signal });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.customers ?? []).map((item: CustomerOption) => ({ ...item, label: `${item.name} · ${formatPhoneBR(item.phone)}` }));
}

function emptyForm(today: string): PromissoryFormFields {
  return {
    customerId: "",
    name: "",
    cpf: "",
    rg: "",
    birthDate: "",
    phone: "",
    address: "",
    amount: "",
    count: "1",
    firstDueDate: "",
    issuedAt: today,
    issuePlace: PROMISSORY_DEFAULT_PLACE,
    paymentPlace: PROMISSORY_DEFAULT_PLACE,
    notes: "",
  };
}

function installmentPreview(form: PromissoryFormFields) {
  const amount = parseMoneyBR(form.amount);
  const count = Number(form.count);
  if (!amount || amount <= 0 || !Number.isInteger(count) || count < 1 || count > PROMISSORY_MAX_INSTALLMENTS || !form.firstDueDate) return null;
  try {
    const dates = promissoryInstallmentDates(form.firstDueDate, count);
    const total = formatAdminMoney(Math.round(amount * count * 100) / 100);
    const summary = `${count} nota${count > 1 ? "s" : ""} de ${formatAdminMoney(amount)} · total ${total} · ${formatCivilDate(dates[0])}${count > 1 ? ` a ${formatCivilDate(dates[count - 1])}` : ""}`;
    const items = dates.map((date, idx) => ({
      no: idx + 1,
      count,
      date: formatCivilDate(date),
      amount: formatAdminMoney(amount),
    }));
    return { summary, items };
  } catch {
    return null;
  }
}

function emptyStateText(filter: PromissoryFilter, due: PromissoryDueFilter, query: string) {
  if (query) {
    return {
      title: "Nenhuma promissória encontrada",
      description: `Nenhum resultado para "${query}". Confira o número da nota, parte do nome, CPF ou telefone.`,
    };
  }
  if (due === "vencidas") {
    return {
      title: "Nenhuma promissória vencida",
      description: "Todas as notas promissórias em aberto estão dentro do prazo de vencimento.",
    };
  }
  if (due === "hoje") {
    return {
      title: "Nenhuma promissória vence hoje",
      description: "Não há notas em aberto com vencimento para a data de hoje.",
    };
  }
  if (due === "7dias") {
    return {
      title: "Nenhuma promissória nos próximos 7 dias",
      description: "Não há notas em aberto vencendo nos próximos 7 dias.",
    };
  }
  if (due === "30dias") {
    return {
      title: "Nenhuma promissória nos próximos 30 dias",
      description: "Não há notas em aberto vencendo nos próximos 30 dias.",
    };
  }
  if (filter === "pagas") {
    return {
      title: "Nenhuma promissória marcada como paga",
      description: "Quando uma nota em aberto receber baixa, ela aparecerá aqui com a data de quitação.",
    };
  }
  if (filter === "canceladas") {
    return {
      title: "Nenhuma promissória cancelada",
      description: "Notas canceladas ficam arquivadas neste filtro e não contam no valor a receber.",
    };
  }
  return {
    title: "Nenhuma promissória em aberto",
    description: "Emita uma nota avulsa ou várias parcelas mensais para o cliente assinar e acompanhe os vencimentos aqui.",
  };
}

export function PromissoryManager({
  notes,
  today,
  filter,
  due = "todos",
  query,
  page,
  pageSize,
  total,
}: {
  notes: PromissoryRow[];
  today: string;
  filter: PromissoryFilter;
  due?: PromissoryDueFilter;
  query: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const [confirmAction, confirmDialog] = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<PromissoryFormFields | null>(null);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [reversal, setReversal] = useState<PromissoryRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [term, setTerm] = useState(query);
  const [recentBatch, setRecentBatch] = useState<{ issuerName: string; notes: CreatedPromissorySummary[] } | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useUnsavedChangesWarning(dirty && Boolean(form));

  function href(next: { status?: PromissoryFilter; vencimento?: PromissoryDueFilter; q?: string; page?: number }) {
    const params = new URLSearchParams();
    const status = next.status ?? filter;
    const nextDue = next.vencimento ?? due;
    const q = next.q ?? query;
    if (status !== "abertas") params.set("status", status);
    if (nextDue !== "todos" && (status === "abertas" || status === "todas")) {
      params.set("vencimento", nextDue);
    }
    if (q) params.set("q", q);
    if ((next.page ?? 1) > 1) params.set("page", String(next.page));
    const text = params.toString();
    return text ? `/admin/promissorias?${text}` : "/admin/promissorias";
  }

  function update<K extends keyof PromissoryFormFields>(key: K, value: PromissoryFormFields[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => {
      if (!current[key] && !current.form) return current;
      const next = { ...current };
      delete next[key];
      delete next.form;
      return next;
    });
    setDirty(true);
  }

  function pickCustomer(item: CustomerOption | null) {
    setCustomer(item);
    if (!item) return update("customerId", "");
    setForm((current) =>
      current && {
        ...current,
        customerId: item.id,
        name: item.name,
        phone: formatPhoneBR(item.phone),
        cpf: item.cpf ? formatCpfBR(item.cpf) : "",
        rg: item.rg ?? "",
        address: item.address ?? "",
        birthDate: "",
      },
    );
    setErrors({});
    setDirty(true);
  }

  function openNewForm() {
    setErrors({});
    setCustomer(null);
    setDirty(false);
    setForm(emptyForm(today));
  }

  async function closeForm() {
    if (dirty && !(await confirmDiscard(confirmAction, "desta nota"))) return;
    setDirty(false);
    setForm(null);
    setCustomer(null);
    setErrors({});
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    startTransition(async () => {
      const result = await adminMutation(async () => {
        const clear = await submissionId(formData, "promissoria");
        const result = await createPromissoryNotes(formData);
        if (result.ok) clear();
        return result;
      });
      setErrors(result.fieldErrors ?? {});
      const first = Object.keys(result.fieldErrors ?? {})[0];
      if (first) focusAdminError(formElement, first);
      if (result.ok) {
        toast.success(result.message);
        if (result.createdNotes?.length) {
          setRecentBatch({
            issuerName: result.issuerName ?? form?.name ?? "Emitente",
            notes: result.createdNotes,
          });
        }
        setDirty(false);
        setForm(null);
        setCustomer(null);
        router.refresh();
      } else toast.error(result.message);
    });
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await adminMutation(action);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.message);
    });
  }

  async function pay(note: PromissoryRow) {
    const ok = await confirmAction({
      title: `Marcar nota nº ${note.number} como paga`,
      description: `${note.issuerName} · ${formatAdminMoney(note.amount)} (vence em ${formatCivilDate(note.dueDate)}). Isso gera um aviso na agenda para devolver a via original quitada.`,
      confirmLabel: "Marcar como paga",
    });
    if (ok) run(() => markPromissoryPaid(note.id));
  }

  async function cancel(note: PromissoryRow) {
    const ok = await confirmAction({
      title: `Cancelar nota nº ${note.number}`,
      description: "A nota continua na lista como cancelada, mas deixa de contar como a receber e não poderá ser impressa.",
      confirmLabel: "Cancelar nota",
      danger: true,
    });
    if (ok) run(() => cancelPromissory(note.id));
  }

  const preview = form ? installmentPreview(form) : null;
  const baseIssuedAt = form?.issuedAt && /^\d{4}-\d{2}-\d{2}$/.test(form.issuedAt) ? form.issuedAt : today;
  const errorCount = Object.keys(errors).filter((key) => key !== "form").length;
  const hasActiveFilters = Boolean(query) || filter !== "abertas" || due !== "todos";
  const activeDueLabel = due !== "todos" ? PROMISSORY_DUE_FILTERS.find((item) => item.value === due)?.label : null;

  const text = (
    name: keyof PromissoryFormFields,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    extra?: { required?: boolean; hint?: string; className?: string },
  ) => (
    <Field label={label} required={extra?.required} error={errors[name]} hint={extra?.hint} className={extra?.className}>
      <input name={name} value={form?.[name] ?? ""} onChange={(event) => update(name, event.target.value)} className={inputClass} {...props} />
    </Field>
  );

  const emptyInfo = emptyStateText(filter, due, query);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p>Selecione até 60 notas para imprimir um lote, inclusive entre páginas.</p>
        {selectedIds.length > 0 && <><a className={btn.outline} target="_blank" rel="noopener noreferrer" href={`/api/admin/promissorias/${selectedIds.join(",")}?inline=1`}>Imprimir selecionadas ({selectedIds.length})</a><button type="button" className={btn.ghost} onClick={() => setSelectedIds([])}>Limpar seleção</button></>}
      </div>
      {reversal && <form aria-label="Retificar baixa" className="space-y-3 rounded border border-line p-4" onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await adminMutation(() => reversePromissoryPayment(reversal.id, reason));
          if (result.ok) { setReversal(null); toast.success(result.message); router.refresh(); }
          else toast.error(result.message);
        });
      }}>
        <h2 className="font-display">Retificar baixa da nota nº {reversal.number}</h2>
        <label className="block text-sm">Motivo da retificação<textarea className={inputClass} minLength={10} maxLength={500} required value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <p className="text-sm text-muted">A nota voltará aos recebíveis em aberto. A baixa original e o motivo serão preservados na auditoria.</p>
        <button disabled={isPending} className={btn.primary}>Confirmar retificação</button>{" "}
        <button type="button" disabled={isPending} className={btn.outline} onClick={() => setReversal(null)}>Voltar</button>
      </form>}
      {confirmDialog}

      {recentBatch ? (
        <section
          aria-label="Notas recém-emitidas"
          className="flex flex-col justify-between gap-3 border border-emerald-400/40 bg-emerald-400/10 p-4 sm:flex-row sm:items-center"
        >
          <div className="min-w-0 space-y-1">
            <p className="font-display text-sm font-semibold text-cream">
              {recentBatch.notes.length === 1
                ? `Nota nº ${recentBatch.notes[0].number} emitida para ${recentBatch.issuerName}`
                : `${recentBatch.notes.length} notas emitidas para ${recentBatch.issuerName} (nº ${recentBatch.notes.map((n) => n.number).join(", ")})`}
            </p>
            <p className="text-xs text-muted">
              {recentBatch.notes.length === 1
                ? `Vencimento em ${formatCivilDate(recentBatch.notes[0].dueDate)} · ${formatAdminMoney(recentBatch.notes[0].amount)}`
                : `Parcelas de ${formatAdminMoney(recentBatch.notes[0].amount)} · ${formatCivilDate(recentBatch.notes[0].dueDate)} a ${formatCivilDate(recentBatch.notes[recentBatch.notes.length - 1].dueDate)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/admin/promissorias/${encodeURIComponent(recentBatch.notes.map((n) => n.id).join(","))}?inline=1`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btn.primary} flex-1 sm:flex-none`}
            >
              <IconPrinter className="h-4 w-4" />
              {recentBatch.notes.length > 1 ? `Imprimir todas (${recentBatch.notes.length})` : "Imprimir PDF"}
            </a>
            <a
              href={`/api/admin/promissorias/${encodeURIComponent(recentBatch.notes.map((n) => n.id).join(","))}`}
              className={`${btn.outline} flex-1 sm:flex-none`}
            >
              <IconDownload className="h-4 w-4" />
              {recentBatch.notes.length > 1 ? "Baixar lote PDF" : "Baixar PDF"}
            </a>
            <button type="button" onClick={() => setRecentBatch(null)} className={btn.ghost}>
              Fechar
            </button>
          </div>
        </section>
      ) : null}

      {form ? (
        <Card
          title="Nova promissória"
          action={
            <button type="button" onClick={closeForm} className={btn.ghost}>
              Fechar
            </button>
          }
        >
          <form onSubmit={submit} className="space-y-5" noValidate aria-label="Nova promissória">
            <fieldset disabled={isPending} className="min-w-0 space-y-5">
              <input type="hidden" name="customerId" value={form.customerId} />
              <section className="space-y-3" aria-label="Emitente">
                <h3 className="font-display text-sm font-semibold text-cream">1. Emitente (quem assina a nota)</h3>
                <Field label="Buscar cliente cadastrado" hint="Opcional: preenche nome, CPF, RG, telefone e endereço automaticamente.">
                  <SearchSelect<CustomerOption>
                    name="customerSearch"
                    value={form.customerId}
                    selectedLabel={customer?.label ?? ""}
                    onChange={(_, item) => pickCustomer(item)}
                    loadOptions={searchCustomers}
                    placeholder="Nome ou telefone"
                    noneOption={{ id: "", label: "Digitar à mão" }}
                  />
                </Field>
                {customer ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted">
                    <span>
                      Dados carregados de <strong className="text-cream">{customer.name}</strong>. Confira o endereço e preencha a data de nascimento.
                    </span>
                    <button type="button" onClick={() => pickCustomer(null)} className="font-semibold text-cream underline hover:text-brand">
                      Desvincular cliente
                    </button>
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  {text("name", "Nome completo", { autoComplete: "off" }, { required: true })}
                  {text("cpf", "CPF", { inputMode: "numeric", placeholder: "000.000.000-00", onChange: (event) => update("cpf", formatCpfBR(event.target.value)) }, { required: true })}
                  {text("rg", "RG / órgão emissor", {}, { hint: "Opcional." })}
                  {text("birthDate", "Data de nascimento", { type: "date", max: today }, { required: true })}
                  {text("phone", "Telefone / WhatsApp", { inputMode: "tel", placeholder: "(00) 00000-0000", onChange: (event) => update("phone", formatPhoneBR(event.target.value)) }, { required: true })}
                  {text("address", "Endereço", { placeholder: "Rua, número, bairro, cidade/UF" }, { required: true })}
                </div>
              </section>

              <section className="space-y-3" aria-label="Valor e vencimento">
                <h3 className="font-display text-sm font-semibold text-cream">2. Valor e parcelas mensais</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {text("amount", "Valor de cada nota (R$)", { inputMode: "decimal", placeholder: "0,00", onChange: (event) => update("amount", moneyTyping(event.target.value)) }, { required: true })}

                  <div className="space-y-1.5">
                    {text("count", "Quantidade de notas", { type: "number", min: 1, max: PROMISSORY_MAX_INSTALLMENTS, inputMode: "numeric" }, { required: true, hint: "Várias notas saem com vencimento mensal." })}
                    <div className="flex flex-wrap items-center gap-1" aria-label="Atalhos de parcelas">
                      {QUICK_COUNTS.map((n) => {
                        const active = Number(form.count) === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => update("count", String(n))}
                            aria-label={`Parcelar em ${n}x`}
                            className={`min-h-8 border px-2.5 text-xs font-semibold transition touch-manipulation ${
                              active ? "border-brand/50 bg-brand/15 text-cream" : "border-white/10 text-muted hover:text-cream"
                            }`}
                          >
                            {n}x
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {text("firstDueDate", "Primeiro vencimento", { type: "date", min: form.issuedAt }, { required: true })}
                    <div className="flex flex-wrap items-center gap-1" aria-label="Atalhos de primeiro vencimento">
                      {[
                        { label: "+30 dias", date: addDaysCivil(baseIssuedAt, 30) },
                        { label: "Dia 5", date: nextMonthDayCivil(baseIssuedAt, 5) },
                        { label: "Dia 10", date: nextMonthDayCivil(baseIssuedAt, 10) },
                        { label: "Dia 15", date: nextMonthDayCivil(baseIssuedAt, 15) },
                      ].map((shortcut) => {
                        const active = form.firstDueDate === shortcut.date;
                        return (
                          <button
                            key={shortcut.label}
                            type="button"
                            onClick={() => update("firstDueDate", shortcut.date)}
                            className={`min-h-8 border px-2 text-xs font-medium transition touch-manipulation ${
                              active ? "border-brand/50 bg-brand/15 text-cream" : "border-white/10 text-muted hover:text-cream"
                            }`}
                          >
                            {shortcut.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {text("issuedAt", "Data de emissão", { type: "date" }, { required: true })}
                </div>

                {preview ? (
                  <div className="space-y-2 border border-white/10 bg-white/[0.02] p-3">
                    <p role="status" className="text-sm font-medium text-cream">
                      {preview.summary}
                    </p>
                    {preview.items.length > 1 ? (
                      <ol className="grid grid-cols-2 gap-1.5 text-xs text-muted sm:grid-cols-3 lg:grid-cols-4" aria-label="Cronograma de parcelas">
                        {preview.items.slice(0, 12).map((item) => (
                          <li key={item.no} className="border border-white/10 bg-ink/60 px-2.5 py-1.5 tabular-nums">
                            <span className="font-semibold text-cream">Parcela {item.no}/{item.count}</span> · {item.date} · {item.amount}
                          </li>
                        ))}
                        {preview.items.length > 12 ? (
                          <li className="flex items-center px-2.5 py-1.5 text-muted">
                            +{preview.items.length - 12} parcela(s) até {preview.items[preview.items.length - 1].date}
                          </li>
                        ) : null}
                      </ol>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  {text("issuePlace", "Local de emissão")}
                  {text("paymentPlace", "Praça de pagamento", {}, { hint: "Padrão: Linhares/ES." })}
                </div>
                <Field label="Observações internas" hint="Não saem no PDF.">
                  <textarea
                    name="notes"
                    rows={2}
                    maxLength={500}
                    value={form.notes}
                    onChange={(event) => update("notes", event.target.value)}
                    className={`${inputClass} resize-y`}
                  />
                </Field>
              </section>

              {errors.form ? (
                <p role="alert" className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {errors.form}
                </p>
              ) : errorCount > 0 ? (
                <p role="alert" className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  Confira {errorCount === 1 ? "o campo destacado" : `os ${errorCount} campos destacados`} acima antes de emitir.
                </p>
              ) : null}

              <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:flex-wrap">
                <button type="submit" className={`${btn.primary} w-full sm:w-auto`}>
                  {isPending ? "Emitindo..." : Number(form.count) > 1 ? "Emitir notas" : "Emitir nota"}
                </button>
                <button type="button" onClick={closeForm} className={`${btn.outline} w-full sm:w-auto`}>
                  Cancelar
                </button>
              </div>
            </fieldset>
          </form>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(() => router.push(href({ q: term.trim(), page: 1 })));
              }}
              className="flex min-w-0 flex-1 gap-2 sm:max-w-md"
            >
              <input
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                aria-label="Buscar promissória"
                placeholder="Número, nome, CPF ou telefone"
                className={inputClass}
              />
              <button type="submit" className={btn.outline}>
                Buscar
              </button>
            </form>
            <button type="button" onClick={openNewForm} className={`${btn.primary} w-full sm:w-auto`}>
              <IconPlus className="h-4 w-4" />
              Nova promissória
            </button>
            <span className="text-xs text-muted sm:ml-auto" role="status">
              {total} nota(s){activeDueLabel ? ` · ${activeDueLabel.toLowerCase()}` : ""}
            </span>
          </div>
          {query || due !== "todos" ? (
            <div className="flex flex-wrap items-center gap-2">
              {query ? (
                <Link href={href({ q: "", page: 1 })} className={btn.ghost}>
                  Limpar busca
                </Link>
              ) : null}
              {due !== "todos" ? (
                <Link href={href({ vencimento: "todos", page: 1 })} className={btn.ghost}>
                  Mostrar todos os vencimentos
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState
          icon={<IconCash className="h-10 w-10" />}
          title={emptyInfo.title}
          description={emptyInfo.description}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters ? (
                <Link href="/admin/promissorias" className={btn.outline}>
                  Ver todas em aberto
                </Link>
              ) : null}
              {!form ? (
                <button type="button" onClick={openNewForm} className={btn.primary}>
                  <IconPlus className="h-4 w-4" />
                  Emitir promissória
                </button>
              ) : null}
            </div>
          }
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" aria-label="Promissórias">
          {notes.map((note) => {
            const status = parsePromissoryStatus(note.status);
            const dueAlert = describePromissoryDue(note.dueDate, today, note.status);
            const canPay = canMarkPromissoryPaid(note.status);
            const canCancel = canCancelPromissory(note.status);
            const actionCount = 2 + (note.status === "paga" ? 1 : 0) + (canPay ? 1 : 0) + (canCancel ? 1 : 0);
            const actionGridClass =
              actionCount === 4
                ? "grid-cols-2 sm:grid-cols-4"
                : actionCount === 3
                  ? "grid-cols-2 sm:grid-cols-3"
                  : "grid-cols-2";

            return (
              <li key={note.id} data-testid="promissoria" className="flex flex-col justify-between overflow-hidden border border-white/10 bg-ink/50">
                <div className="space-y-2 p-4 pb-3">
                  {note.status !== "cancelada" && <label className="flex min-h-11 items-center gap-2 text-xs">
                    <input type="checkbox" checked={selectedIds.includes(note.id)} disabled={!selectedIds.includes(note.id) && selectedIds.length >= 60} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, note.id] : ids.filter((id) => id !== note.id))} />
                    Selecionar nota {note.number}
                  </label>}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold text-cream">
                        Nota nº {note.number}
                        {note.installmentCount > 1 ? ` · parcela ${note.installmentNo}/${note.installmentCount}` : ""}
                      </p>
                      <p className="break-words text-sm text-cream">{note.issuerName}</p>
                      <p className="text-xs text-muted">
                        CPF {note.issuerCpf} · {formatPhoneBR(note.issuerPhone)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={STATUS_TONE[note.status] ?? "neutral"}>{status ? PROMISSORY_STATUS_LABEL[status] : note.status}</Badge>
                      {note.overdue ? (
                        <Badge tone="warning">Vencida</Badge>
                      ) : dueAlert ? (
                        <Badge tone={dueAlert.tone}>{dueAlert.badge}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="font-display text-lg font-bold tabular-nums text-cream">{formatAdminMoney(note.amount)}</p>
                  <p className="text-xs text-muted">
                    Vence em {formatCivilDate(note.dueDate)}
                    {dueAlert ? ` (${dueAlert.label.toLowerCase()})` : ""} · emitida em {formatCivilDate(note.issuedAt)}
                    {note.paidAt
                      ? ` · paga em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(note.paidAt))}`
                      : ""}
                  </p>
                  {note.notes ? <p className="line-clamp-2 text-xs italic text-muted">{note.notes}</p> : null}
                  {canPay && note.openIssuerCount > 1 ? (
                    <div className="pt-1">
                      <a
                        href={`/api/admin/promissorias/abertas?cpf=${encodeURIComponent(note.issuerCpf)}&inline=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-cream/80 underline decoration-white/30 underline-offset-2 hover:text-cream"
                      >
                        <IconPrinter className="h-3.5 w-3.5" />
                        Imprimir todas em aberto deste cliente ({note.openIssuerCount})
                      </a>
                    </div>
                  ) : null}
                </div>

                {note.status === "cancelada" ? (
                  <div className="border-t border-white/10 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted opacity-40">
                    PDF indisponível
                  </div>
                ) : (
                  <div className={`grid border-t border-white/10 ${actionGridClass}`}>
                    <a
                      href={`/api/admin/promissorias/${encodeURIComponent(note.id)}?inline=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={mobileActionCell}
                      aria-label={`Imprimir nota ${note.number}`}
                    >
                      <IconPrinter className="h-4 w-4" />
                      Imprimir
                    </a>
                    <a
                      href={`/api/admin/promissorias/${encodeURIComponent(note.id)}`}
                      className={`${mobileActionCell} border-l border-white/10`}
                      aria-label={`Baixar PDF da nota ${note.number}`}
                    >
                      <IconDownload className="h-4 w-4" />
                      PDF
                    </a>
                    {canPay ? (
                      <button
                        type="button"
                        onClick={() => pay(note)}
                        disabled={isPending}
                        className={`${mobileActionCell} ${actionCount === 3 ? "col-span-2 border-t border-white/10 sm:col-span-1 sm:border-t-0 sm:border-l" : "border-t border-white/10 sm:border-t-0 sm:border-l"}`}
                        aria-label={`Marcar nota ${note.number} como paga`}
                      >
                        <IconCheck className="h-4 w-4" />
                        Marcar paga
                      </button>
                    ) : null}
                    {note.status === "paga" && <button type="button" disabled={isPending} className={`${mobileActionCell} col-span-2 border-t border-white/10 sm:col-span-1`} onClick={() => { setReversal(note); setReason(""); }}>Retificar baixa</button>}
                    {canCancel ? (
                      <button
                        type="button"
                        onClick={() => cancel(note)}
                        disabled={isPending}
                        className={`${mobileActionCell} border-l border-t border-white/10 text-red-400 sm:border-t-0`}
                        aria-label={`Cancelar nota ${note.number}`}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm text-muted">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className={btn.outline}>
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span>
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={href({ page: page + 1 })} className={btn.outline}>
              Próxima
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
