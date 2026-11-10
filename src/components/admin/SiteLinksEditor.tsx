"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Field, btn, inputClass } from "@/components/admin/ui";
import {
  MAX_SITE_LINKS,
  MAX_SITE_LINK_LABEL,
  type SiteLink,
} from "@/lib/site-links";

type Row = SiteLink & { key: number };

/** Lista de botões da página pública /links. Vai no formulário como `linksJson`. */
export function SiteLinksEditor({
  initial,
  error,
  onDirty,
}: {
  initial: readonly SiteLink[];
  error?: string;
  onDirty?: () => void;
}) {
  const nextKey = useRef(initial.length);
  const errorRef = useRef<HTMLParagraphElement>(null);
  // O campo escondido não recebe foco: leva o erro à vista.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center" });
  }, [error]);
  const [rows, setRowsState] = useState<Row[]>(() =>
    initial.map((link, key) => ({ ...link, key })),
  );

  function setRows(update: (current: Row[]) => Row[]) {
    onDirty?.();
    setRowsState(update);
  }

  function patch(key: number, change: Partial<SiteLink>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    setRows((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const payload = rows.map(({ label, href, visible }) => ({
    label,
    href,
    visible,
  }));

  return (
    <Card title="Página de links (/links)">
      <input type="hidden" name="linksJson" value={JSON.stringify(payload)} />
      <p className="mb-4 text-sm leading-relaxed text-muted">
        Estes botões aparecem em <span className="text-cream">/links</span>{" "}
        (o endereço da bio do Instagram). Dá para editar, reordenar, esconder ou
        incluir novos. Isto <strong className="text-cream">não</strong> troca o
        WhatsApp nem o Instagram oficiais do resto do site: só a página /links
        lê esta lista. Use um caminho do site (ex.: <code>/estoque</code>) ou
        uma URL completa com <code>https://</code>.
      </p>

      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li key={row.key} className="border border-white/10 p-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
              <Field label="Rótulo">
                <input
                  value={row.label}
                  maxLength={MAX_SITE_LINK_LABEL}
                  onChange={(event) =>
                    patch(row.key, { label: event.target.value })
                  }
                  placeholder="Ex.: Ver estoque"
                  className={inputClass}
                />
              </Field>
              <Field label="Endereço (URL ou /caminho)">
                <input
                  value={row.href}
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(event) =>
                    patch(row.key, { href: event.target.value })
                  }
                  placeholder="https://… ou /estoque"
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="inline-flex min-h-11 items-center gap-2 text-sm text-cream">
                <input
                  type="checkbox"
                  checked={row.visible}
                  onChange={(event) =>
                    patch(row.key, { visible: event.target.checked })
                  }
                  className="h-5 w-5 accent-[#E8181C]"
                />
                Visível em /links
              </label>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btn.outline}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Subir ${row.label || "link"}`}
                >
                  Subir
                </button>
                <button
                  type="button"
                  className={btn.outline}
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Descer ${row.label || "link"}`}
                >
                  Descer
                </button>
                <button
                  type="button"
                  className={btn.ghost}
                  onClick={() =>
                    setRows((current) =>
                      current.filter((item) => item.key !== row.key),
                    )
                  }
                  aria-label={`Remover ${row.label || "link"}`}
                >
                  Remover
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhum link. A página /links fica sem botões até você incluir algum.
        </p>
      ) : null}
      {error ? (
        <p ref={errorRef} role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={rows.length >= MAX_SITE_LINKS}
        onClick={() =>
          setRows((current) => [
            ...current,
            { key: nextKey.current++, label: "", href: "", visible: true },
          ])
        }
        className={`${btn.outline} mt-4`}
      >
        Incluir link
      </button>
      <p className="mt-2 text-xs text-muted">
        {rows.length} de {MAX_SITE_LINKS} links.
      </p>
    </Card>
  );
}
