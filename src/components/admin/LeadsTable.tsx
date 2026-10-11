"use client";
import { PurchaseLeadForm, type LeadVehicleOption } from "@/components/admin/PurchaseLeadForm";
import { ORIGIN_LABELS, purchaseSourceLabel } from "@/lib/lead-origin";
import { PURCHASE_STATUSES, PURCHASE_STATUS_LABEL } from "@/lib/lead-funnel";

import { LeadFollowUp } from "@/components/admin/LeadFollowUp";
import { adminMutation } from "@/lib/admin-mutation";
import { exportAdminCsv } from "@/lib/admin-export-client";
import { adminDate, localDateInput } from "@/lib/admin-date";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { LeadVenda } from "@prisma/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconChevronDown, IconDownload, IconTrash, IconUsers } from "@/components/admin/icons";
import { IconInbox } from "@/components/admin/icons";
import { IconPhone, IconWhatsApp } from "@/components/site/icons";
import { EmptyState, btn, inputClass } from "@/components/admin/ui";
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
  WANTED_LEAD_SOURCE,
  buildLeadWhatsAppUrl,
  type LeadStatus,
  leadDisplayName,
  leadHasPhone,
} from "@/lib/leads";
import { emailFromLeadNotes } from "@/lib/wanted-lead";
import {
  convertLeadToCustomer,
  deleteLead,
  updateLeadStatus,
} from "@/app/admin/leads/actions";
import { adminFileViewHref } from "@/lib/storage-file-ref";

/** Troque aqui se mudar o serviço de consulta de placa. */
const CONSULTA_PLACA_URL_BASE = "https://placafipe.com/placa/";

function consultaPlacaUrl(plate: string) {
  return `${CONSULTA_PLACA_URL_BASE}${encodeURIComponent(normalizePlate(plate))}`;
}

