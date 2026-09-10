"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { VehicleCardWhatsApp } from "@/components/site/VehicleCardWhatsApp";
import {
  IconChat,
  IconClose,
  IconSend,
  IconWhatsApp,
} from "@/components/site/icons";
import {
  chatFollowupsAfterCards,
  chatStockExploreLabel,
  chatVehicleLabel,
  chatVehicleMeta,
  chatVehiclePrice,
  chatVehicleVersion,
  polishChatReplyWithCards,
  type ChatVehicleCard,
} from "@/lib/chat-cards";
import {
  consumeSiteChatOpenRequest,
  SITE_CHAT_OPEN_EVENT,
  type SiteChatOpenRequest,
} from "@/lib/chat-open";
import { chatPageKey } from "@/lib/chat-page";
import { CHAT_FALLBACK_REPLY } from "@/lib/chat-prompt";
import {
  parseSseChunks,
  readChatStreamFrame,
} from "@/lib/chat-stream";
import { chatWhatsAppCta, displayChatText, splitChatLinks } from "@/lib/chat-text";
import {
  classifyChatIntent,
  trackChatEvent,
  trackLead,
  trackWhatsAppClick,
} from "@/lib/meta-pixel";
import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";
import {
  getChatVehicleContext,
  subscribeChatVehicleContext,
  type ChatVehicleContext,
} from "@/lib/chat-vehicle-context";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  vehicles?: ChatVehicleCard[];
  stockHref?: string | null;
  leadCreated?: boolean;
};

const ASSISTANT_NAME = "Assistente Garagem";
const VEHICLE_PLACEHOLDER = "/branding/placeholder-car.png";

const OPENING: ChatMessage = {
  role: "assistant",
  content:
    "Oi! Que bom te ver por aqui. Eu te ajudo a achar o seminovo certo no estoque, com calma e sem enrolação. Me conta o orçamento ou o modelo que você tem em mente que a gente escolhe juntos.",
};

const SUGGESTIONS = [
  "Carros até 70 mil?",
  "Automático até 80 mil?",
  "Como funciona o financiamento?",
  "Aceita troca?",
];

const VEHICLE_SUGGESTIONS = [
  "Garantia e condições",
  "Pedir vídeo no WhatsApp",
  "Aceita meu usado na troca?",
  "Falar com um consultor",
];

const CHAT_STORAGE_KEY = "garagem_site_chat_history_v2";
const CHAT_STORAGE_LEGACY_KEY = "garagem_site_chat_history_v1";
const CHAT_STORAGE_OPEN_KEY = "garagem_site_chat_is_open_v1";

type ChatHistoryStore = {
  v: 2;
  byKey: Record<string, ChatMessage[]>;
};

function emptyHistory(): ChatHistoryStore {
  return { v: 2, byKey: {} };
}

function readHistoryStore(): ChatHistoryStore {
  try {
    sessionStorage.removeItem(CHAT_STORAGE_LEGACY_KEY);
  } catch {
    // ignora
  }
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return emptyHistory();
    const parsed = JSON.parse(raw) as Partial<ChatHistoryStore>;
    if (parsed?.v !== 2 || !parsed.byKey || typeof parsed.byKey !== "object") {
      return emptyHistory();
    }
    return { v: 2, byKey: parsed.byKey };
  } catch {
    return emptyHistory();
  }
}

function writeHistoryStore(store: ChatHistoryStore) {
  try {
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignora
  }
}

function historyForKey(store: ChatHistoryStore, key: string): ChatMessage[] {
  const saved = store.byKey[key];
  return Array.isArray(saved) && saved.length > 0 ? saved : [OPENING];
}

