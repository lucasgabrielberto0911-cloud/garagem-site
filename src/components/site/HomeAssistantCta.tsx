"use client";

import { useState, type FormEvent } from "react";
import { IconChat, IconSend } from "@/components/site/icons";
import { requestSiteChat } from "@/lib/chat-open";
import { classifyChatIntent, trackChatEvent } from "@/lib/meta-pixel";

const SUGGESTIONS = ["Qual o mais econômico?", "Carros até R$ 60 mil", "Qual tem câmera de ré?"];

type Source = "home-hero-cta" | "home-hero-sugestao" | "home-hero-campo";

function openAssistant(source: Source, prompt?: string) {
  trackChatEvent("ChatHomeCtaClick", { source, intent: prompt ? classifyChatIntent(prompt) : undefined });
  requestSiteChat({ source, prompt, send: Boolean(prompt) });
}

/**
 * Botão do assistente no hero. No celular divide a linha com "Ver estoque"
 * para os cards do estoque continuarem na primeira dobra (LCP = foto do carro).
 * O chat continua preguiçoso (DeferredSiteChat): só baixa no clique.
 */
export function HomeAssistantButton() {
  return (
    <span className="assistant-cta-glow relative block w-full">
      <button
        type="button"
        onClick={() => openAssistant("home-hero-cta")}
        aria-label="Pergunte ao assistente"
        className="assistant-cta relative isolate inline-flex min-h-[52px] w-full items-center justify-center gap-2 overflow-hidden border border-brand/80 bg-asphalt px-3 py-4 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:border-brand hover:bg-ink touch-manipulation sm:gap-2.5 sm:px-7 sm:text-base lg:min-h-[44px] lg:py-2.5 lg:text-sm"
      >
        <span className="relative z-10 inline-flex items-center gap-2 sm:gap-2.5">
          <IconChat className="h-5 w-5 shrink-0 text-brand" />
          <span className="sm:hidden">Assistente</span>
          <span className="hidden sm:inline">Pergunte ao assistente</span>
        </span>
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-gradient" aria-hidden="true" />
      </button>
    </span>
  );
}

/** Sugestões (uma linha com rolagem no celular) + campo livre (só a partir do sm). */
export function HomeAssistantAsk() {
  const [text, setText] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = text.trim();
    if (prompt) {
      openAssistant("home-hero-campo", prompt);
      setText("");
    } else {
      openAssistant("home-hero-cta");
    }
  }

  return (
    <div className="w-full sm:border sm:border-white/10 sm:bg-asphalt/70 sm:p-3 lg:p-2">
      <p className="mb-1.5 hidden text-[13px] font-medium leading-tight text-muted sm:block lg:hidden">Pergunte qualquer coisa sobre nossos carros</p>
      <form onSubmit={submit} className="hidden items-center gap-2 sm:flex">
        <label htmlFor="home-assistant-input" className="sr-only">Pergunte qualquer coisa sobre nossos carros</label>
        <input
          id="home-assistant-input"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={300}
          enterKeyHint="send"
          autoComplete="off"
          placeholder="Ex.: tem SUV automático?"
          className="h-10 min-w-0 flex-1 border border-white/15 bg-ink px-3 text-[16px] text-cream placeholder:text-muted focus:border-brand focus:outline-none sm:text-sm"
        />
        <button type="submit" aria-label="Enviar pergunta ao assistente" className="flex h-10 w-10 shrink-0 items-center justify-center bg-brand text-cream transition hover:bg-[#c91418] touch-manipulation">
          <IconSend className="h-4 w-4" />
        </button>
      </form>
      <div
        role="group"
        aria-label="Pergunte qualquer coisa sobre nossos carros"
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:mt-1.5 sm:flex-wrap sm:overflow-visible sm:px-0 lg:flex-nowrap lg:gap-1 lg:overflow-x-auto"
      >
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => openAssistant("home-hero-sugestao", suggestion)}
            className="h-8 shrink-0 whitespace-nowrap rounded-full border border-white/15 bg-asphalt/60 px-3 text-[12px] lg:px-2.5 lg:text-[11.5px] leading-none text-cream transition hover:border-brand hover:bg-white/5 touch-manipulation"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
