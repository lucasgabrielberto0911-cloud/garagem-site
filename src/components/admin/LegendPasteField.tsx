"use client";

import { AdminAiReview } from "./AdminAiReview";
import { useState } from "react";
import { inputClass } from "./ui";
import {
  accessoryGroup, groupAccessories, LEGEND_FIELDS, legendText, parseLegend, fold, sanitizeLegendText,
  type LegendData, type LegendField, type LegendParseResult,
} from "@/lib/legend-parser";
import { parseMoneyBR } from "@/lib/admin-money";
import { parseVehicleKm } from "@/lib/admin-vehicle-fields";

type Props = {
  identity?: { brand: string; model: string; version: string };
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

function sensitiveMessage(found: string[]) {
  if (found.length === 0) return "";
  return `Tiramos da legenda (${found.join(", ")}). Esses dados não aparecem no anúncio nem vão para a IA.`;
}

export function LegendPasteField({ description, accessories, data, identity, onChange, onRemoveDescription, onRemoveItem, onFieldChange }: Props) {
  const [text, setText] = useState(() => legendText(description, accessories, data));
  const [detected, setDetected] = useState<LegendData>({});
  const [sensitive, setSensitive] = useState<string[]>([]);
  function applyCleanText(clean: string) {
    setText(clean);
    const parsed = parseLegend(clean);
    setDetected(parsed.data);
    setSensitive(parsed.sensitive);
    onChange(parsed);
  }
  function syncPreview(nextDescription: string, nextAccessories: string[], nextData = data) {
    setText(legendText(nextDescription, nextAccessories, nextData));
    setDetected({});
  }
  return <div className="space-y-4">
    <label htmlFor="vehicle-legend" className="block text-sm font-semibold text-cream">Colar legenda</label>
    <p className="text-sm text-muted">Cole a legenda inteira. Descrição, dados, preço, opcionais e facilidades são separados automaticamente. Não precisa colar placa, CPF, telefone, chassi nem RENAVAM: o que for pessoal sai do anúncio sozinho. Dados preenchidos são preservados; confira divergências abaixo.</p>
    {sensitiveMessage(sensitive) && <p role="alert" className="text-sm text-cream">{sensitiveMessage(sensitive)}</p>}
    <textarea id="vehicle-legend" name="vehicle-legend" rows={16} value={text} className={`${inputClass} resize-y`}
      placeholder="Cole aqui a legenda completa do anúncio."
      onChange={event => {
        applyCleanText(sanitizeLegendText(event.target.value).clean);
      }} />
    <AdminAiReview value={text} facts={identity ? { ...identity, description, accessories, data } : undefined} onApply={next => {
      applyCleanText(sanitizeLegendText(next).clean);
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
