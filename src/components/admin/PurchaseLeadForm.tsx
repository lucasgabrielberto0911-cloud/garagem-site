"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LeadVenda } from "@prisma/client";
import { savePurchaseLead } from "@/app/admin/leads/actions";
import { ORIGIN_LABELS } from "@/lib/lead-origin";
import { PURCHASE_STATUSES, PURCHASE_STATUS_LABEL } from "@/lib/lead-funnel";
import { localDateInput } from "@/lib/admin-date";
import { Field, btn, inputClass } from "@/components/admin/ui";
import { useUnsavedChangesWarning } from "@/components/admin/useUnsavedChangesWarning";
export type LeadVehicleOption = { id: string; label: string };
export function PurchaseLeadForm({ vehicles, lead }: { vehicles: LeadVehicleOption[]; lead?: LeadVenda }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedChangesWarning(dirty);
  return <details className="rounded border border-white/15 p-3">
    <summary className="min-h-11 cursor-pointer py-2 font-semibold">{lead ? "Editar conversa de compra" : "+ Registrar conversa do WhatsApp"}</summary>
    <form className="mt-3 grid gap-3 sm:grid-cols-2" onChange={() => setDirty(true)} onSubmit={async (event) => {
      event.preventDefault();
      if (pending) return;
      const form = event.currentTarget;
      const data = new FormData(form);
      setPending(true);
      try {
        const result = await savePurchaseLead(data);
        if (!result.ok) { toast.error(result.message); return; }
        setDirty(false);
        toast.success(result.message);
        if (!lead) form.reset();
        router.refresh();
      } catch { toast.error("Não foi possível salvar. Tente novamente."); }
      finally { setPending(false); }
    }}>
      {lead ? <input type="hidden" name="id" value={lead.id} /> : null}
      <Field label="Nome" required><input disabled={pending} name="name" required maxLength={120} defaultValue={lead?.name} autoComplete="off" className={inputClass} /></Field>
      <Field label="WhatsApp" required><input disabled={pending} name="phone" type="tel" required maxLength={22} defaultValue={lead?.phone} placeholder="DDD + número" className={inputClass} /></Field>
      <Field label="Carro de interesse"><select disabled={pending} name="vehicle" defaultValue={lead?.interestVehicleId || ""} className={inputClass}>
        <option value="">Ainda escolhendo</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select></Field>
      <Field label="Origem"><select disabled={pending} name="origin" defaultValue={lead?.source?.slice("whatsapp:".length) || "desconhecida"} className={inputClass}>
        {Object.entries(ORIGIN_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></Field>
      <Field label="Situação"><select disabled={pending} name="status" defaultValue={lead?.status || "conversa"} className={inputClass}>
        {lead && !(PURCHASE_STATUSES as readonly string[]).includes(lead.status) ? <option value="conversa">Retomar conversa ({lead.status})</option> : null}
        {PURCHASE_STATUSES.map(key => <option key={key} value={key}>{PURCHASE_STATUS_LABEL[key]}</option>)}
      </select></Field>
      <Field label="Próxima ação"><input disabled={pending} name="nextAction" maxLength={300} defaultValue={lead?.nextAction || ""} placeholder="Ex.: confirmar visita às 10h" className={inputClass} /></Field>
      <Field label="Dia para retomar"><input disabled={pending} name="date" type="date" defaultValue={lead?.nextActionAt ? localDateInput(new Date(lead.nextActionAt)) : ""} className={inputClass} /></Field>
      <button disabled={pending} className={`${btn.primary} min-h-12 self-end`}>{pending ? "Salvando…" : lead ? "Salvar conversa" : "Registrar conversa"}</button>
    </form>
  </details>;
}
