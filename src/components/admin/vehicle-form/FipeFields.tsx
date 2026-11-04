"use client";

import { FipeLookup } from "@/components/admin/FipeLookup";
import { formatAdminMoney, moneyInput } from "@/lib/admin-money";
import type { VehicleFormModel } from "./useVehicleFormState";

export type FipeForm = Pick<VehicleFormModel,
  "category" | "brand" | "model" | "yearModel" | "setBrand" | "setModel" | "setVersion" | "setYearModel" | "setFuel" | "setDirty" | "setErrors" | "setValues" | "fipe" | "fipeExcludeId"
>;

export function FipeDataLink({ form, label }: { form: FipeForm; label?: string }) {
  return <FipeLookup category={form.category} exclude={form.fipeExcludeId} label={label} onSelect={quote => {
    const vehicle = quote.vehicle;
    form.setBrand(vehicle.brand);
    form.setModel(vehicle.model);
    form.setVersion(vehicle.version);
    form.setYearModel(String(vehicle.yearModel));
    form.setFuel(vehicle.fuel);
    form.fipe.remember(quote);
    form.setDirty(true);
    form.setErrors(current => Object.fromEntries(Object.entries(current).filter(([field]) => !["brand", "model", "yearModel", "fuel"].includes(field))));
  }} />;
}

export function FipePriceLine({ form }: { form: FipeForm }) {
  if (!form.brand.trim() || !form.model.trim() || !/^(19|20)\d{2}$/.test(form.yearModel)) return null;
  const quote = form.fipe.quote;
  return <div className="col-span-2 text-xs leading-relaxed text-muted">
    {quote ? <>
      <span title={`Referência: ${quote.vehicle.reference} · código ${quote.vehicle.code}`}>FIPE {formatAdminMoney(quote.vehicle.price)}</span>
      {quote.stock ? <> · estoque parecido ({quote.stock.count}): {formatAdminMoney(quote.stock.min)} a {formatAdminMoney(quote.stock.max)} · média {formatAdminMoney(quote.stock.average)}</> : null}
      {" · "}<button type="button" className="min-h-11 underline underline-offset-4 hover:text-cream" onClick={() => {
        form.setValues(current => ({ ...current, price: moneyInput(quote.vehicle.price) }));
        form.setDirty(true);
        form.setErrors(current => { const next = { ...current }; delete next.price; return next; });
      }}>Usar {formatAdminMoney(quote.vehicle.price)}</button>
    </> : <FipeDataLink form={form} label="Consultar referência FIPE" />}
  </div>;
}
