"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
const SearchDialog = dynamic(() => import("./AdminSearchDialog"), { ssr: false });
export function AdminSearch() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && trigger.current?.getClientRects().length) {
        event.preventDefault(); setOpen(true);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  function close() { setOpen(false); trigger.current?.focus(); }
  return <>
    <button ref={trigger} type="button" aria-label="Buscar no painel" title="Buscar no painel (Ctrl ou ⌘ + K)" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/5 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path strokeLinecap="round" d="m16 16 5 5"/></svg>
    </button>
    {open ? <SearchDialog onClose={close} /> : null}
  </>;
}
