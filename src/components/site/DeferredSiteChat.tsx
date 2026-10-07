"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { IconChat } from "@/components/site/icons";
import { CHAT_HELP_LABEL, SITE_CHAT_OPEN_EVENT, requestSiteChat } from "@/lib/chat-open";

/** A ajuda continua visível; a conversa só baixa quando o visitante pede. */
export function DeferredSiteChat() {
  const [Chat, setChat] = useState<ComponentType | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const mounted = useRef(true);
  const pending = useRef(false);
  const loaded = useRef(false);
  const attempt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async () => {
    if (pending.current || loaded.current) return;
    pending.current = true; setStatus("loading");
    const version = ++attempt.current;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error("Ajuda indisponível")), 15_000); timer.current = timeoutId; });
      const mod = await Promise.race([import("@/components/site/SiteChat"), timeout]);
      if (!mounted.current || version !== attempt.current) return;
      loaded.current = true; setChat(() => mod.SiteChat); setStatus("idle");
    } catch {
      if (mounted.current && version === attempt.current) setStatus("failed");
    } finally {
      clearTimeout(timeoutId);
      if (version === attempt.current) pending.current = false;
    }
  }, []);
  const cancelPending = useCallback(() => { mounted.current = false; attempt.current += 1; pending.current = false; if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    mounted.current = true;
    const requested = () => { void load(); };
    window.addEventListener(SITE_CHAT_OPEN_EVENT, requested);
    if (window.__garagemChatOpenRequest) requested();
    return () => { cancelPending(); window.removeEventListener(SITE_CHAT_OPEN_EVENT, requested); };
  }, [load, cancelPending]);
  if (Chat) return <Chat />;
  return <>
    <div className="site-chat pointer-events-none fixed z-[60] flex flex-col items-end">
      <button type="button" onClick={() => requestSiteChat({ source: "launcher" })} aria-label={CHAT_HELP_LABEL} aria-busy={status === "loading"}
        className="site-chat-launcher pointer-events-auto flex h-11 w-auto items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#F0282C] to-[#D0141A] pl-3.5 pr-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_12px_28px_-8px_rgba(232,24,28,0.65),0_2px_6px_rgba(0,0,0,0.35)] ring-1 ring-black/20 transition hover:-translate-y-0.5 active:translate-y-0 touch-manipulation sm:h-14 sm:gap-2.5 sm:pl-5 sm:pr-6">
        <IconChat className="h-[18px] w-[18px] sm:h-5 sm:w-5" /><span className="whitespace-nowrap font-display text-[12px] font-semibold sm:text-[14px]">{CHAT_HELP_LABEL}</span>
      </button>
    </div>
    {status !== "idle" ? <div role="status" data-chat-loading="" className="fixed left-4 right-4 top-[calc(84px+env(safe-area-inset-top,0px))] z-[70] mx-auto max-w-md rounded-xl border border-white/20 bg-ink px-4 py-3 text-sm leading-relaxed text-cream shadow-xl">
      {status === "loading" ? "Abrindo a ajuda…" : <><p>Não conseguimos abrir a ajuda agora.</p><button type="button" onClick={() => void load()} className="mt-2 min-h-11 rounded-lg border border-white/25 px-3 text-xs font-semibold hover:border-brand">Tentar abrir a ajuda novamente</button></>}
    </div> : null}
  </>;
}