function resolveSuggestionPrompt(
  suggestion: string,
  vehicle?: ChatVehicleContext | null,
): string {
  if (!vehicle) return suggestion;
  const isMoto = vehicle.category === "moto";
  const articleO = isMoto ? "a" : "o";
  const prepDa = isMoto ? "da" : "do";
  const prepPela = isMoto ? "pela" : "pelo";
  const vehicleName = `${vehicle.label}${vehicle.year ? ` ${vehicle.year}` : ""}`;
  const lower = suggestion.toLowerCase();

  if (vehicle.sold) {
    if (lower.includes("avisar") || lower.includes("chegar")) {
      return `Vi que ${articleO} ${vehicleName} já foi vendid${articleO}. Podem me avisar quando chegar outro similar no estoque?`;
    }
    if (lower.includes("semelhante") || lower.includes("opções") || lower.includes("opcoes")) {
      return `Vi que ${articleO} ${vehicleName} já foi vendid${articleO}. Vocês têm outras opções parecidas no estoque agora?`;
    }
    if (lower.includes("encomend") || lower.includes("modelo")) {
      return `Gostei muito d${prepDa} ${vehicleName}. Vocês conseguem encomendar ou achar um similar pra mim?`;
    }
    if (lower.includes("vendedor") || lower.includes("consultor")) {
      return `Quero falar com um consultor sobre opções parecidas com ${articleO} ${vehicleName}.`;
    }
  }

  if (lower.includes("financiamento")) {
    return `Como funciona o financiamento para ${articleO} ${vehicleName}?`;
  }
  if (lower.includes("vídeo") || lower.includes("video")) {
    return `Como faço para pedir um vídeo ${prepDa} ${vehicleName} pelo WhatsApp?`;
  }
  if (lower.includes("troca") || lower.includes("usado")) {
    return `Vocês aceitam meu veículo usado na troca ${prepPela} ${vehicleName}?`;
  }
  if (lower.includes("garantia") || lower.includes("condições") || lower.includes("condicoes")) {
    return `Qual é a garantia e as condições ${prepDa} ${vehicleName}?`;
  }
  if (lower.includes("vendedor") || lower.includes("consultor")) {
    return `Quero falar com um consultor sobre ${articleO} ${vehicleName}.`;
  }
  return suggestion;
}

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

