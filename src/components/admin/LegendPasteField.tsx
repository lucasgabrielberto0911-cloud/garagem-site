"use client";

import { useId, useRef, useState } from "react";
import { fold, parseLegend, type LegendParseResult } from "@/lib/legend-parser";
import {
  normalizeAccessories,
  type VehicleCategory,
} from "@/lib/vehicle-accessories";
import { btn, inputClass } from "@/components/admin/ui";

type Props = {
  category: VehicleCategory;
  description: string;
  onPendingChange?: (pending: boolean) => void;
  onApply: (selected: string[], manual: string[], description?: string) => boolean;
};

export function LegendPasteField({ category, description, onApply, onPendingChange }: Props) {
  const id = useId();
  const [text, setText] = useState("");
  const [analysis, setResult] = useState<(LegendParseResult & { category: VehicleCategory }) | null>(null);
  const result = analysis?.category === category ? analysis : null;
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState<string[]>([]);
  const [discarded, setDiscarded] = useState<string[]>([]);
  const [useDescription, setUseDescription] = useState(false);
  const [applyError, setApplyError] = useState("");
  const prevTextRef = useRef("");

  function analyze() {
    const parsed = parseLegend(text, category);
    const excludedKeys = new Set([...manual, ...discarded].map((m) => fold(m).replace(/\s+/g, " ").trim()));
    const listed = (parsed.listed ?? []).filter((item) => !excludedKeys.has(fold(item).replace(/\s+/g, " ").trim()));
    setManual((current) => [...current, ...listed]);
    const listedKeys = new Set(listed.map((item) => fold(item).replace(/\s+/g, " ").trim()));
    setResult({ ...parsed, category, unmatched: parsed.unmatched.filter((item) => {
      const key = fold(item).replace(/\s+/g, " ").trim();
      return !excludedKeys.has(key) && !listedKeys.has(key);
    })});
    if (text === prevTextRef.current && analysis?.category === category) {
      setSelected((current) => current.filter((item) => parsed.matched.includes(item)));
    } else {
      setSelected(parsed.matched);
      prevTextRef.current = text;
    }
    setApplyError("");
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
          onPendingChange?.(Boolean(event.target.value.trim()));
          prevTextRef.current = "";
          setResult(null);
          setManual([]);
          setDiscarded([]);
          setSelected([]);
          setUseDescription(false);
          setApplyError("");
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
                        onClick={() => {
                          setDiscarded((current) => [...current, item]);
                          setResult({ ...result, unmatched: result.unmatched.filter((value) => value !== item) });
                        }}>
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
              <p className="mb-2 text-sm text-cream">Opcionais livres selecionados</p>
              <ul className="flex flex-wrap gap-2">
                {manual.map((item) => (
                  <li key={item} className="flex max-w-full items-center border border-white/15 pl-3 text-sm text-cream">
                    <span className="break-words">{item}</span>
                    <button type="button" aria-label={`Remover ${item}`}
                      className="min-h-[44px] min-w-[44px] shrink-0 text-muted hover:text-brand"
                      onClick={() => {
                        setManual((current) => current.filter((value) => value !== item));
                        setDiscarded((current) => [...current, item]);
                      }}>×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-cream">
            <input type="checkbox" checked={useDescription}
              onChange={(event) => setUseDescription(event.target.checked)}
              className="h-4 w-4 shrink-0 accent-brand" />
            Usar texto limpo como descrição
          </label>
          <button type="button" className={`${btn.outline} min-h-[44px] w-full sm:w-auto`}
            onClick={() => {
              const replaceDescription = useDescription && (!description.trim() || description === result.description ||
                window.confirm("Já existe uma descrição. Substituir pela legenda?"));
              if (!onApply(selected, manual, replaceDescription ? result.description : undefined)) {
                setApplyError("O limite é de 60 acessórios. Desmarque itens ou remova acessórios existentes antes de aplicar.");
                return;
              }
              setText("");
              onPendingChange?.(false);
              prevTextRef.current = "";
              setResult(null);
              setSelected([]);
              setManual([]);
              setDiscarded([]);
              setUseDescription(false);
              setApplyError("");
            }}>
            Aplicar
          </button>
          {applyError && <p role="alert" className="text-sm text-brand">{applyError}</p>}
        </div>
      )}
    </div>
  );
}
