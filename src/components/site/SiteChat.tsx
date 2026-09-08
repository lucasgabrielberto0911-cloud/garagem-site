"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { VehicleCardWhatsApp } from "@/components/site/VehicleCardWhatsApp";
import {
  IconChat,
  IconClose,
  IconSend,
  IconWhatsApp,
} from "@/components/site/icons";
import {
  chatStockExploreLabel,
  chatVehicleKm,
  chatVehicleLabel,
  chatVehiclePrice,
  chatVehicleVersion,
  polishChatReplyWithCards,
  type ChatVehicleCard,
} from "@/lib/chat-cards";
import { chatWhatsAppCta, displayChatText, splitChatLinks } from "@/lib/chat-text";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  vehicles?: ChatVehicleCard[];
  stockHref?: string | null;
};

const ASSISTANT_NAME = "Assistente Garagem";
const VEHICLE_PLACEHOLDER = "/branding/placeholder-car.png";

const OPENING: ChatMessage = {
  role: "assistant",
  content:
    "Olá! Te ajudo a escolher no estoque, financiamento em até 60x ou troca. Manda o orçamento ou o modelo.",
};

const SUGGESTIONS = [
  "Carros até 70 mil?",
  "Automático até 80 mil?",
  "Financiamento em 60x",
  "Aceita troca?",
];

