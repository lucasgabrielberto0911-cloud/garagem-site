"use client";

import { useEffect, useState } from "react";
import { ActionSheet } from "./ActionSheet";
import { Field, btn, inputClass } from "./ui";
import { formatAdminMoney } from "@/lib/admin-money";
import type { FipeOption, FipeQuote } from "@/lib/fipe";

type Props = {
  category: "carro" | "moto";
  exclude?: string;
  onSelect: (quote: FipeQuote) => void;
  label?: string;
};

export function FipeLookup({ label = "Buscar na FIPE", ...props }: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-xs text-muted underline underline-offset-4 hover:text-cream">{label}</button>
    <ActionSheet open={open} title="Buscar na FIPE" onClose={() => setOpen(false)}>
      {open ? <FipePicker key={props.category} {...props} onSelect={quote => { props.onSelect(quote); setOpen(false); }} /> : null}
    </ActionSheet>
  </>;
}

function FipePicker({ category, exclude, onSelect }: Props) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [brands, setBrands] = useState<FipeOption[]>([]);
  const [models, setModels] = useState<FipeOption[]>([]);
  const [years, setYears] = useState<FipeOption[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; quote?: FipeQuote; error?: string } | null>(null);
  const params = new URLSearchParams({ category });
  if (brand) params.set("brand", brand);
  if (model) params.set("model", model);
  if (year) params.set("year", year);
  if (exclude) params.set("exclude", exclude);
  const query = params.toString();
  const key = `${query}:${attempt}`;
  const current = result?.key === key ? result : null;
  const loading = current === null;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/admin/fipe?${query}`, { signal: controller.signal });
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setResult({ key, error: typeof data.error === "string" ? data.error : "Não foi possível consultar a FIPE." });
          return;
        }
        if (year) setResult({ key, quote: data });
        else {
          if (model) setYears(data);
          else if (brand) setModels(data);
          else setBrands(data);
          setResult({ key });
        }
      } catch {
        if (!controller.signal.aborted) setResult({ key, error: "Não foi possível consultar a FIPE. Tente novamente." });
      }
    }
    void load();
    return () => controller.abort();
  }, [query, key, brand, model, year]);

  return <div className="space-y-3 p-4" aria-busy={loading} onChange={event => event.stopPropagation()}>
    <Field label="Marca FIPE">
      <select data-sheet-item className={inputClass} value={brand} onChange={event => { setBrand(event.target.value); setModel(""); setYear(""); setModels([]); setYears([]); }}>
        <option value="">Selecione a marca</option>
        {brands.map(item => <option key={item.codigo} value={item.codigo}>{item.nome}</option>)}
      </select>
    </Field>
    {brand ? <Field label="Modelo FIPE">
      <select className={inputClass} value={model} onChange={event => { setModel(event.target.value); setYear(""); setYears([]); }}>
        <option value="">Selecione o modelo e a versão</option>
        {models.map(item => <option key={item.codigo} value={item.codigo}>{item.nome}</option>)}
      </select>
    </Field> : null}
    {model ? <Field label="Ano modelo FIPE">
      <select className={inputClass} value={year} onChange={event => setYear(event.target.value)}>
        <option value="">Selecione o ano e o combustível</option>
        {years.map(item => <option key={item.codigo} value={item.codigo}>{item.nome}</option>)}
      </select>
    </Field> : null}
    {loading ? <p role="status" className="text-xs text-muted">Consultando FIPE…</p> : null}
    {current?.error ? <p role="alert" className="text-sm text-muted">{current.error} <button type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-11 underline">Tentar novamente</button></p> : null}
    {current?.quote ? <>
      <p className="text-xs text-muted">FIPE {formatAdminMoney(current.quote.vehicle.price)} · {current.quote.vehicle.reference}. Preço de referência; revise os dados antes de salvar. O ano de fabricação continua manual.</p>
      <button type="button" className={`${btn.primary} w-full`} onClick={() => onSelect(current.quote!)}>Preencher dados do veículo</button>
    </> : null}
  </div>;
}
