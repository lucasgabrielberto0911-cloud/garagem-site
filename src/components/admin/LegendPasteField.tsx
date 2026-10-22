"use client";

import { useId, useState } from "react";
import { parseLegend, type LegendParseResult } from "@/lib/legend-parser";
import {
  filterAccessoriesForCategory,
  normalizeAccessories,
  type VehicleCategory,
} from "@/lib/vehicle-accessories";
import { btn, inputClass } from "@/components/admin/ui";

type Props = {
  category: VehicleCategory;
  accessories: string[];
  description: string;
  onApply: (accessories: string[], description?: string) => void;
};

export function LegendPasteField({ category, accessories, description, onApply }: Props) {
  const id = useId();
  const [text, setText] = useState("");
  const [result, setResult] = useState<LegendParseResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState<string[]>([]);
  const [useDescription, setUseDescription] = useState(false);

  function analyze() {
    const parsed = parseLegend(text, category);
    setResult(parsed);
    setSelected(parsed.matched);
    setManual([]);
  }

  return (
    <div className="mb-5 space-y-3 border border-white/10 bg-ink p-3 sm:p-4">
      <label htmlFor={id} className="block text-sm font-medium text-cream">
        Colar legenda
      </label>
      <textarea
        id={id}
        rows={4}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setResult(null);
          setUseDescription(false);
        }}
        placeholder="Cole a legenda e confira os itens antes de aplicar."
        className={`${inputClass} min-h-[44px] resize-y`}
      />
      <button type="button" onClick={analyze} disabled={!text.trim()}
        className={`${btn.outline} min-h-[44px] w-full sm:w-auto`}>
        Analisar
      </button>

      {result && (
        <div className="space-y-4" aria-live="polite">
          <div>
            <p className="mb-2 text-sm text-cream">Reconhecidos ({result.matched.length})</p>
            <div className="flex flex-wrap gap-2">
              {result.matched.map((item) => (
                <label key={item} className="flex min-h-[44px] max-w-full cursor-pointer items-center gap-2 border border-white/15 px-3 py-2 text-sm text-cream">
                  <input type="checkbox" checked={selected.includes(item)}
                    onChange={(event) => setSelected((current) => event.target.checked
                      ? [...current, item] : current.filter((value) => value !== item))}
                    className="h-4 w-4 shrink-0 accent-brand" />
                  <span className="break-words">{item}</span>
                </label>
              ))}
            </div>
          </div>

          {result.unmatched.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-cream">Não reconhecidos</p>
              <ul className="space-y-3">
                {result.unmatched.map((item) => (
                  <li key={item} className="space-y-2 border-t border-white/10 pt-3">
                    <p className="break-words text-sm text-muted">{item}</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" className={`${btn.outline} min-h-[44px]`}
                        onClick={() => {
                          setManual((current) => normalizeAccessories([...current, item]));
                          setResult({ ...result, unmatched: result.unmatched.filter((value) => value !== item) });
                        }}>
                        Adicionar como ponto manual
                      </button>
                      <button type="button" className={`${btn.outline} min-h-[44px]`}
                        onClick={() => setResult({ ...result, unmatched: result.unmatched.filter((value) => value !== item) })}>
                        Descartar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {manual.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-cream">Pontos manuais selecionados</p>
              <ul className="flex flex-wrap gap-2">
                {manual.map((item) => (
                  <li key={item} className="flex max-w-full items-center border border-white/15 pl-3 text-sm text-cream">
                    <span className="break-words">{item}</span>
                    <button type="button" aria-label={`Remover ${item}`}
                      className="min-h-[44px] min-w-[44px] shrink-0 text-muted hover:text-brand"
                      onClick={() => setManual((current) => current.filter((value) => value !== item))}>×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-cream">
            <input type="checkbox" checked={useDescription}
              onChange={(event) => setUseDescription(event.target.checked)}
              className="h-4 w-4 shrink-0 accent-brand" />
            Usar legenda como descrição
          </label>
          <button type="button" className={`${btn.outline} min-h-[44px] w-full sm:w-auto`}
            onClick={() => {
              if (useDescription && description.trim() && description !== result.fullText &&
                !window.confirm("Já existe uma descrição. Substituir pela legenda?")) return;
              onApply(normalizeAccessories(filterAccessoriesForCategory(
                [...accessories, ...selected, ...manual], category,
              )), useDescription ? result.fullText : undefined);
              setResult(null);
              setUseDescription(false);
            }}>
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