function ChatLogo({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-brand font-display font-bold italic leading-none text-cream ${
        size === "sm" ? "h-9 w-9 text-[17px]" : "h-10 w-10 text-[19px]"
      }`}
      aria-hidden="true"
    >
      G
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

function ChatVehicleMini({ vehicle }: { vehicle: ChatVehicleCard }) {
  const version = chatVehicleVersion(vehicle);
  const photo = vehicle.photo || VEHICLE_PLACEHOLDER;
  const label = chatVehicleLabel(vehicle);
  const meta = [
    String(vehicle.year || ""),
    vehicle.color,
    chatVehicleKm(vehicle),
    vehicle.transmission,
  ]
    .filter((item): item is string => Boolean(item && item !== "0"))
    .join(" · ");

  return (
    <article className="mt-1.5 flex overflow-hidden rounded-xl border border-white/10 bg-[#121214]">
      <Link
        href={vehicle.href}
        prefetch={false}
        className="flex min-w-0 flex-1 items-stretch gap-2.5 p-2 transition hover:bg-white/[0.03]"
        aria-label={`${label} — ${chatVehiclePrice(vehicle)}. Ver anúncio`}
      >
        <span className="relative h-[4.75rem] w-[6.35rem] shrink-0 overflow-hidden rounded-lg bg-asphalt">
          {/* eslint-disable-next-line @next/next/no-img-element -- capa remota, sem cota /_next/image */}
          <img
            src={photo}
            alt=""
            width={160}
            height={120}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            onError={(event) => {
              const image = event.currentTarget;
              if (image.dataset.fallbackUsed === "1") return;
              image.dataset.fallbackUsed = "1";
              image.src = VEHICLE_PLACEHOLDER;
            }}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
          <span
            className="block truncate font-display text-[13px] font-semibold leading-snug text-cream"
            title={vehicle.title}
          >
            {vehicle.title}
          </span>
          {version ? (
            <span
              className="mt-0.5 block truncate text-[11px] leading-snug text-muted"
              title={version}
            >
              {version}
            </span>
          ) : null}
          {meta ? (
            <span
              className="mt-0.5 block truncate text-[11px] leading-snug text-cream/70"
              title={meta}
            >
              {meta}
            </span>
          ) : null}
          <span className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-[15px] font-bold leading-none text-cream">
              {chatVehiclePrice(vehicle)}
            </span>
            <span className="font-display text-[10px] font-semibold uppercase tracking-wide text-brand">
              Ver anúncio
            </span>
          </span>
        </span>
      </Link>
      <VehicleCardWhatsApp
        vehicleId={vehicle.id}
        label={label}
        value={vehicle.price}
        make={vehicle.brand}
        model={vehicle.model}
        year={vehicle.year}
        variant="icon"
      />
    </article>
  );
}

function readVehicleCards(raw: unknown): ChatVehicleCard[] {
  if (!Array.isArray(raw)) return [];
  const cards: ChatVehicleCard[] = [];
  for (const item of raw.slice(0, 3)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<ChatVehicleCard>;
    const id = String(row.id ?? "").trim();
    const href = String(row.href ?? "").trim();
    const title = String(row.title ?? "").trim();
    if (!id || !title || !href.startsWith("/estoque/")) continue;
    const photoRaw = String(row.photo ?? "").trim();
    const photo =
      /^https:\/\//i.test(photoRaw) || photoRaw.startsWith("/")
        ? photoRaw
        : null;
    cards.push({
      id,
      href,
      title,
      brand: String(row.brand ?? "").trim() || title,
      model: String(row.model ?? "").trim() || title,
      version: row.version ? String(row.version) : null,
      year: Number(row.year) || 0,
      km: Number(row.km) || 0,
      price: Number(row.price) || 0,
      color: row.color ? String(row.color) : null,
      transmission: row.transmission ? String(row.transmission) : null,
      photo,
    });
  }
  return cards;
}

function ChatText({
  text,
  vehicles = [],
  stockHref = null,
}: {
  text: string;
  vehicles?: ChatVehicleCard[];
  stockHref?: string | null;
}) {
  const source =
    vehicles.length > 0 ? polishChatReplyWithCards(text, vehicles) : text;
  const visible = displayChatText(source);
  const cta = vehicles.length > 0 ? null : chatWhatsAppCta(text);
  const showCta = Boolean(cta);
  const parts = splitChatLinks(visible).filter(
    (part) => part.type !== "link" || !/wa\.me\//i.test(part.href),
  );

  return (
    <>
      {visible ? (
        <div className="rounded-2xl rounded-bl-md border border-white/10 bg-asphalt px-3.5 py-2.5">
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
        </div>
      ) : null}
      {vehicles.map((vehicle) => (
        <ChatVehicleMini key={vehicle.id} vehicle={vehicle} />
      ))}
      {stockHref ? (
        <Link
          href={stockHref}
          prefetch={false}
          className="mt-1.5 flex min-h-11 items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#121214] px-3 font-display text-[12px] font-semibold uppercase tracking-wide text-cream transition hover:border-brand/50 hover:bg-brand/10"
        >
          {chatStockExploreLabel(stockHref)}
          <span aria-hidden="true">
            ›
          </span>
        </Link>
      ) : null}
      {showCta && cta ? (
        <ChatWhatsAppButton href={cta.href} label={cta.label} benefit={cta.benefit} />
      ) : null}
    </>
  );
}

function AssistantRow({
  children,
  pending = false,
  latest = false,
}: {
  children: ReactNode;
  pending?: boolean;
  latest?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5" data-chat-latest={latest ? "1" : undefined}>
      <ChatLogo size="sm" />
      <div className="min-w-0 flex-1">
        {pending ? (
          <div className="w-fit rounded-2xl rounded-bl-md border border-white/10 bg-asphalt px-3.5 py-2.5">
            {children}
          </div>
        ) : (
          children
        )}
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
  const keepFocusRef = useRef(false);

  useEffect(() => {
    if (!open) {
      keepFocusRef.current = false;
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current;
    if (node) {
      const latest = node.querySelector("[data-chat-latest='1']");
      if (latest instanceof HTMLElement) {
        const top =
          latest.getBoundingClientRect().top -
          node.getBoundingClientRect().top +
          node.scrollTop -
          8;
        node.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      } else {
        node.scrollTop = node.scrollHeight;
      }
    }
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    if (keepFocusRef.current || desktop) inputRef.current?.focus();
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
          historico: messages
            .filter((item, index) => {
              if (index !== 0) return true;
              return item.content !== OPENING.content;
            })
            .map((item) => ({
              role: item.role,
              content: item.content,
            })),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        reply?: string;
        vehicles?: unknown;
        stockHref?: unknown;
      };
      const stockHref =
        typeof data.stockHref === "string" && data.stockHref.startsWith("/estoque")
          ? data.stockHref
          : null;
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.reply?.trim() ||
            "Não consegui responder agora. Fala com a gente no WhatsApp: https://wa.me/5527996330706",
          vehicles: readVehicleCards(data.vehicles),
          stockHref,
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

  const started = messages.length > 1;
  const showSuggestions = !started && !pending;
  const canSend = !pending && draft.trim().length >= 2;

  function resetConversation() {
    if (pending) return;
    keepFocusRef.current = false;
    setMessages([OPENING]);
    setDraft("");
  }

  return (
    <div
      className={`site-chat pointer-events-none fixed z-[60] flex flex-col items-end gap-3${
        open ? " is-open" : ""
      }`}
    >
      {open ? (
        <section
          role="dialog"
          aria-labelledby="site-chat-title"
          aria-label="Chat da Garagem"
          className="site-chat-panel pointer-events-auto flex h-[min(680px,calc(100dvh-7.25rem))] w-[min(28rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
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
                  className="font-display text-[13px] font-semibold leading-tight tracking-wide text-cream sm:text-sm"
                >
                  {ASSISTANT_NAME}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#25D366]"
                    aria-hidden="true"
                  />
                  online · 8h às 23h
                </p>
              </div>
              <a
                href={whatsappUrl(WHATSAPP_MESSAGES.help)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick("chat")}
                className="whatsapp-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                aria-label="Falar com um vendedor no WhatsApp"
              >
                <IconWhatsApp className="h-4 w-4" />
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
            className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3"
            aria-live="polite"
          >
            {messages.map((message, index) => {
              if (index === 0 && started) return null;
              return message.role === "user" ? (
                <div
                  key={`user-${index}`}
                  className="flex justify-end"
                  data-chat-latest={index === messages.length - 1 ? "1" : undefined}
                >
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-sm leading-relaxed text-cream">
                    {message.content}
                  </p>
                </div>
              ) : (
                <AssistantRow
                  key={`assistant-${index}`}
                  latest={index === messages.length - 1}
                >
                  <ChatText
                    text={message.content}
                    vehicles={message.vehicles}
                    stockHref={message.stockHref}
                  />
                </AssistantRow>
              );
            })}
            {pending ? (
              <AssistantRow pending latest>
                <span className="sr-only">Digitando</span>
                <span className="site-chat-typing" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </AssistantRow>
            ) : null}
            {showSuggestions ? (
              <div className="grid grid-cols-2 gap-2 pl-[2.875rem] pt-0.5">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={pending}
                    onClick={() => void send(suggestion)}
                    className="min-h-11 rounded-xl border border-white/15 bg-[#121214] px-3 py-2 text-left text-[12px] leading-snug text-cream transition hover:border-brand/50 hover:bg-brand/15"
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
                onFocus={() => {
                  keepFocusRef.current = true;
                }}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
                placeholder="Ex.: HB20 até 70 mil"
                maxLength={800}
                rows={1}
                autoComplete="off"
                className="min-h-[48px] max-h-28 min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-asphalt px-3 py-2.5 text-sm text-cream outline-none placeholder:text-muted focus:border-white/25 focus:bg-[#141416]"
              />
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Enviar"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-cream transition hover:bg-[#c91418] disabled:opacity-40"
              >
                <IconSend className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 flex items-center justify-between gap-2 text-[10px] leading-relaxed text-muted">
              <span>Enter envia. Ao conversar, podemos te chamar no WhatsApp.</span>
              {started ? (
                <button
                  type="button"
                  onClick={resetConversation}
                  className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-cream/70 transition hover:text-cream"
                >
                  Nova conversa
                </button>
              ) : null}
            </p>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? "Fechar chat" : "Abrir chat da Garagem"}
        className={`site-chat-launcher pointer-events-auto flex h-14 items-center justify-center rounded-full bg-brand text-cream shadow-[0_10px_24px_rgba(232,24,28,0.4)] transition hover:bg-[#c91418] hover:scale-105 active:scale-95 touch-manipulation ${
          open ? "w-14" : "w-14 lg:w-auto lg:gap-2.5 lg:px-4"
        }`}
      >
        {open ? (
          <IconClose className="h-6 w-6" />
        ) : (
          <>
            <IconChat className="h-6 w-6" />
            <span className="hidden font-display text-[13px] font-semibold lg:inline">
              Ajuda pra escolher
            </span>
          </>
        )}
      </button>
    </div>
  );
}
