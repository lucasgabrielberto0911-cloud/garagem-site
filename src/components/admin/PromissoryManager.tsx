"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelPromissory, createPromissoryNotes, markPromissoryPaid } from "@/app/admin/promissorias/actions";
import { SearchSelect } from "@/components/admin/SearchSelect";
import { IconCheck, IconDownload, IconPlus } from "@/components/admin/icons";
import { Badge, Card, EmptyState, Field, btn, inputClass, mobileActionCell, type BadgeTone } from "@/components/admin/ui";
import { confirmDiscard, useConfirmDialog } from "@/components/admin/useConfirmDialog";
import { useUnsavedChangesWarning } from "@/components/admin/useUnsavedChangesWarning";
import { adminMutation } from "@/lib/admin-mutation";
import { focusAdminError } from "@/lib/admin-form-focus";
import { formatAdminMoney, moneyTyping, parseMoneyBR } from "@/lib/admin-money";
import { formatCpfBR, formatPhoneBR } from "@/lib/format";
import {
  PROMISSORY_DEFAULT_PLACE, PROMISSORY_MAX_INSTALLMENTS, PROMISSORY_STATUS_LABEL, canCancelPromissory, canMarkPromissoryPaid,
  formatCivilDate, parsePromissoryStatus, promissoryInstallmentDates, type PromissoryFormFields,
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
};

type CustomerOption = { id: string; label: string; name: string; phone: string; cpf: string | null; rg: string | null; address: string | null };

const STATUS_TONE: Record<string, BadgeTone> = { emitida: "info", vinculada: "info", paga: "success", cancelada: "neutral" };

async function searchCustomers(q: string, signal?: AbortSignal): Promise<CustomerOption[]> {
  const response = await fetch(`/api/admin/clientes?q=${encodeURIComponent(q)}&take=20`, { signal });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.customers ?? []).map((item: CustomerOption) => ({ ...item, label: `${item.name} · ${formatPhoneBR(item.phone)}` }));
}

function emptyForm(today: string): PromissoryFormFields {
  return {
    customerId: "", name: "", cpf: "", rg: "", birthDate: "", phone: "", address: "", amount: "", count: "1",
    firstDueDate: "", issuedAt: today, issuePlace: PROMISSORY_DEFAULT_PLACE, paymentPlace: PROMISSORY_DEFAULT_PLACE, notes: "",
  };
}

function installmentSummary(form: PromissoryFormFields) {
  const amount = parseMoneyBR(form.amount);
  const count = Number(form.count);
  if (!amount || amount <= 0 || !Number.isInteger(count) || count < 1 || count > PROMISSORY_MAX_INSTALLMENTS || !form.firstDueDate) return null;
  try {
    const dates = promissoryInstallmentDates(form.firstDueDate, count);
    const total = formatAdminMoney(Math.round(amount * count * 100) / 100);
    return `${count} nota${count > 1 ? "s" : ""} de ${formatAdminMoney(amount)} · total ${total} · ${formatCivilDate(dates[0])}${count > 1 ? ` a ${formatCivilDate(dates[count - 1])}` : ""}`;
  } catch {
    return null;
  }
}

