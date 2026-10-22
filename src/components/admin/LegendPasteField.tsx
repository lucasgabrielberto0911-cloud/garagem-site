"use client";

import { useState } from "react";
import { inputClass } from "./ui";
import {
  accessoryGroup, groupAccessories, LEGEND_FIELDS, legendText, parseLegend, fold,
  type LegendData, type LegendField, type LegendParseResult,
} from "@/lib/legend-parser";
import { parseMoneyBR } from "@/lib/admin-money";
import { parseVehicleKm } from "@/lib/admin-vehicle-fields";

type Props = {
  description: string;
  accessories: string[];
  data: Record<LegendField, string>;
  onChange: (result: LegendParseResult) => void;
  onRemoveDescription: () => void;
  onRemoveItem: (item: string) => void;
  onFieldChange: (field: LegendField, value: string) => void;
};

function sameValue(field: LegendField, a: string, b: string) {
  if (field === "price") return parseMoneyBR(a) === parseMoneyBR(b);
  if (field === "km") return parseVehicleKm(a) === parseVehicleKm(b);
  return fold(a.trim()) === fold(b.trim());
}

export function LegendPasteField({ description, accessories, data, onChange, onRemoveDescription, onRemoveItem, onFieldChange }: Props) {
  const [text, setText] = useState(() => legendText(description, accessories, data));
  const [detected, setDetected] = useState<LegendData>({});
  function syncPreview(nextDescription: string, nextAccessories: string[], nextData = data) {
    setText(legendText(nextDescription, nextAccessories, nextData));
    setDetected({});
  }
  return <div className="space-y-4">
    <label htmlFor="vehicle-legend" className="block text-sm font-semibold text-cream">Colar legenda</label>
    <p className="text-xs text-muted">Cole a legenda inteira. Descrição, dados, preço, opcionais e facilidades são separados automaticamente. Dados preenchidos são preservados; confira divergências abaixo.</p>
    <textarea id="vehicle-legend" name="vehicle-legend" rows={16} value={text} className={`${inputClass} resize-y`}
      placeholder="Cole aqui a legenda completa do anúncio."
      onChange={event => {
        setText(event.target.value);
        const parsed = parseLegend(event.target.value);
        setDetected(parsed.data);
        onChange(parsed);
      }} />
    <div aria-label="Prévia da legenda" className="space-y-4">
      {description && <section><h3 className="font-display font-semibold">Descrição</h3>
        <div className="flex items-start gap-2"><p className="whitespace-pre-line break-words text-sm">{description}</p>
          <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-lg text-muted hover:text-brand" aria-label="Remover descrição" onClick={() => { onRemoveDescription(); syncPreview("", accessories); }}>×</button></div></section>}
      <section><h3 className="font-display font-semibold">Dados e preço</h3>
        {Object.entries(LEGEND_FIELDS).map(([key, label]) => {
          const field = key as LegendField;
          const incoming = detected[field];
          const conflict = incoming && data[field] && !sameValue(field, incoming, data[field]);
          return data[field] || incoming ? <div key={field} className="py-1 text-sm">
            <div className="flex items-center gap-2"><span>{label}: {data[field] || incoming}</span>
              <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-lg text-muted hover:text-brand" aria-label={`Remover ${label}`} onClick={() => {
                onFieldChange(field, "");
                syncPreview(description, accessories, { ...data, [field]: "" });
              }}>×</button></div>
            {conflict && <p role="status" className="text-brand-orange">Divergência em {label}: legenda informa {incoming}. Campo mantido: {data[field]}.{" "}
              <button type="button" className="underline" onClick={() => { onFieldChange(field, incoming); syncPreview(description, accessories, { ...data, [field]: incoming }); }}>Usar valor da legenda</button></p>}
          </div> : null;
        })}
      </section>
      {groupAccessories(accessories).map(({ group, items }) => <section key={group} aria-label={group}>
        <h3 className="font-display font-semibold">{group}</h3>
        <ul>{items.map(item => <li key={item} className="flex items-start gap-2 py-1 text-sm">
          <span className="min-w-0 break-words">{accessoryGroup(item).text}</span>
          <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-lg text-muted hover:text-brand" aria-label={`Remover ${accessoryGroup(item).text}`} onClick={() => { onRemoveItem(item); syncPreview(description, accessories.filter(entry => entry !== item)); }}>×</button>
        </li>)}</ul>
      </section>)}
    </div>
  </div>;
}
