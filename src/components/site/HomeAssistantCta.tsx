"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { IconChat, IconSend } from "@/components/site/icons";
import { requestSiteChat } from "@/lib/chat-open";
import { classifyChatIntent, trackChatEvent } from "@/lib/meta-pixel";

const SUGGESTIONS = [
  "Qual o mais econômico?",
  "Carros até R$ 60 mil",
  "Qual tem câmera de ré?",
] as const;

const HOLD_MS = 2600;
const FADE_MS = 220;
const TYPE_CHAR_MS = 38;

type Source = "home-hero-cta" | "home-hero-campo";

function openAssistant(source: Source, prompt?: string) {
  trackChatEvent("ChatHomeCtaClick", { source, intent: prompt ? classifyChatIntent(prompt) : undefined });
  requestSiteChat({ source, prompt, send: Boolean(prompt) });
}

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getServerReducedMotion() {
  return false;
}

/**
 * Botão leve do assistente no hero (do tablet em diante: no celular o topo fica
 * só com WhatsApp e "Ver estoque", e o assistente segue no botão Ajuda do cabeçalho).
 * O chat continua preguiçoso (DeferredSiteChat): só baixa no clique.
 */
export function HomeAssistantButton() {
  return (
    <button
      type="button"
      onClick={() => openAssistant("home-hero-cta")}
      aria-label="Pergunte ao assistente"
      className="group inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-1.5 font-display text-xs font-semibold uppercase tracking-wide text-cream/85 transition hover:bg-white/[0.06] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand touch-manipulation sm:text-[13px]"
    >
      <IconChat className="h-4 w-4 shrink-0 text-brand-light transition-transform group-hover:scale-105" />
      <span className="underline decoration-white/25 underline-offset-4 transition-colors group-hover:decoration-brand-light">
        Pergunte ao assistente
      </span>
    </button>
  );
}

/** Campo integrado ao hero (só a partir do sm) com sugestões animadas no placeholder. */
export function HomeAssistantAsk() {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [charCount, setCharCount] = useState<number>(SUGGESTIONS[0].length);
  const [phase, setPhase] = useState<"hold" | "fadeOut" | "typing">("hold");

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  );

  const animatePlaceholder = !reducedMotion && !focused && text.length === 0;

  useEffect(() => {
    if (!animatePlaceholder) return;

    if (phase === "hold") {
      const id = window.setTimeout(() => setPhase("fadeOut"), HOLD_MS);
      return () => window.clearTimeout(id);
    }

    if (phase === "fadeOut") {
      const id = window.setTimeout(() => {
        setSuggestionIndex((current) => (current + 1) % SUGGESTIONS.length);
        setCharCount(0);
        setPhase("typing");
      }, FADE_MS);
      return () => window.clearTimeout(id);
    }

    const target = SUGGESTIONS[suggestionIndex];
    const id = window.setTimeout(() => {
      if (charCount + 1 >= target.length) {
        setCharCount(target.length);
        setPhase("hold");
      } else {
        setCharCount((current) => current + 1);
      }
    }, TYPE_CHAR_MS);
    return () => window.clearTimeout(id);
  }, [animatePlaceholder, phase, charCount, suggestionIndex]);

  const currentSuggestion = SUGGESTIONS[suggestionIndex];
  const displayedPlaceholder = reducedMotion
    ? SUGGESTIONS[0]
    : focused
      ? currentSuggestion
      : phase === "typing"
        ? currentSuggestion.slice(0, charCount)
        : currentSuggestion;

  const isFading = animatePlaceholder && phase === "fadeOut";

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
    <div className="w-full">
      <label
        htmlFor="home-assistant-input"
        className="mb-1.5 hidden text-[13px] font-medium leading-tight text-cream/80 sm:block cursor-pointer"
      >
        Pergunte qualquer coisa sobre nossos carros
      </label>
      <form
        onSubmit={submit}
        className="hidden items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] p-1 transition focus-within:border-brand/70 focus-within:bg-white/[0.06] focus-within:ring-1 focus-within:ring-brand/50 sm:flex"
      >
        <div className="relative flex min-w-0 flex-1 items-center">
          <input
            id="home-assistant-input"
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={() => {
              setFocused(true);
              setPhase("hold");
              setCharCount(SUGGESTIONS[suggestionIndex].length);
            }}
            onBlur={() => setFocused(false)}
            maxLength={300}
            enterKeyHint="send"
            autoComplete="off"
            className="h-11 w-full min-w-0 bg-transparent px-3 text-[16px] text-cream focus:outline-none sm:text-sm"
          />
          {text.length === 0 ? (
            <span
              aria-hidden="true"
              data-assistant-placeholder=""
              data-motion={animatePlaceholder ? "animated" : "static"}
              className={`pointer-events-none absolute inset-y-0 left-3 right-2 flex items-center text-sm text-cream/55 transition-opacity duration-200 ${
                isFading ? "opacity-0" : "opacity-100"
              }`}
            >
              <span className="truncate">{displayedPlaceholder}</span>
              {animatePlaceholder ? (
                <span className="assistant-placeholder-caret ml-0.5 inline-block h-4 w-[1.5px] shrink-0 bg-brand-light/85" />
              ) : null}
            </span>
          ) : null}
        </div>
        <button
          type="submit"
          aria-label="Enviar pergunta ao assistente"
          className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md bg-brand text-cream transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream touch-manipulation"
        >
          <IconSend className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