export function PromissoryManager({
  notes, today, filter, query, page, pageSize, total,
}: {
  notes: PromissoryRow[];
  today: string;
  filter: string;
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
  const [term, setTerm] = useState(query);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useUnsavedChangesWarning(dirty && Boolean(form));

  function href(next: { status?: string; q?: string; page?: number }) {
    const params = new URLSearchParams();
    const status = next.status ?? filter;
    const q = next.q ?? query;
    if (status !== "abertas") params.set("status", status);
    if (q) params.set("q", q);
    if ((next.page ?? 1) > 1) params.set("page", String(next.page));
    const text = params.toString();
    return text ? `/admin/promissorias?${text}` : "/admin/promissorias";
  }

  function update<K extends keyof PromissoryFormFields>(key: K, value: PromissoryFormFields[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setDirty(true);
  }

  function pickCustomer(item: CustomerOption | null) {
    setCustomer(item);
    if (!item) return update("customerId", "");
    setForm((current) => current && {
      ...current, customerId: item.id, name: item.name, phone: formatPhoneBR(item.phone), cpf: item.cpf ? formatCpfBR(item.cpf) : "",
      rg: item.rg ?? "", address: item.address ?? "", birthDate: "",
    });
    setDirty(true);
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
      const result = await adminMutation(() => createPromissoryNotes(formData));
      setErrors(result.fieldErrors ?? {});
      const first = Object.keys(result.fieldErrors ?? {})[0];
      if (first) focusAdminError(formElement, first);
      if (result.ok) {
        toast.success(result.message);
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
      description: `${note.issuerName} · ${formatAdminMoney(note.amount)}. Isso gera um aviso na agenda para devolver a via original.`,
      confirmLabel: "Marcar como paga",
    });
    if (ok) run(() => markPromissoryPaid(note.id));
  }

  async function cancel(note: PromissoryRow) {
    const ok = await confirmAction({
      title: `Cancelar nota nº ${note.number}`,
      description: "A nota continua na lista como cancelada, mas deixa de contar como a receber.",
      confirmLabel: "Cancelar nota",
      danger: true,
    });
    if (ok) run(() => cancelPromissory(note.id));
  }

  const summary = form ? installmentSummary(form) : null;
  const text = (name: keyof PromissoryFormFields, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, extra?: { required?: boolean; hint?: string; className?: string }) => (
    <Field label={label} required={extra?.required} error={errors[name]} hint={extra?.hint} className={extra?.className}>
      <input name={name} value={form![name]} onChange={(event) => update(name, event.target.value)} className={inputClass} {...props} />
    </Field>
  );

  return (
    <div className="space-y-5">
      {confirmDialog}
      {form ? (
        <Card title="Nova promissória">
          <form onSubmit={submit} className="space-y-5" noValidate aria-label="Nova promissória">
            <fieldset disabled={isPending} className="min-w-0 space-y-5">
              <input type="hidden" name="customerId" value={form.customerId} />
              <section className="space-y-3" aria-label="Emitente">
                <h3 className="font-display text-sm font-semibold text-cream">Emitente (quem assina a nota)</h3>
                <Field label="Buscar cliente cadastrado" hint="Opcional: preenche os campos abaixo. Você pode digitar à mão.">
                  <SearchSelect<CustomerOption> name="customerSearch" value={form.customerId} selectedLabel={customer?.label ?? ""} onChange={(_, item) => pickCustomer(item)} loadOptions={searchCustomers} placeholder="Nome ou telefone" noneOption={{ id: "", label: "Digitar à mão" }} />
                </Field>
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
                <h3 className="font-display text-sm font-semibold text-cream">Valor e vencimentos</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {text("amount", "Valor de cada nota (R$)", { inputMode: "decimal", placeholder: "0,00", onChange: (event) => update("amount", moneyTyping(event.target.value)) }, { required: true })}
                  {text("count", "Quantidade de notas", { type: "number", min: 1, max: PROMISSORY_MAX_INSTALLMENTS, inputMode: "numeric" }, { required: true, hint: "Várias notas saem com vencimento mensal." })}
                  {text("firstDueDate", "Primeiro vencimento", { type: "date", min: form.issuedAt }, { required: true })}
                  {text("issuedAt", "Data de emissão", { type: "date" }, { required: true })}
                </div>
                {summary ? <p role="status" className="text-sm text-muted">{summary}</p> : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  {text("issuePlace", "Local de emissão")}
                  {text("paymentPlace", "Praça de pagamento", {}, { hint: "Padrão: Linhares/ES." })}
                </div>
                <Field label="Observações internas" hint="Não saem no PDF.">
                  <textarea name="notes" rows={2} maxLength={500} value={form.notes} onChange={(event) => update("notes", event.target.value)} className={`${inputClass} resize-y`} />
                </Field>
              </section>
              {errors.form ? <p role="alert" className="text-sm text-red-400">{errors.form}</p> : null}
              <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                <button type="submit" className={btn.primary}>{isPending ? "Emitindo..." : Number(form.count) > 1 ? "Emitir notas" : "Emitir nota"}</button>
                <button type="button" onClick={closeForm} className={btn.outline}>Cancelar</button>
              </div>
            </fieldset>
          </form>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form role="search" onSubmit={(event) => { event.preventDefault(); startTransition(() => router.push(href({ q: term.trim(), page: 1 }))); }} className="flex min-w-0 flex-1 gap-2 sm:max-w-sm">
              <input type="search" value={term} onChange={(event) => setTerm(event.target.value)} aria-label="Buscar promissória" placeholder="Número, nome, CPF ou telefone" className={inputClass} />
              <button type="submit" className={btn.outline}>Buscar</button>
            </form>
            <button type="button" onClick={() => { setErrors({}); setForm(emptyForm(today)); }} className={`${btn.primary} w-full sm:w-auto`}>
              <IconPlus className="h-4 w-4" />Nova promissória
            </button>
            <span className="text-xs text-muted" role="status">{total} nota(s)</span>
          </div>
          {query ? <Link href={href({ q: "" })} className={btn.ghost}>Limpar busca</Link> : null}
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState
          title={query ? "Nenhuma promissória encontrada" : filter === "abertas" ? "Nenhuma promissória em aberto" : "Nenhuma promissória neste filtro"}
          description={query ? "Tente o número, parte do nome, CPF ou telefone." : "Emita uma nota para o cliente assinar e acompanhe os vencimentos aqui."}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" aria-label="Promissórias">
          {notes.map((note) => {
            const status = parsePromissoryStatus(note.status);
            return (
              <li key={note.id} data-testid="promissoria" className="overflow-hidden border border-white/10 bg-ink/50">
                <div className="space-y-2 p-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold text-cream">Nota nº {note.number}{note.installmentCount > 1 ? ` · parcela ${note.installmentNo}/${note.installmentCount}` : ""}</p>
                      <p className="break-words text-sm text-cream">{note.issuerName}</p>
                      <p className="text-xs text-muted">CPF {note.issuerCpf} · {formatPhoneBR(note.issuerPhone)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={STATUS_TONE[note.status] ?? "neutral"}>{status ? PROMISSORY_STATUS_LABEL[status] : note.status}</Badge>
                      {note.overdue ? <Badge tone="warning">Vencida</Badge> : null}
                    </div>
                  </div>
                  <p className="font-display text-lg font-bold tabular-nums text-cream">{formatAdminMoney(note.amount)}</p>
                  <p className="text-xs text-muted">
                    Vence em {formatCivilDate(note.dueDate)} · emitida em {formatCivilDate(note.issuedAt)}
                    {note.paidAt ? ` · paga em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(note.paidAt))}` : ""}
                  </p>
                  {note.notes ? <p className="line-clamp-2 text-xs italic text-muted">{note.notes}</p> : null}
                </div>
                <div className="grid grid-cols-3 border-t border-white/10">
                  {note.status === "cancelada" ? (
                    <span className={`${mobileActionCell} opacity-40`}>PDF indisponível</span>
                  ) : (
                    <a href={`/api/admin/promissorias/${encodeURIComponent(note.id)}`} className={mobileActionCell} aria-label={`Baixar PDF da nota ${note.number}`}>
                      <IconDownload className="h-4 w-4" />PDF
                    </a>
                  )}
                  {canMarkPromissoryPaid(note.status) ? (
                    <button type="button" onClick={() => pay(note)} disabled={isPending} className={`${mobileActionCell} border-l border-white/10`} aria-label={`Marcar nota ${note.number} como paga`}>
                      <IconCheck className="h-4 w-4" />Marcar paga
                    </button>
                  ) : <span className="border-l border-white/10" />}
                  {canCancelPromissory(note.status) ? (
                    <button type="button" onClick={() => cancel(note)} disabled={isPending} className={`${mobileActionCell} border-l border-white/10 text-red-400`} aria-label={`Cancelar nota ${note.number}`}>
                      Cancelar
                    </button>
                  ) : <span className="border-l border-white/10" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm text-muted">
          {page > 1 ? <Link href={href({ page: page - 1 })} className={btn.outline}>Anterior</Link> : <span />}
          <span>Página {page} de {totalPages}</span>
          {page < totalPages ? <Link href={href({ page: page + 1 })} className={btn.outline}>Próxima</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
