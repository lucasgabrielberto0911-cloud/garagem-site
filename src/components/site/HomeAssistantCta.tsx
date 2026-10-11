"use client";

import { useState, type FormEvent } from "react";
import { IconChat, IconSend } from "@/components/site/icons";
import { requestSiteChat } from "@/lib/chat-open";
import { classifyChatIntent, trackChatEvent } from "@/lib/meta-pixel";

const SUGGESTIONS = ["Qual o mais econômico?", "Carros até R$ 60 mil", "Qual tem câmera de ré?"];

/**
 * Assistente em destaque no hero da home: botão + campo com sugestões.
 * O chat continua preguiçoso (DeferredSiteChat): só baixa quando o visitante clica.
 */
export function HomeAssistantCta() {
  const [text, setText] = useState("");

  function open(source: "home-hero-cta" | "home-hero-sugestao" | "home-hero-campo", prompt?: string) {
    trackChatEvent("ChatHomeCtaClick", { source, intent: prompt ? classifyChatIntent(prompt) : undefined });
    requestSiteChat({ source, prompt, send: Boolean(prompt) });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = text.trim();
    if (prompt) {
      open("home-hero-campo", prompt);
      setText("");
    } else {
      open("home-hero-cta");
    }
  }

  return (
    <div className="flex w-full flex-col gap-2.5">
      <span className="assistant-cta-glow relative block w-full">
        <button
          type="button"
          onClick={() => open("home-hero-cta")}
          className="assistant-cta relative isolate inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 overflow-hidden border border-brand/80 bg-asphalt px-7 py-4 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:border-brand hover:bg-ink touch-manipulation sm:text-base"
        >
          <span className="relative z-10 inline-flex items-center gap-2.5">
            <IconChat className="h-5 w-5 text-brand" />
            Pergunte ao assistente
          </span>
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-gradient" aria-hidden="true" />
        </button>
      </span>

      <div className="border border-white/10 bg-asphalt/70 p-2 sm:p-3">
        <p className="mb-1.5 text-[12px] font-medium leading-tight text-muted sm:text-[13px]">Pergunte qualquer coisa sobre nossos carros</p>
        <form onSubmit={submit} className="flex items-center gap-2">
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
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => open("home-hero-sugestao", suggestion)}
              className="min-h-8 shrink-0 whitespace-nowrap rounded-full border border-white/15 px-3 py-1 text-[12px] text-cream transition hover:border-brand hover:bg-white/5 touch-manipulation"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
