"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { LeadVenda } from "@prisma/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconDownload, IconTrash, IconUsers } from "@/components/admin/icons";
import { IconInbox } from "@/components/admin/icons";
import { IconPhone, IconWhatsApp } from "@/components/site/icons";
import { EmptyState, inputClass } from "@/components/admin/ui";
import {
  formatNumberBR,
  formatPhoneBR,
  formatPlateDisplay,
  normalizePlate,
} from "@/lib/format";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL as STATUS_LABEL,
  LEAD_STATUS_STYLE as STATUS_STYLE,
  type LeadStatus,
} from "@/lib/leads";
import {
  convertLeadToCustomer,
  deleteLead,
  updateLeadStatus,
} from "@/app/admin/leads/actions";

/** Troque aqui se mudar o serviço de consulta de placa. */
const CONSULTA_PLACA_URL_BASE =
  "https://buscafipe.com/consulta-placa/?placa=";

function consultaPlacaUrl(plate: string) {
  return `${CONSULTA_PLACA_URL_BASE}${encodeURIComponent(normalizePlate(plate))}`;
}

function whatsappLink(lead: LeadVenda) {
  const digits = lead.phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const plateLabel = lead.plate
    ? ` (placa ${formatPlateDisplay(lead.plate)})`
    : "";
  const message = encodeURIComponent(
    `Olá, ${lead.name.split(" ")[0]}! Aqui é da Garagem. Recebemos sua solicitação de avaliação do ${lead.vehicleInfo}${plateLabel}.`,
  );
  return `https://wa.me/${withCountry}?text=${message}`;
}

