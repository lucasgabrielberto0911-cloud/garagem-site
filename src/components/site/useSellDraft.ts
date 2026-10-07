"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { parseSellDraft, SELL_DRAFT_KEY, sellDraftFields, serializeSellDraft } from "@/lib/sell-draft";
import { formatNumberBR, formatPhoneBR, formatPlateInput } from "@/lib/format";

export function useSellDraft(formRef: RefObject<HTMLFormElement | null>, active: boolean,
  setPhone: (value: string) => void, setKm: (value: string) => void, setPlate: (value: string) => void) {
  const [saved, setSaved] = useState(false);
  const [restored, setRestored] = useState(false);
  const [failure, setFailure] = useState<"save" | "erase" | null>(null);
  const enabled = useRef(false);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(() => {
    if (!enabled.current) return;
    try {
      if (pending.current) sessionStorage.setItem(SELL_DRAFT_KEY, pending.current);
      else sessionStorage.removeItem(SELL_DRAFT_KEY);
      setSaved(Boolean(pending.current)); setFailure(null);
    } catch { setSaved(false); setFailure("save"); }
  }, []);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    try { sessionStorage.removeItem(SELL_DRAFT_KEY); setFailure(null); }
    catch { setFailure("erase"); }
    setSaved(false); setRestored(false);
  }, []);

  useEffect(() => {
    if (!active) { enabled.current = false; clear(); return; }
    const form = formRef.current;
    if (!form) return;
    enabled.current = true;
    try {
      const fields = parseSellDraft(sessionStorage.getItem(SELL_DRAFT_KEY));
      if (fields) {
        for (const [name, value] of Object.entries(fields)) {
          const field = form.elements.namedItem(name);
          if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = value;
        }
        const digits = fields.km.replace(/\D/g, "");
        setPhone(formatPhoneBR(fields.phone)); setKm(digits ? formatNumberBR(Number(digits)) : ""); setPlate(formatPlateInput(fields.plate));
        pending.current = serializeSellDraft(fields);
        setSaved(true); setRestored(true);
      } else { sessionStorage.removeItem(SELL_DRAFT_KEY); }
    } catch { /* Formulário continua disponível mesmo sem armazenamento. */ }
    const flush = () => { if (timer.current) clearTimeout(timer.current); persist(); };
    window.addEventListener("pagehide", flush);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("pagehide", flush);
      // Preserva também o último caractere ao navegar imediatamente para uma ficha.
      if (enabled.current) {
        try {
          if (pending.current) sessionStorage.setItem(SELL_DRAFT_KEY, pending.current);
          else sessionStorage.removeItem(SELL_DRAFT_KEY);
        } catch { /* sem bloquear saída */ }
      }
      enabled.current = false;
    };
  }, [active, clear, formRef, persist, setPhone, setKm, setPlate]);

  function remember() {
    if (!enabled.current || !formRef.current) return;
    pending.current = serializeSellDraft(sellDraftFields(Object.fromEntries(new FormData(formRef.current).entries())));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, 350);
  }

  function discard() {
    clear();
    const form = formRef.current;
    if (form) for (const name of Object.keys(sellDraftFields({}))) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = "";
    }
    setPhone(""); setKm(""); setPlate("");
  }
  return { saved, restored, failed: Boolean(failure), failure, remember, discard };
}
