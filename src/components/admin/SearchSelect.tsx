"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { inputClass } from "@/components/admin/ui";

export type SearchSelectItem = { id: string; label: string };

/**
 * Combobox de busca sob demanda para o painel (veículo/cliente na venda).
 * A lista só carrega quando o campo abre ou o texto muda — nada de select gigante.
 */
export function SearchSelect<T extends SearchSelectItem>({
  name,
  value,
  selectedLabel,
  onChange,
  loadOptions,
  placeholder,
  emptyText = "Nenhum resultado",
  noneOption,
  enabled = true,
  disabled = false,
}: {
  name: string;
  value: string;
  selectedLabel: string;
  onChange: (id: string, item: T | null) => void;
  loadOptions: (query: string) => Promise<T[]>;
  placeholder: string;
  emptyText?: string;
  noneOption?: SearchSelectItem;
  enabled?: boolean;
  disabled?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(loadOptions);
  loadRef.current = loadOptions;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const requestId = useRef(0);

  const closedLabel =
    selectedLabel ||
    (noneOption && value === noneOption.id ? noneOption.label : "");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!enabled || !open || disabled) return;
    const handle = window.setTimeout(async () => {
      const id = ++requestId.current;
      setLoading(true);
      try {
        const items = await loadRef.current(query);
        if (id !== requestId.current) return;
        setOptions(items);
        setHighlight(0);
      } catch {
        if (id !== requestId.current) return;
        setOptions([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 280);
    return () => window.clearTimeout(handle);
  }, [query, open, enabled, disabled]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const rows: SearchSelectItem[] = noneOption
    ? [noneOption, ...options]
    : options;

  function choose(id: string) {
    if (noneOption && id === noneOption.id) {
      onChange(noneOption.id, null);
    } else {
      onChange(id, options.find((row) => row.id === id) ?? null);
    }
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((current) => Math.min(current + 1, Math.max(rows.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && open && rows[highlight]) {
      event.preventDefault();
      choose(rows[highlight].id);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : closedLabel}
        onChange={(event) => {
          if (!open) setOpen(true);
          setQuery(event.target.value);
        }}
        onFocus={() => {
          if (!disabled) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={inputClass}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto border border-white/15 bg-ink shadow-xl"
        >
          {loading && options.length === 0 && !noneOption ? (
            <li className="px-3 py-3 text-sm text-muted">Buscando…</li>
          ) : rows.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">{emptyText}</li>
          ) : (
            rows.map((item, index) => (
              <li key={item.id} role="option" aria-selected={item.id === value}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(item.id)}
                  className={`flex min-h-[44px] w-full items-center px-3 py-2 text-left text-sm transition ${
                    index === highlight
                      ? "bg-brand/20 text-cream"
                      : item.id === value
                        ? "bg-white/5 text-cream"
                        : "text-cream/90 hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