function formatDateTime(value: Date) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function exportCsv(leads: LeadVenda[]) {
  const header = [
    "Nome",
    "Telefone",
    "Veículo",
    "Placa",
    "KM",
    "Status",
    "Observações",
    "Data",
  ];
  const rows = leads.map((lead) => [
    lead.name,
    formatPhoneBR(lead.phone),
    lead.vehicleInfo,
    lead.plate ? formatPlateDisplay(lead.plate) : "",
    lead.km !== null ? String(lead.km) : "",
    STATUS_LABEL[lead.status as LeadStatus] ?? lead.status,
    (lead.notes ?? "").replace(/\s+/g, " "),
    formatDateTime(lead.createdAt),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `leads-garagem-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function LeadsTable({
  leads,
  status,
  counts,
}: {
  leads: LeadVenda[];
  status: string;
  counts: Record<string, number> & { total: number };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadVenda | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [term, setTerm] = useState("");

  const filtered = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return leads;
    const digits = query.replace(/\D/g, "");
    const plateQuery = normalizePlate(query).toLowerCase();
    return leads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(query) ||
        lead.vehicleInfo.toLowerCase().includes(query) ||
        (lead.plate && lead.plate.toLowerCase().includes(plateQuery)) ||
        (digits.length > 0 && lead.phone.includes(digits)),
    );
  }, [leads, term]);

  function filterByStatus(value: string) {
    startTransition(() => {
      router.push(value ? `/admin/leads?status=${value}` : "/admin/leads");
    });
  }

  async function changeStatus(lead: LeadVenda, value: string) {
    setSavingId(lead.id);
    const result = await updateLeadStatus(lead.id, value);
    setSavingId(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  async function convert(lead: LeadVenda) {
    setSavingId(lead.id);
    const result = await convertLeadToCustomer(lead.id);
    setSavingId(null);
    if (result.ok) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  }

  async function copyPlate(plate: string) {
    const normalized = normalizePlate(plate);
    try {
      await navigator.clipboard.writeText(normalized);
      toast.success(`Placa ${formatPlateDisplay(normalized)} copiada.`);
    } catch {
      toast.error("Não foi possível copiar a placa.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteLead(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="border border-white/10 bg-ink/50 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label={`Todos (${counts.total})`}
            active={!status}
            disabled={isPending}
            onClick={() => filterByStatus("")}
          />
          {LEAD_STATUSES.map((value) => (
            <FilterChip
              key={value}
              label={`${STATUS_LABEL[value]} (${counts[value] ?? 0})`}
              active={status === value}
              disabled={isPending}
              onClick={() => filterByStatus(value)}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar por nome, telefone, placa ou veículo"
            className={`${inputClass} sm:max-w-sm`}
          />
          <span className="text-xs text-muted">
            {filtered.length} de {leads.length} lead(s)
          </span>
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="ml-auto inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-cream transition hover:border-brand disabled:opacity-50"
          >
            <IconDownload className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconInbox className="h-12 w-12" />}
          title={
            leads.length === 0
              ? status
                ? "Nenhum lead com esse status"
                : "Nenhum lead recebido ainda"
              : "Nenhum lead para essa busca"
          }
          description={
            leads.length === 0
              ? "Os pedidos de avaliação enviados pelo formulário da página Vender/Trocar aparecem aqui."
              : "Tente outro nome, telefone, placa ou veículo."
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((lead) => (
            <li
              key={lead.id}
              className="border border-white/10 bg-ink/50 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-base font-semibold text-cream">
                      {lead.name}
                    </p>
                    <span
                      className={`px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        STATUS_STYLE[lead.status as LeadStatus] ??
                        "bg-white/10 text-muted"
                      }`}
                    >
                      {STATUS_LABEL[lead.status as LeadStatus] ?? lead.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {lead.vehicleInfo}
                    {lead.km !== null ? ` · ${formatNumberBR(lead.km)} km` : ""}
                  </p>
                  <p className="mt-1 text-sm text-cream">
                    Placa:{" "}
                    <span className="font-display font-semibold tracking-wide">
                      {lead.plate
                        ? formatPlateDisplay(lead.plate)
                        : "Não informada"}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {formatPhoneBR(lead.phone)} ·{" "}
                    {formatDateTime(lead.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`status-${lead.id}`}>
                    Status do lead
                  </label>
                  <select
                    id={`status-${lead.id}`}
                    value={lead.status}
                    disabled={savingId === lead.id}
                    onChange={(event) => changeStatus(lead, event.target.value)}
                    className="min-h-[40px] border border-white/10 bg-asphalt px-3 text-sm text-cream outline-none transition focus:border-brand disabled:opacity-60"
                  >
                    {LEAD_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {STATUS_LABEL[value]}
                      </option>
                    ))}
                  </select>
                  {lead.plate ? (
                    <>
                      <a
                        href={consultaPlacaUrl(lead.plate)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[40px] items-center gap-2 border border-brand/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-brand transition hover:bg-brand/10"
                      >
                        Consultar histórico
                      </a>
                      <button
                        type="button"
                        onClick={() => copyPlate(lead.plate)}
                        className="inline-flex min-h-[40px] items-center gap-2 border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-cream"
                      >
                        Copiar placa
                      </button>
                    </>
                  ) : null}
                  <a
                    href={whatsappLink(lead)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center gap-2 border border-[#25D366]/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#25D366] transition hover:bg-[#25D366]/10"
                  >
                    <IconWhatsApp className="h-4 w-4" />
                    WhatsApp
                  </a>
                  <a
                    href={`tel:+55${lead.phone.replace(/\D/g, "")}`}
                    className="inline-flex min-h-[40px] items-center gap-2 border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-cream"
                  >
                    <IconPhone className="h-4 w-4" />
                    Ligar
                  </a>
                  <button
                    type="button"
                    onClick={() => convert(lead)}
                    disabled={savingId === lead.id}
                    title="Criar cliente com estes dados"
                    className="inline-flex min-h-[40px] items-center gap-2 border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-cream disabled:opacity-60"
                  >
                    <IconUsers className="h-4 w-4" />
                    Virar cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(lead)}
                    aria-label="Excluir lead"
                    className="inline-flex min-h-[40px] items-center gap-2 border border-brand/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-brand transition hover:bg-brand/10"
                  >
                    <IconTrash className="h-4 w-4" />
                    Excluir
                  </button>
                </div>
              </div>

              {lead.notes ? (
                <p className="mt-3 whitespace-pre-line border-t border-white/10 pt-3 text-sm leading-relaxed text-muted">
                  {lead.notes}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir lead"
        description={
          deleteTarget
            ? `Remover o contato de ${deleteTarget.name}? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        danger
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function FilterChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[38px] border px-3 text-xs font-semibold uppercase tracking-wide transition disabled:opacity-60 ${
        active
          ? "border-brand bg-brand/10 text-cream"
          : "border-white/10 text-muted hover:text-cream"
      }`}
    >
      {label}
    </button>
  );
}
