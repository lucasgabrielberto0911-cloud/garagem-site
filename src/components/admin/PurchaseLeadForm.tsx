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
import { SearchSelect } from "@/components/admin/SearchSelect";
import type { SellableVehicleRecord } from "@/lib/admin-vehicles";
export type LeadVehicleOption = { id: string; label: string };
const NO_VEHICLE: LeadVehicleOption = { id: "", label: "Ainda escolhendo" };

export function PurchaseLeadForm({ selectedVehicle, lead }: { selectedVehicle?: LeadVehicleOption; lead?: LeadVenda }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const initialVehicle = lead?.interestVehicleId
    ? selectedVehicle ?? { id: lead.interestVehicleId, label: lead.vehicleInfo }
    : null;
  const [pickedVehicle, setPickedVehicle] = useState<LeadVehicleOption | null>(initialVehicle);

  async function loadVehicleOptions(query: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ q: query.trim(), take: "20" });
    const response = await fetch(`/api/admin/vendas/veiculos?${params}`, { signal });
    if (!response.ok) throw new Error("Não foi possível buscar os veículos.");
    const data = await response.json() as { vehicles: SellableVehicleRecord[] };
    const options = data.vehicles
      .filter(vehicle => vehicle.status === "disponivel" || vehicle.status === "reservado")
      .map(vehicle => ({
        id: vehicle.id,
        label: [vehicle.brand, vehicle.model, vehicle.version, vehicle.yearModel].filter(Boolean).join(" "),
      }));
    // A seleção original pode estar vendida ou fora dos resultados da busca.
    const retained = [initialVehicle, pickedVehicle].filter((vehicle): vehicle is LeadVehicleOption => Boolean(vehicle));
    return [...new Map([NO_VEHICLE, ...retained, ...options].map(vehicle => [vehicle.id, vehicle])).values()];
  }

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
        if (!lead) { form.reset(); setPickedVehicle(null); }
        router.refresh();
      } catch { toast.error("Não foi possível salvar. Tente novamente."); }
      finally { setPending(false); }
    }}>
      {lead ? <input type="hidden" name="id" value={lead.id} /> : null}
      <Field label="Nome"><input disabled={pending} name="name" maxLength={120} defaultValue={lead?.name} autoComplete="off" className={inputClass} /></Field>
      <Field label="WhatsApp" hint="Opcional se tiver o nome"><input disabled={pending} name="phone" type="tel" inputMode="tel" maxLength={22} defaultValue={lead?.phone} placeholder="DDD + número" className={inputClass} /></Field>
      <Field label="Carro de interesse" as="div">
        <SearchSelect
          disabled={pending}
          name="vehicle"
          value={pickedVehicle?.id || ""}
          selectedLabel={pickedVehicle?.label || NO_VEHICLE.label}
          placeholder="Busque por marca, modelo ou placa"
          loadOptions={loadVehicleOptions}
          onChange={(_, vehicle) => { setPickedVehicle(vehicle?.id ? vehicle : null); setDirty(true); }}
        />
      </Field>
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
