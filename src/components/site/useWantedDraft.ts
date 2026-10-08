"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { parseWantedDraft, serializeWantedDraft, wantedDraftFields, WANTED_DRAFT_KEY, type WantedDraftFields } from "@/lib/wanted-draft";

export function useWantedDraft(formRef: RefObject<HTMLFormElement | null>, active: boolean,
  context: string, restoreControlled: (fields: WantedDraftFields) => void) {
  const [saved, setSaved] = useState(false);
  const [restored, setRestored] = useState(false);
  const [failed, setFailed] = useState(false);
  const enabled = useRef(false);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreRef = useRef(restoreControlled);
  useEffect(() => { restoreRef.current = restoreControlled; }, [restoreControlled]);

  const persist = useCallback(() => {
    if (!enabled.current) return;
    try {
      if (pending.current) sessionStorage.setItem(WANTED_DRAFT_KEY, pending.current);
      else sessionStorage.removeItem(WANTED_DRAFT_KEY);
      setSaved(Boolean(pending.current)); setFailed(false);
    } catch { setSaved(false); setFailed(true); }
  }, []);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    try { sessionStorage.removeItem(WANTED_DRAFT_KEY); setFailed(false); }
    catch { setFailed(true); }
    setSaved(false); setRestored(false);
  }, []);

  useEffect(() => {
    if (!active || !formRef.current) { enabled.current = false; return; }
    const form = formRef.current;
    enabled.current = true;
    try {
      const fields = parseWantedDraft(sessionStorage.getItem(WANTED_DRAFT_KEY), context);
      if (fields) {
        for (const [name, value] of Object.entries(fields)) {
          const field = form.elements.namedItem(name);
          if (field instanceof HTMLInputElement) field.value = value;
        }
        restoreRef.current(fields);
        pending.current = serializeWantedDraft(fields, context);
        setSaved(true); setRestored(true);
      } else sessionStorage.removeItem(WANTED_DRAFT_KEY);
    } catch { /* Preenchimento e envio continuam disponíveis. */ }
    const flush = () => { if (timer.current) clearTimeout(timer.current); persist(); };
    window.addEventListener("pagehide", flush);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("pagehide", flush);
      if (enabled.current) {
        try {
          if (pending.current) sessionStorage.setItem(WANTED_DRAFT_KEY, pending.current);
          else sessionStorage.removeItem(WANTED_DRAFT_KEY);
        } catch { /* sem impedir a navegação */ }
      }
      enabled.current = false;
    };
  }, [active, context, formRef, persist]);

  function remember() {
    if (!enabled.current || !formRef.current) return;
    pending.current = serializeWantedDraft(wantedDraftFields(Object.fromEntries(new FormData(formRef.current).entries())), context);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, 350);
  }
  function discard() {
    clear();
    const fields = wantedDraftFields({});
    for (const name of Object.keys(fields)) {
      const field = formRef.current?.elements.namedItem(name);
      if (field instanceof HTMLInputElement) field.value = "";
    }
    const consent = formRef.current?.elements.namedItem("consent");
    if (consent instanceof HTMLInputElement) consent.checked = false;
    restoreRef.current(fields);
  }
  return { saved, restored, failed, remember, discard, clear };
}
