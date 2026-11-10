"use client";

import { inputClass } from "@/components/admin/ui";
import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-sm text-cream"><span>{label}</span>{children}</label>;
}
export function MoneyField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return <Field label={label}><input className={inputClass} type="number" inputMode="decimal" min="0" max="20000000" step="0.01" value={value === null ? "" : value / 100} onChange={e => onChange(e.target.value === "" ? null : Math.round(Number(e.target.value) * 100))} /></Field>;
}
export function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
  return <Field label={label}><select className={inputClass} value={value} onChange={e => onChange(e.target.value as T)}>{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></Field>;
}
export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex min-h-11 items-center gap-3 text-sm text-cream"><input type="checkbox" className="h-5 w-5 shrink-0 accent-brand" checked={checked} onChange={e => onChange(e.target.checked)} /><span>{label}</span></label>;
}
export const money = (cents: number | null) => cents === null ? "Indisponível" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function purchaseRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", cache: "no-store", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a solicitação.");
  return data as T;
}