function formatDateTime(value: Date) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function LeadsTable({
  leadId,
  vehicles,
  leads,
  status,
  query = "",
  origem = "",
  counts,
  page = 1,
  pageSize = 40,
  total,
}: {
  leadId?: string;
  vehicles: LeadVehicleOption[];
  leads: LeadVenda[];
  status: string;
  query?: string;
  origem?: string;
  counts: Record<string, number> & { total: number };
  page?: number;
  pageSize?: number;
  total?: number;
}) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadVenda | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [term, setTerm] = useState(query);

  const totalCount = total ?? leads.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function goTo(next: {
    status?: string;
    page?: number;
    q?: string;
    origem?: string;
  }) {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? status;
    const nextQuery = next.q ?? query;
    const nextOrigem = next.origem === undefined ? origem : next.origem;
    const nextPage = next.page ?? 1;
    if (nextStatus) params.set("status", nextStatus);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextOrigem) params.set("origem", nextOrigem);
    if (nextPage > 1) params.set("page", String(nextPage));
    startTransition(() => {
      router.push(
        params.toString()
          ? `/admin/leads?${params.toString()}`
          : "/admin/leads",
      );
    });
  }

  async function changeStatus(lead: LeadVenda, value: string) {
    setSavingId(lead.id);
    const result = await adminMutation(() => updateLeadStatus(lead.id, value));
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
    const result = await adminMutation(() => convertLeadToCustomer(lead.id));
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
    const result = await adminMutation(() => deleteLead(deleteTarget.id));
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
      {leadId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-brand/30 p-3 text-sm">
          <span>Atendimento selecionado pela visão geral</span>
          <button
            type="button"
            className={btn.outline}
            onClick={() => goTo({ status: "", q: "", origem: "", page: 1 })}
          >
            Ver todos os contatos
          </button>
        </div>
      ) : null}
      <div className="border border-white/10 bg-ink/50 p-3 sm:p-4">
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          <FilterChip
            label={`Todos (${counts.total})`}
            active={!status}
            disabled={isPending}
            onClick={() => goTo({ status: "", q: query, page: 1 })}
          />
          {LEAD_STATUSES.map((value) => (
            <FilterChip
              key={value}
              label={`${STATUS_LABEL[value]} (${counts[value] ?? 0})`}
              active={status === value}
              disabled={isPending}
              onClick={() => goTo({ status: value, q: query, page: 1 })}
            />
          ))}
          <FilterChip
            label="Não encontrou"
            active={origem === WANTED_LEAD_SOURCE}
            disabled={isPending}
            onClick={() =>
              goTo({
                status,
                q: query,
                page: 1,
                origem: origem === WANTED_LEAD_SOURCE ? "" : WANTED_LEAD_SOURCE,
              })
            }
          />
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              goTo({ status, q: term, page: 1 });
            }}
            className="flex min-w-0 flex-1 gap-2 sm:max-w-sm"
          >
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Nome, telefone, placa ou veículo"
              className={inputClass}
            />
            <button type="submit" className={btn.outline}>
              Buscar
            </button>
          </form>
          <span className="text-xs text-muted">
            {leads.length} de {totalCount} lead(s)
          </span>
          <button
            type="button"
            onClick={async () => {
              setExporting(true);
              try {
                const params = new URLSearchParams({
                  type: "leads",
                  status,
                  q: query,
                  origem,
                });
                if (leadId) params.set("lead", leadId);
                await exportAdminCsv(
                  `/api/admin/export?${params}`,
                  `leads-garagem-${localDateInput()}.csv`,
                );
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Falha na exportação.",
                );
              } finally {
                setExporting(false);
              }
            }}
            disabled={totalCount === 0 || exporting}
            className={`${btn.outline} w-full sm:ml-auto sm:w-auto`}
          >
            <IconDownload className="h-4 w-4" />
            {exporting ? "Preparando CSV…" : "Exportar todo o filtro"}
          </button>
        </div>
      </div>

      <label className="block text-sm">Filtrar origem
        <select className={`${inputClass} mt-1`} value={origem} onChange={event => goTo({ origem: event.target.value })} disabled={isPending}>
          <option value="">Todas as origens</option>
          <option value="vender">Avaliação</option><option value="chatbot-site">Chatbot do site</option><option value="nao-encontrou">Não encontrou</option>
          {Object.entries(ORIGIN_LABELS).map(([key, label]) => <option key={key} value={`whatsapp:${key}`}>Compra · {label}</option>)}
        </select>
      </label>
      {leads.length === 0 ? (
        <EmptyState
          icon={<IconInbox className="h-12 w-12" />}
          title={
            query
              ? "Nenhum lead para essa busca"
              : origem === WANTED_LEAD_SOURCE
                ? "Nenhum pedido de modelo ainda"
                : status
                  ? "Nenhum lead com esse status"
                  : "Nenhum lead recebido ainda"
          }
          description={
            query
              ? "Tente outro nome, telefone, placa, e-mail ou modelo."
              : origem === WANTED_LEAD_SOURCE
                ? "Quando alguém não achar o modelo no estoque ou na ficha e enviar o formulário, o pedido aparece aqui."
                : "Os pedidos de avaliação da página Vender/Trocar e os de quem não encontrou o modelo aparecem aqui."
          }
        />
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              vehicles={vehicles}
              saving={savingId === lead.id}
              startOpen={leadId === lead.id}
              onStatus={changeStatus}
              onConvert={convert}
              onDelete={setDeleteTarget}
              onCopyPlate={copyPlate}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 text-sm text-muted">
          <button
            type="button"
            disabled={page <= 1 || isPending}
            onClick={() => goTo({ status, q: query, page: page - 1 })}
            className="min-h-[44px] border border-white/15 px-3 text-cream disabled:opacity-40"
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isPending}
            onClick={() => goTo({ status, q: query, page: page + 1 })}
            className="min-h-[44px] border border-white/15 px-3 text-cream disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      ) : null}

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

/** Badge de status com texto legível (AA): o vermelho vira realce, não cor do texto. */
function statusBadgeStyle(lead: LeadVenda) {
  const style = STATUS_STYLE[lead.status as LeadStatus] ?? "bg-white/10 text-muted";
  return style
    .replace(/\btext-brand\b/, "text-cream ring-1 ring-inset ring-brand/60")
    .replace("bg-brand/15", "bg-brand/25");
}

function statusLabel(lead: LeadVenda) {
  return lead.source?.startsWith("whatsapp:")
    ? PURCHASE_STATUS_LABEL[lead.status as keyof typeof PURCHASE_STATUS_LABEL] ||
        STATUS_LABEL[lead.status as LeadStatus] ||
        lead.status
    : STATUS_LABEL[lead.status as LeadStatus] ?? lead.status;
}

function originLabel(lead: LeadVenda) {
  if (lead.source === "chatbot-site") return "Chatbot do site";
  if (lead.source === "vender") return "Formulário de avaliação";
  if (lead.source === WANTED_LEAD_SOURCE) return "Formulário — não encontrou o modelo";
  return lead.source ? purchaseSourceLabel(lead.source) : "";
}

function originChip(lead: LeadVenda) {
  if (lead.source === "chatbot-site")
    return { text: "Chatbot IA", className: "border-brand/50 bg-brand/20 text-cream" };
  if (lead.source === "vender")
    return { text: "Avaliação", className: "border-white/20 bg-white/10 text-cream" };
  if (lead.source === WANTED_LEAD_SOURCE)
    return { text: "Não encontrou", className: "border-brand/50 bg-brand/20 text-cream" };
  if (lead.source)
    return { text: purchaseSourceLabel(lead.source), className: "border-white/10 bg-white/5 text-muted" };
  return null;
}

const leadAction =
  "inline-flex min-h-[44px] items-center justify-center gap-2 border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition touch-manipulation disabled:opacity-60";

/**
 * Card do contato: a face fechada mostra só o que decide o próximo toque
 * (nome, interesse, status, próxima ação e WhatsApp). Status, placa, fotos,
 * conversão, exclusão, atendimento e notas ficam no detalhe, que continua
 * montado depois de aberto para não perder texto digitado.
 */
function LeadCard({
  lead,
  vehicles,
  saving,
  startOpen,
  onStatus,
  onConvert,
  onDelete,
  onCopyPlate,
}: {
  lead: LeadVenda;
  vehicles: LeadVehicleOption[];
  saving: boolean;
  startOpen: boolean;
  onStatus: (lead: LeadVenda, value: string) => void;
  onConvert: (lead: LeadVenda) => void;
  onDelete: (lead: LeadVenda) => void;
  onCopyPlate: (plate: string) => void;
}) {
  const [expanded, setExpanded] = useState(startOpen);
  const [opened, setOpened] = useState(startOpen);
  const detailId = `lead-detail-${lead.id}`;
  const chip = originChip(lead);
  const email = emailFromLeadNotes(lead.notes);
  const hasPhone = leadHasPhone(lead);
  const isWanted = lead.source === WANTED_LEAD_SOURCE;
  const overdue = lead.nextActionAt
    ? localDateInput(new Date(lead.nextActionAt)) < localDateInput()
    : false;
  const interest = isWanted
    ? `Modelo pedido: ${lead.vehicleInfo}`
    : `${lead.vehicleInfo}${lead.km !== null ? ` · ${formatNumberBR(lead.km)} km` : ""}`;

  return (
    <li id={`lead-${lead.id}`} className="border border-white/10 bg-ink/50">
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate font-display text-lg font-semibold leading-snug text-cream">
            {leadDisplayName(lead)}
          </p>
          <span
            className={`shrink-0 px-2 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeStyle(lead)}`}
          >
            {statusLabel(lead)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-cream" title={interest}>
          {interest}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {chip ? (
            <span className={`border px-1.5 py-0.5 font-semibold uppercase tracking-wide ${chip.className}`}>
              {chip.text}
            </span>
          ) : null}
          <span>{hasPhone ? formatPhoneBR(lead.phone) : "Sem telefone"}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDateTime(lead.createdAt)}</span>
        </p>
        {lead.nextAction || lead.nextActionAt ? (
          <p className={`mt-2 truncate text-sm ${overdue ? "text-brand-orange" : "text-cream"}`}>
            <span className="font-semibold">{overdue ? "Atrasado: " : "Próxima ação: "}</span>
            {lead.nextAction || "retomar contato"}
            {lead.nextActionAt
              ? ` · ${adminDate(new Date(lead.nextActionAt))}`
              : ""}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          {hasPhone ? (
            <>
              <a
                href={buildLeadWhatsAppUrl(lead)}
                target="_blank"
                rel="noopener noreferrer"
                className={`${leadAction} min-w-0 flex-1 border-[#25D366]/60 text-[#25D366] hover:bg-[#25D366]/10`}
              >
                <IconWhatsApp className="h-4 w-4" />
                WhatsApp
              </a>
              <a
                href={`tel:+55${lead.phone.replace(/\D/g, "")}`}
                aria-label={`Ligar para ${leadDisplayName(lead)}`}
                className={`${leadAction} w-11 shrink-0 border-white/15 px-0 text-cream hover:border-brand sm:w-auto sm:px-3`}
              >
                <IconPhone className="h-4 w-4" />
                <span className="hidden sm:inline">Ligar</span>
              </a>
            </>
          ) : null}
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={() => {
              setOpened(true);
              setExpanded((value) => !value);
            }}
            className={`${leadAction} ${hasPhone ? "shrink-0" : "flex-1"} border-white/15 text-cream hover:border-brand`}
          >
            {expanded ? "Fechar" : "Detalhes"}
            <IconChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {opened ? (
        <div id={detailId} hidden={!expanded} className="border-t border-white/10">
          <div className="space-y-3 p-3 sm:p-4">
            <div>
              <label
                htmlFor={`status-${lead.id}`}
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
              >
                Status do lead
              </label>
              <select
                id={`status-${lead.id}`}
                value={lead.status}
                disabled={saving}
                onChange={(event) => onStatus(lead, event.target.value)}
                className={`${inputClass} bg-asphalt disabled:opacity-60`}
              >
                {(lead.source?.startsWith("whatsapp:") ? PURCHASE_STATUSES : LEAD_STATUSES).map((value) => (
                  <option key={value} value={value}>
                    {lead.source?.startsWith("whatsapp:")
                      ? PURCHASE_STATUS_LABEL[value as keyof typeof PURCHASE_STATUS_LABEL] || STATUS_LABEL[value]
                      : STATUS_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>

            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {!isWanted ? (
                <div className="flex gap-2">
                  <dt className="text-muted">Placa</dt>
                  <dd className="font-display font-semibold tracking-wide text-cream">
                    {lead.plate ? formatPlateDisplay(lead.plate) : "Não informada"}
                  </dd>
                </div>
              ) : null}
              {lead.source ? (
                <div className="flex gap-2">
                  <dt className="text-muted">Origem</dt>
                  <dd className="text-cream">{originLabel(lead)}</dd>
                </div>
              ) : null}
              {email ? (
                <div className="flex min-w-0 gap-2">
                  <dt className="text-muted">E-mail</dt>
                  <dd className="min-w-0 break-all text-cream">{email}</dd>
                </div>
              ) : null}
            </dl>

            {lead.interestVehicleId ? (
              <a
                href={`/estoque/${lead.interestVehicleId}`}
                className="inline-flex min-h-[44px] items-center text-sm text-cream underline decoration-white/30 underline-offset-4 hover:decoration-brand"
              >
                {isWanted ? "Anúncio que estava aberto" : "Interesse no estoque"}
              </a>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              {lead.plate ? (
                <>
                  <a
                    href={consultaPlacaUrl(lead.plate)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${leadAction} border-brand/50 text-red-400 hover:bg-brand/10`}
                  >
                    Consultar FIPE
                  </a>
                  <button
                    type="button"
                    onClick={() => onCopyPlate(lead.plate)}
                    className={`${leadAction} border-white/15 text-muted hover:text-cream`}
                  >
                    Copiar placa
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => onConvert(lead)}
                disabled={saving}
                title="Criar cliente com estes dados"
                className={`${leadAction} border-white/15 text-muted hover:text-cream`}
              >
                <IconUsers className="h-4 w-4" />
                Virar cliente
              </button>
              <button
                type="button"
                onClick={() => onDelete(lead)}
                aria-label="Excluir lead"
                className={`${leadAction} border-brand/50 text-red-400 hover:bg-brand/10`}
              >
                <IconTrash className="h-4 w-4" />
                Excluir
              </button>
            </div>

            {lead.photoUrls && lead.photoUrls.length > 0 ? (
              <div className="border-t border-white/10 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Fotos do usado
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {lead.photoUrls.map((url, index) => (
                    <li key={url}>
                      <a
                        href={adminFileViewHref(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center border border-white/15 px-3 text-sm text-cream transition hover:border-brand"
                      >
                        Foto {index + 1}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {lead.notes ? (
              <p className="whitespace-pre-line border-t border-white/10 pt-3 text-sm leading-relaxed text-muted">
                {lead.notes}
              </p>
            ) : null}
          </div>

          {lead.source?.startsWith("whatsapp:") ? (
            <div className="px-3 pb-3 sm:px-4">
              <PurchaseLeadForm
                key={`${lead.id}-${new Date(lead.updatedAt).getTime()}`}
                vehicles={vehicles}
                lead={lead}
              />
            </div>
          ) : null}
          <LeadFollowUp
            id={lead.id}
            nextAction={lead.nextAction}
            nextActionAt={lead.nextActionAt}
          />
        </div>
      ) : null}
    </li>
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
      className={`min-h-[44px] shrink-0 border px-3 text-xs font-semibold uppercase tracking-wide transition touch-manipulation disabled:opacity-60 ${
        active
          ? "border-brand bg-brand/10 text-cream"
          : "border-white/10 text-muted hover:text-cream"
      }`}
    >
      {label}
    </button>
  );
}
