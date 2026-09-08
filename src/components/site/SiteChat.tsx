"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  IconChat,
  IconClose,
  IconSend,
  IconWhatsApp,
} from "@/components/site/icons";
import { chatWhatsAppCta, displayChatText, splitChatLinks } from "@/lib/chat-text";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const CHAT_LOGO_SRC = "/apple-touch-icon.png";
const ASSISTANT_NAME = "Assistente Garagem";

const OPENING: ChatMessage = {
  role: "assistant",
  content:
    "Olá! Sou o assistente da Garagem. Te ajudo a escolher no estoque, falar de financiamento em até 60x ou troca. Pode perguntar tipo HB20, carro até 70 mil ou automático.",
};

const SUGGESTIONS = [
  "Quais carros até 70 mil?",
  "Tem HB20?",
  "Como funciona o financiamento?",
  "Aceita troca?",
];

function ChatLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const px = size === "sm" ? 32 : 40;
  return (
    <span
      className={`relative shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-white/15 ${
        size === "sm" ? "h-8 w-8" : "h-10 w-10"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- logo estático, sem cota /_next/image */}
      <img
        src={CHAT_LOGO_SRC}
        alt=""
        width={px}
        height={px}
        decoding="async"
        className="h-full w-full object-cover"
      />
    </span>
  );
}

function ChatWhatsAppButton({
  href,
  label,
  benefit,
  className = "mt-2.5",
}: {
  href: string;
  label: string;
  benefit: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackWhatsAppClick("chat")}
      className={`whatsapp-btn flex w-full min-h-[52px] items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-left text-cream ${className}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/20">
        <IconWhatsApp className="h-5 w-5 text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[13px] font-semibold uppercase tracking-wide">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] font-normal leading-snug text-white/90">
          {benefit}
        </span>
      </span>
      <span className="text-lg leading-none text-white/80" aria-hidden="true">
        ›
      </span>
    </a>
  );
}

function ChatText({ text }: { text: string }) {
  const visible = displayChatText(text);
  const cta = chatWhatsAppCta(text);
  const parts = splitChatLinks(visible).filter(
    (part) => part.type !== "link" || !/wa\.me\//i.test(part.href),
  );

  return (
    <>
      {visible ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-cream">
          {parts.map((part, index) =>
            part.type === "link" ? (
              <a
                key={`${part.href}-${index}`}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-white/40 underline-offset-2 transition hover:text-brand hover:decoration-brand"
              >
                {part.label}
              </a>
            ) : (
              <span key={`t-${index}`}>{part.value}</span>
            ),
          )}
        </p>
      ) : null}
      {cta ? (
        <ChatWhatsAppButton href={cta.href} label={cta.label} benefit={cta.benefit} />
      ) : null}
    </>
  );
}