function ChatVehicleMini({
  vehicle,
  onVehicleClick,
}: {
  vehicle: ChatVehicleCard;
  onVehicleClick?: (vehicle: ChatVehicleCard) => void;
}) {
  const version = chatVehicleVersion(vehicle);
  const photo = vehicle.photo || VEHICLE_PLACEHOLDER;
  const label = chatVehicleLabel(vehicle);
  const meta = chatVehicleMeta(vehicle);

  return (
    <article className="mt-1.5 flex overflow-hidden rounded-xl border border-white/10 bg-[#121214]">
      <Link
        href={vehicle.href}
        prefetch={false}
        onClick={() => onVehicleClick?.(vehicle)}
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
          <span className="mt-1.5 flex flex-col items-start gap-1">
            <span className="font-display text-[16px] font-bold leading-none tabular-nums tracking-tight text-cream">
              {chatVehiclePrice(vehicle)}
            </span>
            <span className="whitespace-nowrap font-display text-[10px] font-semibold uppercase tracking-wide text-brand">
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
        trackingLabel="chat-card"
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

function ChatBubbleBody({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter(Boolean);
  return (
    <div className="rounded-2xl rounded-bl-md border border-white/10 bg-asphalt px-3.5 py-2.5">
      {blocks.map((block, index) => {
        const parts = splitChatLinks(block).filter(
          (part) => part.type !== "link" || !/wa\.me\//i.test(part.href),
        );
        const consumo =
          /consumo|catálogo|catalogo|km\/l|não foi medido|nao foi medido/i.test(
            block,
          );
        return (
          <p
            key={`p-${index}`}
            className={`whitespace-pre-wrap leading-[1.45] ${
              index > 0 ? "mt-2 " : ""
            }${
              consumo
                ? "text-[13px] text-cream/75"
                : "text-sm text-cream"
            }`}
          >
            {parts.map((part, partIndex) =>
              part.type === "link" ? (
                <a
                  key={`${part.href}-${partIndex}`}
                  href={part.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-white/40 underline-offset-2 transition hover:text-brand hover:decoration-brand"
                >
                  {part.label}
                </a>
              ) : (
                <span key={`t-${partIndex}`}>{part.value}</span>
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}

function ChatText({
  text,
  vehicles = [],
  stockHref = null,
  leadCreated = false,
  followups = [],
  onFollowup,
  onVehicleClick,
  onStockExplore,
  vehicleContext,
}: {
  text: string;
  vehicles?: ChatVehicleCard[];
  stockHref?: string | null;
  leadCreated?: boolean;
  followups?: string[];
  onFollowup?: (text: string) => void;
  onVehicleClick?: (vehicle: ChatVehicleCard) => void;
  onStockExplore?: () => void;
  vehicleContext?: ChatVehicleContext | null;
}) {
  const source =
    vehicles.length > 0 ? polishChatReplyWithCards(text, vehicles) : text;
  const visible = displayChatText(source);
  const cta = chatWhatsAppCta(text, vehicleContext);
  const showCta = Boolean(cta);

  return (
    <>
      {visible ? <ChatBubbleBody text={visible} /> : null}
      {leadCreated ? (
        <div
          role="status"
          className="mt-1.5 flex min-h-11 items-center gap-2 rounded-xl border border-[#25D366]/30 bg-[#25D366]/10 px-3 text-[12px] text-cream"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-[#25D366]"
            aria-hidden="true"
          />
          Contato registrado. A equipe continua com você no WhatsApp.
        </div>
      ) : null}
      {vehicles.map((vehicle) => (
        <ChatVehicleMini
          key={vehicle.id}
          vehicle={vehicle}
          onVehicleClick={onVehicleClick}
        />
      ))}
      {stockHref ? (
        <Link
          href={stockHref}
          prefetch={false}
          onClick={onStockExplore}
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
      {followups.length > 0 && onFollowup ? (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {followups.map((item, index) => (
            <button
              key={item}
              type="button"
              onClick={() => onFollowup(item)}
              className={`min-h-11 rounded-lg border border-white/15 bg-[#121214] px-2.5 py-1.5 text-left text-[12px] leading-snug text-cream transition hover:border-brand/50 hover:bg-brand/15${
                followups.length % 2 === 1 && index === followups.length - 1
                  ? " col-span-2"
                  : ""
              }`}
            >
              {item}
            </button>
          ))}
        </div>
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
    <div
      className={`flex items-start gap-2.5${latest ? " scroll-mt-2" : ""}`}
      data-chat-latest={latest ? "1" : undefined}
    >
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
  const pathname = usePathname();
  const isVehiclePage = Boolean(
    pathname?.startsWith("/estoque/") && pathname !== "/estoque",
  );
  const [vehicleContext, setVehicleContext] = useState<ChatVehicleContext | null>(getChatVehicleContext);

  useEffect(() => {
    return subscribeChatVehicleContext(setVehicleContext);
  }, []);

  const isMoto = vehicleContext?.category === "moto";
  const vehicleNoun = isMoto ? "desta moto" : "deste carro";
  const vehiclePrep = isMoto ? "da" : "do";

  const activeSuggestions = vehicleContext
    ? vehicleContext.sold
      ? [
          "Avisar quando chegar similar",
          "Ver opções semelhantes",
          "Encomendar este modelo",
          "Falar com um consultor",
        ]
      : [
          `Financiamento ${vehiclePrep} ${vehicleContext.model}`,
          `Pedir vídeo no WhatsApp`,
          `Aceita meu usado na troca?`,
          `Garantia ${vehicleNoun}`,
        ]
    : isVehiclePage
      ? VEHICLE_SUGGESTIONS
      : SUGGESTIONS;

  const pageKey = chatPageKey(pathname);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([OPENING]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const keepFocusRef = useRef(false);
  const sourceRef = useRef("launcher");
  const openRef = useRef(false);
  const messageCountRef = useRef(0);
  const lastIntentRef = useRef("other");
  const leadTrackedRef = useRef(false);
  const restoredRef = useRef(false);
  const sendingRef = useRef(false);
  const pageKeyRef = useRef(pageKey);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const store = readHistoryStore();
    const saved = historyForKey(store, pageKey);
    setMessages(saved);
    messageCountRef.current = saved.filter((item) => item.role === "user").length;
    try {
      const wasOpen = sessionStorage.getItem(CHAT_STORAGE_OPEN_KEY) === "1";
      if (wasOpen) {
        openRef.current = true;
        setOpen(true);
      }
    } catch {
      // Ignora erro de sessionStorage em ambientes restritos
    }
  }, [pageKey]);

  useEffect(() => {
    if (!restoredRef.current) return;
    if (pageKeyRef.current !== pageKey) return;
    const store = readHistoryStore();
    if (messages.length > 1) {
      store.byKey[pageKey] = messages;
    } else {
      delete store.byKey[pageKey];
    }
    writeHistoryStore(store);
  }, [messages, pageKey]);

  useEffect(() => {
    if (!restoredRef.current) return;
    if (pageKeyRef.current === pageKey) return;
    const previousKey = pageKeyRef.current;
    pageKeyRef.current = pageKey;
    const store = readHistoryStore();
    if (messagesRef.current.length > 1) {
      store.byKey[previousKey] = messagesRef.current;
      writeHistoryStore(store);
    }
    const next = historyForKey(store, pageKey);
    setMessages(next);
    messageCountRef.current = next.filter((item) => item.role === "user").length;
    leadTrackedRef.current = false;
    lastIntentRef.current = "other";
  }, [pageKey]);

  useEffect(() => {
    try {
      if (open) {
        sessionStorage.setItem(CHAT_STORAGE_OPEN_KEY, "1");
      } else if (restoredRef.current) {
        sessionStorage.removeItem(CHAT_STORAGE_OPEN_KEY);
      }
    } catch {
      // Ignora
    }
  }, [open]);

  function openChat(source: string) {
    sourceRef.current = source || "site";
    if (!openRef.current) {
      openRef.current = true;
      trackChatEvent("ChatOpen", {
        source: sourceRef.current,
        message_count: messageCountRef.current,
      });
    }
    setOpen(true);
  }

  function closeChat() {
    if (openRef.current) {
      trackChatEvent("ChatClose", {
        source: sourceRef.current,
        message_count: messageCountRef.current,
      });
    }
    openRef.current = false;
    setOpen(false);
  }

  useEffect(() => {
    function applyRequest(request: SiteChatOpenRequest | null) {
      if (!request) return;
      if (request.prompt?.trim()) setDraft(request.prompt.trim().slice(0, 800));
      openChat(request.source);
    }

    function onOpen(event: Event) {
      applyRequest((event as CustomEvent<SiteChatOpenRequest>).detail ?? null);
    }

    window.addEventListener(SITE_CHAT_OPEN_EVENT, onOpen);
    applyRequest(consumeSiteChatOpenRequest());
    return () => window.removeEventListener(SITE_CHAT_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) {
      keepFocusRef.current = false;
      return;
    }
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    if (desktop) return;
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
      const scrollDown = () => {
        const latest = node.querySelector("[data-chat-latest='1']");
        if (latest instanceof HTMLElement) {
          const latestHeight = latest.offsetHeight;
          const containerHeight = node.clientHeight;
          if (latestHeight > containerHeight) {
            const top =
              latest.getBoundingClientRect().top -
              node.getBoundingClientRect().top +
              node.scrollTop -
              12;
            node.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          } else {
            node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
          }
        } else {
          node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
        }
      };

      scrollDown();
      const timer = setTimeout(scrollDown, 80);
      return () => clearTimeout(timer);
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
      if (event.key === "Escape") closeChat();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const shell = shellRef.current;
    const viewport = window.visualViewport;
    if (!shell || !viewport) return;

    const sync = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        shell.style.top = "";
        shell.style.height = "";
        shell.style.bottom = "";
        return;
      }
      const covered =
        window.innerHeight - viewport.height - viewport.offsetTop;
      if (covered > 120) {
        shell.style.top = `${Math.max(0, viewport.offsetTop) + 8}px`;
        shell.style.height = `${Math.max(200, viewport.height - 16)}px`;
        shell.style.bottom = "auto";
      } else {
        shell.style.top = "";
        shell.style.height = "";
        shell.style.bottom = "";
      }
    };

    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      shell.style.top = "";
      shell.style.height = "";
      shell.style.bottom = "";
    };
  }, [open]);

  function commitAssistant(
    data: {
      reply?: string;
      vehicles?: unknown;
      stockHref?: unknown;
      leadCreated?: unknown;
    },
    intent: string,
    replaceLastAssistant: boolean,
  ) {
    const stockHref =
      typeof data.stockHref === "string" && data.stockHref.startsWith("/estoque")
        ? data.stockHref
        : null;
    const vehicles = readVehicleCards(data.vehicles);
    const leadCreated = data.leadCreated === true;
    if (vehicles.length > 0) {
      trackChatEvent("ChatStockShown", {
        source: sourceRef.current,
        intent,
        vehicle_ids: vehicles.map((vehicle) => vehicle.id),
        result_count: vehicles.length,
        message_count: messageCountRef.current,
      });
    }
    if (leadCreated && !leadTrackedRef.current) {
      leadTrackedRef.current = true;
      trackChatEvent("ChatLeadCreated", {
        source: sourceRef.current,
        intent,
        message_count: messageCountRef.current,
      });
      trackLead({
        content_ids: [],
        content_name: "chatbot-site",
      });
    }
    const next: ChatMessage = {
      role: "assistant",
      content: data.reply?.trim() || CHAT_FALLBACK_REPLY,
      vehicles,
      stockHref,
      leadCreated,
    };
    setMessages((current) => {
      if (
        replaceLastAssistant &&
        current[current.length - 1]?.role === "assistant"
      ) {
        return [...current.slice(0, -1), next];
      }
      return [...current, next];
    });
  }

  async function send(
    text: string,
    origin: "typed" | "suggestion" | "followup" = "typed",
  ) {
    const mensagem = text.trim();
    if (!mensagem || pending || sendingRef.current) return;
    sendingRef.current = true;

    const intent = classifyChatIntent(mensagem);
    lastIntentRef.current = intent;
    const isFirst = messageCountRef.current === 0;
    messageCountRef.current += 1;
    if (isFirst) {
      trackChatEvent("ChatFirstMessage", {
        source: sourceRef.current,
        intent,
        message_count: 1,
      });
    }
    if (origin === "followup") {
      trackChatEvent("ChatFollowupClick", {
        source: sourceRef.current,
        intent,
        message_count: messageCountRef.current,
      });
    }

    const nextHistory = [...messages, { role: "user" as const, content: mensagem }];
    setMessages(nextHistory);
    setDraft("");
    setPending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          mensagem,
          stream: true,
          vehicleId: vehicleContext?.id,
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
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamed = false;
        let donePayload: {
          reply?: string;
          vehicles?: unknown;
          stockHref?: unknown;
          leadCreated?: unknown;
        } | null = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseChunks(buffer);
          buffer = parsed.rest;
          for (const frame of parsed.frames) {
            const event = readChatStreamFrame(frame.event, frame.data);
            if (!event) continue;
            if (event.type === "token" && event.text) {
              streamed = true;
              setMessages((current) => {
                const last = current[current.length - 1];
                if (last?.role === "assistant") {
                  const next = [...current];
                  next[next.length - 1] = {
                    ...last,
                    content: `${last.content}${event.text}`,
                  };
                  return next;
                }
                return [
                  ...current,
                  { role: "assistant", content: event.text },
                ];
              });
            }
            if (event.type === "done" || event.type === "error") {
              donePayload = event;
            }
          }
        }
        commitAssistant(
          donePayload ?? { reply: CHAT_FALLBACK_REPLY },
          intent,
          streamed,
        );
      } else {
        const data = (await response.json().catch(() => ({}))) as {
          reply?: string;
          vehicles?: unknown;
          stockHref?: unknown;
          leadCreated?: unknown;
        };
        commitAssistant(data, intent, false);
      }
    } catch {
      setMessages((current) => {
        const last = current[current.length - 1];
        if (last?.role === "assistant") {
          return [
            ...current.slice(0, -1),
            { role: "assistant", content: CHAT_FALLBACK_REPLY },
          ];
        }
        return [
          ...current,
          { role: "assistant", content: CHAT_FALLBACK_REPLY },
        ];
      });
    } finally {
      sendingRef.current = false;
      setPending(false);
    }
  }

  const started = messages.length > 1;
  const showSuggestions = !started && !pending;
  const canSend = !pending && !sendingRef.current && draft.trim().length >= 2;
  const lastIsAssistant = messages[messages.length - 1]?.role === "assistant";
  const showTyping = pending && !lastIsAssistant;

  function resetConversation() {
    if (pending || sendingRef.current) return;
    keepFocusRef.current = false;
    messageCountRef.current = 0;
    lastIntentRef.current = "other";
    leadTrackedRef.current = false;
    setMessages([OPENING]);
    setDraft("");
    writeHistoryStore(emptyHistory());
  }

  return (
    <div
      ref={shellRef}
      className={`site-chat pointer-events-none fixed z-[60] flex flex-col items-end gap-3${
        open ? " is-open" : ""
      }`}
    >
      {open ? (
        <section
          role="dialog"
          aria-labelledby="site-chat-title"
          aria-label="Chat da Sua Garagem"
          className="site-chat-panel pointer-events-auto flex h-[min(680px,calc(100dvh-7.25rem))] w-[min(28rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
          aria-busy={pending}
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
                onClick={closeChat}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-white/5 hover:text-cream"
                aria-label="Fechar chat"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
          </header>

          {vehicleContext ? (
            <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#161619] px-3.5 py-2">
              <span className="flex items-center gap-1.5 min-w-0 text-[11px] text-muted truncate">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    vehicleContext.sold ? "bg-amber-400" : "bg-brand"
                  }`}
                />
                <span className="truncate">
                  {vehicleContext.sold
                    ? "Vendido:"
                    : isMoto
                      ? "Moto:"
                      : "Na tela:"}{" "}
                  <strong className="text-cream font-medium">
                    {vehicleContext.label}
                    {vehicleContext.year ? ` ${vehicleContext.year}` : ""}
                  </strong>
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void send(
                    vehicleContext.sold
                      ? `Vi que ${isMoto ? "a" : "o"} ${vehicleContext.label}${vehicleContext.year ? ` ${vehicleContext.year}` : ""} foi vendid${isMoto ? "a" : "o"}. Podem me avisar quando chegar outro similar no estoque?`
                      : `Tenho interesse ${isMoto ? "na" : "no"} ${vehicleContext.label}${vehicleContext.year ? ` ${vehicleContext.year}` : ""}. Gostaria de mais informações sobre ${isMoto ? "ela" : "ele"}.`,
                    "suggestion",
                  )
                }
                className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                  vehicleContext.sold
                    ? "border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25"
                    : "border-brand/40 bg-brand/15 text-brand hover:bg-brand/25"
                }`}
              >
                {vehicleContext.sold
                  ? "Avisar quando chegar"
                  : "Perguntar sobre"}
              </button>
            </div>
          ) : null}

          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
            aria-live="polite"
          >
            {messages.map((message, index) => {
              return message.role === "user" ? (
                <div
                  key={`user-${index}`}
                  className={`flex justify-end${index === messages.length - 1 ? " scroll-mt-2" : ""}`}
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
                    leadCreated={message.leadCreated}
                    vehicleContext={vehicleContext}
                    followups={
                      !pending &&
                      index === messages.length - 1 &&
                      (message.vehicles?.length ?? 0) > 0
                        ? chatFollowupsAfterCards(
                            message.stockHref ?? null,
                            message.vehicles ?? [],
                          )
                        : []
                    }
                    onFollowup={(item) => void send(item, "followup")}
                    onVehicleClick={(vehicle) => {
                      trackChatEvent("ChatVehicleClick", {
                        source: sourceRef.current,
                        intent: lastIntentRef.current,
                        vehicle_ids: [vehicle.id],
                        message_count: messageCountRef.current,
                      });
                    }}
                    onStockExplore={() => {
                      trackChatEvent("ChatStockExplore", {
                        source: sourceRef.current,
                        intent: lastIntentRef.current,
                        result_count: message.vehicles?.length ?? 0,
                        message_count: messageCountRef.current,
                      });
                    }}
                  />
                </AssistantRow>
              );
            })}
            {showTyping ? (
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
                {activeSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={pending}
                    onClick={() => void send(resolveSuggestionPrompt(suggestion, vehicleContext), "suggestion")}
                    className="min-h-11 rounded-xl border border-white/15 bg-[#121214] px-3 py-2 text-left text-[12px] leading-snug text-cream transition hover:border-brand/50 hover:bg-brand/15"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {vehicleContext && started && !pending ? (
            <div className="hidden grid-cols-2 gap-1.5 border-t border-white/10 bg-[#121214] px-3 py-2 lg:grid">
              {activeSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(resolveSuggestionPrompt(suggestion, vehicleContext), "suggestion")}
                  className="flex items-center justify-center rounded-lg border border-white/15 bg-asphalt px-2 py-1.5 text-center text-[11px] font-medium leading-tight text-cream/90 transition hover:border-brand/40 hover:bg-brand/15 hover:text-cream"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

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
                disabled={pending}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (!pending) void send(draft);
                  }
                }}
                placeholder={
                  vehicleContext
                    ? vehicleContext.sold
                      ? `Procurando similar a ${isMoto ? "esta" : "este"} ${vehicleContext.model}?`
                      : isMoto
                        ? `Dúvida sobre a ${vehicleContext.model}?`
                        : `Dúvida sobre o ${vehicleContext.model}?`
                    : "Ex.: HB20 até 70 mil"
                }
                maxLength={800}
                rows={1}
                autoComplete="off"
                className="min-h-[48px] max-h-28 min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-asphalt px-3 py-2.5 text-base text-cream outline-none placeholder:text-muted focus:border-white/25 focus:bg-[#141416] disabled:opacity-60 lg:text-sm"
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
        onClick={() => {
          if (open) closeChat();
          else openChat("launcher");
        }}
        aria-expanded={open}
        aria-label={open ? "Fechar chat" : "Abrir chat da Sua Garagem"}
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
