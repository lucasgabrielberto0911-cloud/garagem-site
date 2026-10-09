"use client";

import { cloneElement, isValidElement, useId, type Dispatch, type SetStateAction, type ReactNode } from "react";
import type { Facets, FilterValues } from "./StockFilters";
import { CATEGORY_FILTER_OPTIONS, BUDGET_CHIPS, MIN_PRICE_OPTIONS, MAX_PRICE_OPTIONS, KM_OPTIONS, selectClass, selectedOption, toggleAccessoryValue, AccessoryChips, Chip, formatCompactNumber } from "./StockFilterControls";
import { modelAfterBrandChange, modelFilterOptions, STOCK_SORT_OPTIONS } from "@/lib/stock-query";
import { formatBrandName, formatModelName } from "@/lib/format";
import { transmissionFilterOptions, transmissionFilterParam } from "@/lib/vehicle-display";
import { stockRangeError } from "@/lib/stock-range-validation";

export type StockFilterFieldsProps = {
  facets: Facets; draft: FilterValues; setDraft: Dispatch<SetStateAction<FilterValues>>; onApply: () => void;
};
export function StockFilterFields({ facets, draft, setDraft, onApply }: StockFilterFieldsProps) {
  const rangeError = stockRangeError(draft);
  /** Só os campos que existem dentro do painel do celular (a busca fica fora). */
  const draftFilterCount = [
    draft.category,
    draft.brand,
    draft.model,
    draft.transmission,
    draft.fuel,
    draft.color,
    draft.accessory,
    draft.laudo,
    draft.minPrice,
    draft.maxPrice,
    draft.minYear,
    draft.maxYear,
    draft.maxKm,
  ].filter(Boolean).length;

  return (
    <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
              <div className="grid grid-cols-2 gap-3">
                <MobileField label="Tipo">
                  <select
                    value={draft.category}
                    onChange={(event) =>
                      setDraft({ ...draft, category: event.target.value })
                    }
                    className={selectClass}
                  >
                    {CATEGORY_FILTER_OPTIONS.map((option) => (
                      <option key={option.value || "ambos"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </MobileField>
                <MobileField label="Câmbio">
                  <select
                    value={transmissionFilterParam(draft.transmission)}
                    onChange={(event) =>
                      setDraft({ ...draft, transmission: event.target.value })
                    }
                    className={selectClass}
                  >
                    <option value="">Qualquer</option>
                    {transmissionFilterOptions(
                      facets.transmissions,
                      draft.transmission,
                    ).map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </MobileField>
              </div>
              <MobileField label="Marca">
                <select
                  value={draft.brand}
                  onChange={(event) => {
                    const brand = event.target.value;
                    setDraft({
                      ...draft,
                      brand,
                      model: modelAfterBrandChange(facets.models, brand, draft.model),
                    });
                  }}
                  className={selectClass}
                >
                  <option value="">Todas as marcas</option>
                  {facets.brands.map((item) => (
                    <option key={item} value={item}>
                      {formatBrandName(item)}
                    </option>
                  ))}
                </select>
              </MobileField>
              <MobileField label="Modelo">
                <select
                  value={selectedOption(
                    modelFilterOptions(facets.models, draft.brand, draft.model),
                    draft.model,
                  )}
                  onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                  className={selectClass}
                >
                  <option value="">Todos os modelos</option>
                  {modelFilterOptions(facets.models, draft.brand, draft.model).map((item) => (
                    <option key={item} value={item}>
                      {formatModelName(item)}
                    </option>
                  ))}
                </select>
              </MobileField>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
                  Faixa de preço
                </p>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_CHIPS.map((chip) => {
                    const active =
                      (draft.minPrice || "") === chip.minPrice &&
                      (draft.maxPrice || "") === chip.maxPrice;
                    return (
                      <Chip
                        key={`sheet-${chip.label}`}
                        active={active}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            minPrice: active ? "" : chip.minPrice,
                            maxPrice: active ? "" : chip.maxPrice,
                          })
                        }
                      >
                        {chip.label}
                      </Chip>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MobileField label="Preço mínimo">
                  <RangeSelect value={draft.minPrice} options={MIN_PRICE_OPTIONS} fallbackLabel={(value) => `R$ ${formatCompactNumber(value)}`} emptyLabel="Sem mínimo" onChange={(value) => setDraft({ ...draft, minPrice: value })} />
                </MobileField>
                <MobileField label="Preço máximo">
                  <RangeSelect value={draft.maxPrice} options={MAX_PRICE_OPTIONS} fallbackLabel={(value) => `R$ ${formatCompactNumber(value)}`} emptyLabel="Sem máximo" onChange={(value) => setDraft({ ...draft, maxPrice: value })} />
                </MobileField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MobileField label="Ano mínimo">
                  <RangeSelect value={draft.minYear} options={facets.years.map(year => ({ value: String(year), label: String(year) }))} fallbackLabel={(value) => value} emptyLabel="Qualquer" onChange={(value) => setDraft({ ...draft, minYear: value })} />
                </MobileField>
                <MobileField label="Ano máximo">
                  <RangeSelect value={draft.maxYear} options={facets.years.map(year => ({ value: String(year), label: String(year) }))} fallbackLabel={(value) => value} emptyLabel="Qualquer" onChange={(value) => setDraft({ ...draft, maxYear: value })} />
                </MobileField>
              </div>
              <MobileField label="Quilometragem máxima">
                <select
                  value={draft.maxKm}
                  onChange={(event) => setDraft({ ...draft, maxKm: event.target.value })}
                  className={selectClass}
                >
                  {KM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </MobileField>
              <details className="border border-white/10 bg-asphalt/30 px-3.5 py-1">
                <summary className="flex min-h-[48px] cursor-pointer list-none items-center font-display text-xs font-semibold uppercase tracking-wider text-cream [&::-webkit-details-marker]:hidden">
                  Mais opções
                  <span className="ml-auto text-[10px] font-medium normal-case tracking-wide text-muted">
                    cor e combustível
                  </span>
                </summary>
                <div className="space-y-5 pb-4 pt-1">
                  <MobileField label="Ordenar">
                    <select
                      value={draft.sort}
                      onChange={(event) =>
                        setDraft({ ...draft, sort: event.target.value })
                      }
                      className={selectClass}
                    >
                      {STOCK_SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </MobileField>
                  <MobileField label="Combustível">
                    <select
                      value={draft.fuel}
                      onChange={(event) => setDraft({ ...draft, fuel: event.target.value })}
                      className={selectClass}
                    >
                      <option value="">Todos os combustíveis</option>
                      {facets.fuels.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </MobileField>
                  {(facets.colors ?? []).length > 0 ? (
                    <MobileField label="Cor">
                      <select
                        value={draft.color}
                        onChange={(event) => setDraft({ ...draft, color: event.target.value })}
                        className={selectClass}
                      >
                        <option value="">Todas as cores</option>
                        {(facets.colors ?? []).map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </MobileField>
                  ) : null}
                  {(facets.accessories ?? []).length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
                        Acessórios
                      </p>
                      <AccessoryChips
                        options={facets.accessories ?? []}
                        value={draft.accessory}
                        onToggle={(name) =>
                          setDraft({
                            ...draft,
                            accessory: toggleAccessoryValue(draft.accessory, name),
                          })
                        }
                      />
                    </div>
                  ) : null}
                  <label className="flex min-h-[48px] cursor-pointer items-center gap-2.5 border border-white/10 bg-asphalt px-3.5 text-sm text-cream">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.laudo)}
                      onChange={(event) =>
                        setDraft({ ...draft, laudo: event.target.checked ? "1" : "" })
                      }
                      className="h-4 w-4 accent-brand"
                    />
                    Com vistoria da loja
                  </label>
                </div>
              </details>
            </div>
            <div className="shrink-0 border-t border-white/10 bg-ink px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-5">
              {rangeError ? <p role="alert" className="mb-2 text-sm text-brand">{rangeError}</p> : draftFilterCount > 0 ? <p role="status" className="mb-2 text-xs text-muted">{draftFilterCount} {draftFilterCount === 1 ? "filtro selecionado" : "filtros selecionados"}</p> : null}
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      category: "",
                      brand: "",
                      model: "",
                      transmission: "",
                      fuel: "",
                      color: "",
                      accessory: "",
                      laudo: "",
                      minPrice: "",
                      maxPrice: "",
                      minYear: "",
                      maxYear: "",
                      maxKm: "",
                    })
                  }
                  className="min-h-[52px] border border-white/15 px-5 font-display text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (rangeError) return;
                    onApply();
                  }}
                  disabled={Boolean(rangeError)}
                  className="min-h-[52px] bg-brand px-3 font-display text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                >
                  Ver veículos
                </button>
              </div>
            </div>
    </>
  );
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </label>
      {isValidElement<{ id?: string }>(children) ? cloneElement(children, { id }) : children}
    </div>
  );
}

function RangeSelect({ id, value, options, fallbackLabel, emptyLabel, onChange }: {
  id?: string;
  value: string;
  options: readonly { value: string; label: string }[];
  fallbackLabel: (value: string) => string;
  emptyLabel: string;
  onChange: (value: string) => void;
}) {
  const choices = options.filter(option => option.value);
  if (value && !choices.some(option => option.value === value)) {
    choices.push({ value, label: fallbackLabel(value) });
  }
  return <select id={id} value={value} onChange={event => onChange(event.target.value)} className={selectClass + " !px-2.5"}>
    <option value="">{emptyLabel}</option>
    {choices.map(option => <option key={option.value} value={option.value}>{fallbackLabel(option.value)}</option>)}
  </select>;
}