function AssistantRow({
  children,
  pending = false,
}: {
  children: ReactNode;
  pending?: boolean;
}) {
  return (
    <div className="flex items-end gap-2.5">
      <ChatLogo size="sm" />
      <div className="min-w-0 flex-1">
        <p className="mb-1 pl-0.5 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/75">
          {ASSISTANT_NAME}
        </p>
        <div
          className={`rounded-2xl rounded-bl-md border border-white/10 bg-asphalt px-3.5 py-2.5 ${
            pending ? "w-fit" : ""
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function SiteChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([OPENING]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
    inputRef.current?.focus();
  }, [open, messages, pending]);

  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 112)}px`;
  }, [draft, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function send(text: string) {
    const mensagem = text.trim();
    if (!mensagem || pending) return;

    const nextHistory = [...messages, { role: "user" as const, content: mensagem }];
    setMessages(nextHistory);
    setDraft("");
    setPending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem,
          historico: messages.map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        reply?: string;
      };
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.reply?.trim() ||
            "Não consegui responder agora. Fala com a gente no WhatsApp: https://wa.me/5527996330706",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "Não consegui responder agora. Fala com a gente no WhatsApp: https://wa.me/5527996330706",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  const showSuggestions = messages.length === 1 && !pending;
  const canSend = !pending && draft.trim().length >= 2;

  return (
    <div className="site-chat pointer-events-none fixed z-[60] flex flex-col items-end gap-3">
      {open ? (
        <section
          role="dialog"
          aria-labelledby="site-chat-title"
          aria-label="Chat da Garagem"
          className="site-chat-panel pointer-events-auto flex h-[min(640px,calc(100dvh-7.25rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
        >
          <header className="relative border-b border-white/10 bg-[#121214] px-3 py-3 sm:px-4">
            <div
              className="absolute inset-x-0 top-0 h-0.5 bg-brand-gradient"
              aria-hidden="true"
            />
            <div className="flex items-center gap-3">
              <ChatLogo />
              <div className="min-w-0 flex-1">
                <p
                  id="site-chat-title"
                  className="truncate font-display text-sm font-semibold tracking-wide text-cream"
                >
                  {ASSISTANT_NAME}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#25D366]"
                    aria-hidden="true"
                  />
                  Online · estoque e dúvidas
                </p>
              </div>
              <a
                href={whatsappUrl(WHATSAPP_MESSAGES.help)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick("chat")}
                className="whatsapp-btn flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-white"
                aria-label="Falar com um vendedor no WhatsApp"
              >
                <IconWhatsApp className="h-4 w-4" />
                <span className="max-[20rem]:hidden font-display text-[11px] font-semibold uppercase tracking-wide">
                  WhatsApp
                </span>
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-white/5 hover:text-cream"
                aria-label="Fechar chat"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div
            ref={listRef}
            className="flex-1 space-y-3.5 overflow-y-auto overscroll-contain px-3 py-3.5"
            aria-live="polite"
          >
            {messages.map((message, index) =>
              message.role === "user" ? (
                <div key={`user-${index}`} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-sm leading-relaxed text-cream">
                    {message.content}
                  </p>
                </div>
              ) : (
                <AssistantRow key={`assistant-${index}`}>
                  <ChatText text={message.content} />
                </AssistantRow>
              ),
            )}
            {pending ? (
              <AssistantRow pending>
                <span className="sr-only">Digitando</span>
                <span className="site-chat-typing" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </AssistantRow>
            ) : null}
            {showSuggestions ? (
              <div className="flex flex-wrap gap-2 pl-10 pt-0.5">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={pending}
                    onClick={() => void send(suggestion)}
                    className="rounded-xl border border-white/15 bg-[#121214] px-3 py-2 text-left text-[12px] leading-snug text-cream transition hover:border-brand/50 hover:bg-brand/15"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <form
            className="border-t border-white/10 bg-[#121214] p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <label htmlFor="site-chat-input" className="sr-only">
              Mensagem
            </label>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                id="site-chat-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
                placeholder="Ex.: HB20 até 70 mil"
                maxLength={800}
                rows={2}
                autoComplete="off"
                className="min-h-[56px] max-h-28 min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-asphalt px-3 py-2.5 text-sm text-cream outline-none placeholder:text-muted focus:border-brand"
              />
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Enviar"
                className="flex h-14 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-cream transition hover:bg-[#c91418] disabled:opacity-40"
              >
                <IconSend className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Enter envia · Shift+Enter quebra a linha. Ao conversar, você
              concorda em ser contatado pela nossa equipe.
            </p>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? "Fechar chat" : "Abrir chat da Garagem"}
        className="site-chat-launcher pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-cream shadow-[0_10px_24px_rgba(232,24,28,0.4)] transition hover:bg-[#c91418] hover:scale-105 active:scale-95 touch-manipulation"
      >
        {open ? <IconClose className="h-6 w-6" /> : <IconChat className="h-6 w-6" />}
      </button>
    </div>
  );
}
