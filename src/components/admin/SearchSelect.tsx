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
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
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
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  value: string;
  selectedLabel: string;
  onChange: (id: string, item: T | null) => void;
  loadOptions: (query: string, signal?: AbortSignal) => Promise<T[]>;
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
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  const closedLabel =
    selectedLabel ||
    (noneOption && value === noneOption.id ? noneOption.label : "");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!enabled || !open || disabled) return;
    const id = ++requestId.current;
    const controller = new AbortController();
    setOptions([]);
    setError(false);
    setLoading(true);
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const items = await loadRef.current(query, controller.signal);
        if (controller.signal.aborted || id !== requestId.current) return;
        setOptions(items);
        setHighlight(0);
      } catch {
        if (controller.signal.aborted || id !== requestId.current) return;
        setOptions([]);
        setError(true);
      } finally {
        if (!controller.signal.aborted && id === requestId.current)
          setLoading(false);
      }
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [query, open, enabled, disabled, retry]);

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

  useEffect(() => {
    if (open)
      document
        .getElementById(`${listId}-${highlight}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [highlight, open, listId]);

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
      setHighlight((current) =>
        Math.min(current + 1, Math.max(rows.length - 1, 0)),
      );
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
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && !loading && !error && rows[highlight]
            ? `${listId}-${highlight}`
            : undefined
        }
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
          {error ? (
            <li role="presentation" className="p-3 text-sm">
              <p role="alert">A busca falhou. Confira a conexão.</p>
              <button
                type="button"
                className="mt-2 min-h-11 text-brand"
                onClick={() => setRetry((r) => r + 1)}
              >
                Tentar novamente
              </button>
            </li>
          ) : loading && options.length === 0 && !noneOption ? (
            <li className="px-3 py-3 text-sm text-muted">Buscando…</li>
          ) : rows.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">{emptyText}</li>
          ) : (
            rows.map((item, index) => (
              <li
                id={`${listId}-${index}`}
                key={item.id}
                role="option"
                aria-selected={item.id === value}
              >
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
