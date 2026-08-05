"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { LeadVenda } from "@prisma/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatNumberBR, formatPhoneBR } from "@/lib/format";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL as STATUS_LABEL,
  LEAD_STATUS_STYLE as STATUS_STYLE,
  type LeadStatus,
} from "@/lib/leads";
import { deleteLead, updateLeadStatus } from "@/app/admin/leads/actions";

function whatsappLink(lead: LeadVenda) {
  const digits = lead.phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const message = encodeURIComponent(
    `Olá, ${lead.name.split(" ")[0]}! Aqui é da Garagem. Recebemos sua solicitação de avaliação do ${lead.vehicleInfo}.`,
  );
  return `https://wa.me/${withCountry}?text=${message}`;
}

export function LeadsTable({
  leads,
  status,
}: {
  leads: LeadVenda[];
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadVenda | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="Todos"
          active={!status}
          disabled={isPending}
          onClick={() => filterByStatus("")}
        />
        {LEAD_STATUSES.map((value) => (
          <FilterChip
            key={value}
            label={STATUS_LABEL[value]}
            active={status === value}
            disabled={isPending}
            onClick={() => filterByStatus(value)}
          />
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="border border-dashed border-white/15 px-6 py-16 text-center">
          <h2 className="font-display text-lg font-semibold text-cream">
            {status ? "Nenhum lead com esse status" : "Nenhum lead recebido ainda"}
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Os pedidos de avaliação enviados pelo formulário da página
            Vender/Trocar aparecem aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => (
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
                    {lead.km !== null
                      ? ` · ${formatNumberBR(lead.km)} km`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {formatPhoneBR(lead.phone)} ·{" "}
                    {new Date(lead.createdAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
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
                  <a
                    href={whatsappLink(lead)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[40px] border border-[#25D366]/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#25D366] transition hover:bg-[#25D366]/10"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`tel:${lead.phone.replace(/\D/g, "")}`}
                    className="min-h-[40px] border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-cream"
                  >
                    Ligar
                  </a>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(lead)}
                    className="min-h-[40px] border border-brand/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-brand transition hover:bg-brand/10"
                  >
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
