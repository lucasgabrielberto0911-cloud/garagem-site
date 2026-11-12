"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { IconClose } from "@/components/site/icons";
import { handleFocusTrap } from "@/lib/focus-trap";
import { inputClass, btn } from "@/components/admin/ui";
import { normalizeAdminSearch, type AdminSearchResult } from "@/lib/admin-global-search";

export default function AdminSearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const query = normalizeAdminSearch(term);
  const [data, setData] = useState<AdminSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dialog = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const current = data?.query === query ? data : null;
  const groups = current?.groups.filter(group => group.items.length > 0) ?? [];
  const flatItems = groups.flatMap(group => group.items);
  const activeItem = activeIndex >= 0 ? flatItems[activeIndex] ?? null : null;
  const navRef = useRef({ flatItems, activeIndex });
  navRef.current = { flatItems, activeIndex };

  useEffect(() => {
    setActiveIndex(-1);
  }, [query, current]);

  useEffect(() => {
    if (activeIndex >= 0) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.setProperty("overflow", "hidden");
    field.current?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
      const { flatItems: items, activeIndex: currentIndex } = navRef.current;
      if (items.length > 0 && event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex(currentIndex < 0 ? 0 : (currentIndex + 1) % items.length);
        return;
      }
      if (items.length > 0 && event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(currentIndex <= 0 ? items.length - 1 : currentIndex - 1);
        return;
      }
      if (event.key === "Enter" && currentIndex >= 0 && items[currentIndex]) {
        const target = event.target as HTMLElement | null;
        if (target?.tagName !== "A" && target?.tagName !== "BUTTON") {
          event.preventDefault();
          router.push(items[currentIndex].href);
          closeRef.current();
          return;
        }
      }
      if (dialog.current) handleFocusTrap(event, dialog.current);
    }
    window.addEventListener("keydown", key);
    return () => {
      if (previous) document.body.style.setProperty("overflow", previous);
      else document.body.style.removeProperty("overflow");
      window.removeEventListener("keydown", key);
    };
  }, [router]);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false);
    if (query.length < 2) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetch(`/api/admin/busca?q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: "no-store" })
        .then(async response => { if (!response.ok) throw new Error("busca"); return await response.json() as AdminSearchResult; })
        .then(result => { if (!controller.signal.aborted) setData(result); })
        .catch(() => { if (!controller.signal.aborted) setError(true); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, retry]);
  return createPortal(<div className="fixed inset-0 z-[70]">
    <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Busca do painel" className="absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top,0px))] mx-auto flex max-h-[calc(100dvh-6rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] max-w-xl flex-col overflow-hidden rounded-xl border border-white/15 bg-ink shadow-2xl sm:top-12">
      <div className="shrink-0 border-b border-white/10 p-3">
        <div className="mb-2 flex items-center justify-between"><label htmlFor="admin-global-query" className="font-display text-lg font-semibold">Buscar no painel</label><button type="button" aria-label="Fechar busca" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-white/5"><IconClose className="h-5 w-5" /></button></div>
        <input ref={field} id="admin-global-query" type="search" value={term} onChange={event => setTerm(event.target.value)} maxLength={120} autoComplete="off" placeholder="Placa, modelo ou nome do cliente" className={inputClass} aria-describedby="admin-search-hint" aria-controls="admin-search-results" aria-activedescendant={activeItem ? `admin-search-item-${activeItem.id}` : undefined} />
        <p id="admin-search-hint" className="mt-2 text-xs text-muted">Veículos, vendas, clientes e contatos · a partir de 2 caracteres · use ↑ ↓ e Enter</p>
      </div>
      <div id="admin-search-results" className="min-h-0 overflow-y-auto overscroll-contain p-3" aria-busy={loading}>
        <p role="status" className="sr-only">{loading ? "Buscando…" : current ? `${groups.reduce((sum, group) => sum + group.items.length, 0)} resultados exibidos.` : "Digite para buscar."}</p>
        {query.length < 2 ? <p className="py-5 text-sm text-muted">Digite uma placa, um modelo ou o nome do cliente.</p> : loading ? <p className="py-5 text-sm text-muted">Buscando…</p> : error ? <div role="alert" className="space-y-3 py-4 text-sm"><p>Não foi possível buscar.</p><button type="button" onClick={() => setRetry(value => value + 1)} className={btn.outline}>Tentar novamente</button></div> : current && groups.length === 0 ? <p className="py-5 text-sm text-muted">Nenhum resultado. Confira a escrita ou tente outro termo.</p> : groups.map(group => <section key={group.kind} className="mb-5 last:mb-0" aria-label={group.label}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{group.label}</h3>
          <ul className="space-y-1">{group.items.map(item => {
            const idx = flatItems.indexOf(item);
            const isSelected = idx === activeIndex;
            return <li key={item.id}><Link id={`admin-search-item-${item.id}`} ref={element => { itemRefs.current[idx] = element; }} prefetch={false} onClick={onClose} onMouseEnter={() => setActiveIndex(idx)} href={item.href} aria-selected={isSelected} className={`block rounded-lg border px-3 py-2.5 transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${isSelected ? "border-brand/60 bg-white/10" : "border-white/10"}`}><p className="break-words text-sm font-semibold">{item.title}</p><p className="mt-1 break-words text-xs leading-relaxed text-muted">{item.detail}</p></Link></li>;
          })}</ul>
          {group.more ? <p className="mt-3 text-xs leading-relaxed text-muted">Há mais {group.label.toLowerCase()}. Refine a busca com o modelo, a placa ou o nome completo.</p> : null}
        </section>)}
      </div>
    </div>
  </div>, document.body);
}
