"use client";

import { useEffect, useState } from "react";
import {
  getChatVehicleContext,
  subscribeChatVehicleContext,
} from "@/lib/chat-vehicle-context";
import { SITE_CHAT_OPEN_EVENT, requestSiteChat } from "@/lib/chat-open";

const SESSION_KEY = "garagem:chat-nudge";
const AFTER_MS = 20_000;
const SCROLL_RATIO = 0.6;

function alreadyShown() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Não disputa a tela com cookies nem com o aviso de instalar o app. */
function otherPromptOpen() {
  return !!document.querySelector('[aria-label="Consentimento de cookies"], [data-install-coach]');
}

/**
 * Balão único por sessão na ficha de carro à venda: depois de ~20 s ou 60% de
 * rolagem, convida a tirar dúvida no chat. Posição fixa e só opacidade
 * (sem CLS); o chat continua carregado só no clique.
 */
export function ChatNudge() {
  const [vehicle, setVehicle] = useState(getChatVehicleContext);
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeChatVehicleContext(setVehicle), []);

  const vehicleId = vehicle && !vehicle.sold ? vehicle.id : null;
  useEffect(() => {
    if (!vehicleId || alreadyShown()) return;
    const startedAt = Date.now();
    const check = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = scrollable > 0 && window.scrollY / scrollable >= SCROLL_RATIO;
      if (Date.now() - startedAt < AFTER_MS && !scrolled) return;
      if (otherPromptOpen()) return;
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* sem storage: o balão some ao fechar */
      }
      setVisible(true);
      stop();
    };
    const timer = window.setInterval(check, 2_000);
    const hide = () => setVisible(false);
    const stop = () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", check);
    };
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener(SITE_CHAT_OPEN_EVENT, hide);
    return () => {
      stop();
      window.removeEventListener(SITE_CHAT_OPEN_EVENT, hide);
      setVisible(false);
    };
  }, [vehicleId]);

  if (!visible || !vehicle) return null;
  return (
    <div
      role="status"
      data-chat-nudge=""
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-[55] ml-auto flex max-w-xs items-start gap-2 border border-white/15 bg-ink p-3 shadow-xl lg:bottom-24 lg:right-6"
    >
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          requestSiteChat({ source: "ficha-nudge", prompt: `Tenho dúvida sobre o ${vehicle.label}` });
        }}
        className="min-h-11 flex-1 text-left font-display text-sm font-semibold leading-snug text-cream"
      >
        Dúvida sobre {vehicle.label}? Pergunte aqui.
      </button>
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => setVisible(false)}
        className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center text-lg text-muted hover:text-cream"
      >
        ×
      </button>
    </div>
  );
}
