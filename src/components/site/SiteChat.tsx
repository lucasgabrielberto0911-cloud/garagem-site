"use client";

import { Barlow_Condensed } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { IconChat, IconClose, IconWhatsApp } from "@/components/site/icons";
import { CHAT_WHATSAPP_URL } from "@/lib/chat-prompt";
import { trackWhatsAppClick } from "@/lib/meta-pixel";

const chatDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const OPENING: ChatMessage = {
  role: "assistant",
  content:
    "Olá! Sou o assistente da Garagem. Pergunta tipo HB20, carro até 70 mil, troca ou financiamento.",
};

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

  return (
    <div className="site-chat pointer-events-none fixed z-[60] flex flex-col items-end gap-3">
      {open ? (
        <section
          role="dialog"
          aria-label="Chat da Garagem"
          className="pointer-events-auto flex h-[min(580px,calc(100dvh-7.5rem))] w-[min(22.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden border border-white/10 bg-ink shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        >
          <header className="relative border-b border-white/10 bg-[#121214] px-4 py-3">
            <div
              className="absolute inset-x-0 top-0 h-0.5 bg-brand-gradient"
              aria-hidden="true"
            />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={`${chatDisplay.className} text-sm font-semibold uppercase tracking-wide text-cream`}
                >
                  Garagem
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Assistente · estoque e dúvidas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center text-muted transition hover:text-cream"
                aria-label="Fechar chat"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
          </header>

          <a
            href={CHAT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick("chat")}
            className={`${chatDisplay.className} flex min-h-[44px] items-center justify-center gap-2 border-b border-white/10 bg-brand/15 px-3 text-xs font-semibold uppercase tracking-wide text-cream transition hover:bg-brand/25`}
          >
            <IconWhatsApp className="h-4 w-4 text-[#25D366]" />
            Falar com um vendedor no WhatsApp
          </a>

          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
          >
            {messages.map((message, index) => (
              <p
                key={`${message.role}-${index}`}
                className={`max-w-[92%] whitespace-pre-wrap text-sm leading-relaxed ${
                  message.role === "user"
                    ? "ml-auto bg-brand/20 px-3 py-2 text-cream"
                    : "border border-white/10 bg-asphalt px-3 py-2 text-cream"
                }`}
              >
                {message.content}
              </p>
            ))}
            {pending ? (
              <p className="border border-white/10 bg-asphalt px-3 py-2 text-sm text-muted">
                Digitando…
              </p>
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
                className="min-h-[52px] max-h-28 min-w-0 flex-1 resize-none border border-white/10 bg-asphalt px-3 py-2 text-sm text-cream outline-none placeholder:text-muted focus:border-brand"
              />
              <button
                type="submit"
                disabled={pending || draft.trim().length < 2}
                className={`${chatDisplay.className} min-h-[52px] bg-brand px-3 text-xs font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] disabled:opacity-50`}
              >
                Enviar
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Ao conversar, você concorda em ser contatado pela nossa equipe.
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
