"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { VehicleCardWhatsApp } from "@/components/site/VehicleCardWhatsApp";
import {
  IconArrowRight,
  IconChat,
  IconClose,
  IconRefresh,
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
  CHAT_HELP_LABEL,
  consumeSiteChatOpenRequest,
  SITE_CHAT_OPEN_EVENT,
  type SiteChatOpenRequest,
} from "@/lib/chat-open";
import { chatPageKey } from "@/lib/chat-page";
import {
  chatKeyboardShellStyle,
  chatMobileKeyboardCovered,
} from "@/lib/chat-mobile-viewport";
import { CHAT_FALLBACK_REPLY } from "@/lib/chat-prompt";
import {
  drainSseBuffer,
  finalChatStreamReply,
  parseSseChunks,
  readChatStreamFrame,
} from "@/lib/chat-stream";
import {
  chatWhatsAppCta,
  displayChatText,
  lastShownChatVehicles,
  lastSingleChatVehicleId,
  resolveChatRequestVehicleId,
  resolveChatWhatsAppVehicle,
  splitChatLinks,
} from "@/lib/chat-text";
import { formatVehicleWhatsAppMessage } from "@/lib/vehicle-display";
import {
  classifyChatIntent,
  trackChatEvent,
  trackLead,
  trackWhatsAppClick,
} from "@/lib/meta-pixel";
import {
  WHATSAPP_MESSAGES,
  whatsappContentFromVehicle,
  whatsappUrl,
} from "@/lib/site";
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
    "Oi! Te ajudo rápido a achar o seminovo. Me conta o orçamento ou o modelo — o detalhe a gente fecha no WhatsApp.",
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

function ChatLogo() {
  return (
    <span className="relative shrink-0 max-[374px]:hidden" aria-hidden="true">
      <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-b from-[#F0282C] to-[#C8121A] font-display text-[17px] font-bold italic leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_6px_16px_-6px_rgba(232,24,28,0.7)]">
        G
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#141417] bg-[#25D366]" />
    </span>
  );
}

function chatFunnelRef() {
  const vehicle = getChatVehicleContext();
  if (!vehicle?.id) return undefined;
  return {
    vehicleId: vehicle.id,
    slug: whatsappContentFromVehicle({
      id: vehicle.id,
      path: vehicle.path,
    }),
  };
}

function ChatWhatsAppButton({
  href,
  label,
  benefit,
}: {
  href: string;
  label: string;
  benefit: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackWhatsAppClick("chat", chatFunnelRef())}
      className="group flex min-h-14 w-full items-center gap-3 rounded-2xl bg-[#25D366] py-2.5 pl-2.5 pr-4 text-left text-[#05170C] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_24px_-14px_rgba(37,211,102,0.9)] transition hover:bg-[#34DE75] active:bg-[#1FC05B] touch-manipulation"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#05170C]/[0.12]">
        <IconWhatsApp className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[14px] font-semibold leading-5">
          {label}
        </span>
        <span className="block text-[12px] leading-4 text-[#05170C]/75">
          {benefit}
        </span>
      </span>
      <IconArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
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
  const whatsappMessage = formatVehicleWhatsAppMessage({
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    yearModel: vehicle.year,
    price: vehicle.price,
    path: vehicle.href,
    isMoto: vehicle.category === "moto",
  });

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#17171B] transition-colors hover:border-white/[0.16]">
      <div className="flex gap-3 p-2.5">
        <span className="relative h-[5.25rem] w-28 shrink-0 overflow-hidden rounded-xl bg-asphalt">
          {/* eslint-disable-next-line @next/next/no-img-element -- capa remota, sem cota /_next/image */}
          <img
            src={photo}
            alt=""
            width={224}
            height={168}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            onError={(event) => {
              const image = event.currentTarget;
              if (image.dataset.fallbackUsed === "1") return;
              image.dataset.fallbackUsed = "1";
              image.src = VEHICLE_PLACEHOLDER;
            }}
          />
          <span
            className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.06]"
            aria-hidden="true"
          />
        </span>
        <div className="flex min-w-0 flex-1 flex-col py-0.5">
          <h3
            className="truncate font-display text-[14px] font-semibold leading-5 text-cream"
            title={vehicle.title}
          >
            {vehicle.title}
          </h3>
          {version ? (
            <p
              className="truncate text-[12px] leading-4 text-muted"
              title={version}
            >
              {version}
            </p>
          ) : null}
          {meta ? (
            <p
              className="mt-1 truncate text-[12px] leading-4 tabular-nums text-cream/60"
              title={meta}
            >
              {meta}
            </p>
          ) : null}
          <p className="mt-auto pt-1 font-display text-[17px] font-bold leading-5 tabular-nums tracking-[-0.01em] text-cream">
            {chatVehiclePrice(vehicle)}
          </p>
        </div>
      </div>
      <div className="flex border-t border-white/[0.06]">
        <Link
          href={vehicle.href}
          prefetch={false}
          onClick={() => onVehicleClick?.(vehicle)}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 text-[13px] font-semibold text-cream transition after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:bg-white/[0.04] touch-manipulation"
          aria-label={`${label} — ${chatVehiclePrice(vehicle)}. Ver anúncio`}
        >
          Ver anúncio
          <IconArrowRight className="h-3.5 w-3.5 text-cream/70 transition group-hover:translate-x-0.5 group-hover:text-cream" />
        </Link>
        <span className="w-px bg-white/[0.06]" aria-hidden="true" />
        <VehicleCardWhatsApp
          vehicleId={vehicle.id}
          label={label}
          message={whatsappMessage}
          value={vehicle.price}
          make={vehicle.brand}
          model={vehicle.model}
          year={vehicle.year}
          variant="chat"
          trackingLabel="chat-card"
        />
      </div>
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
      category: row.category ? String(row.category) : undefined,
      photo,
    });
  }
  return cards;
}

function ChatBubbleBody({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter(Boolean);
  return (
    <div className="w-fit max-w-full rounded-[18px] rounded-tl-md bg-[#1D1D22] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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
            className={`whitespace-pre-wrap text-pretty ${
              index > 0 ? "mt-2.5 " : ""
            }${
              consumo
                ? "text-[13px] leading-[1.5] text-cream/70"
                : "text-[14px] leading-[1.55] text-cream/95"
            }`}
          >
            {parts.map((part, partIndex) =>
              part.type === "link" ? (
                <a
                  key={`${part.href}-${partIndex}`}
                  href={part.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-cream underline decoration-white/30 underline-offset-[3px] transition hover:decoration-cream"
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
  showWhatsApp = true,
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
  showWhatsApp?: boolean;
  followups?: string[];
  onFollowup?: (text: string) => void;
  onVehicleClick?: (vehicle: ChatVehicleCard) => void;
  onStockExplore?: () => void;
  vehicleContext?: ChatVehicleContext | null;
}) {
  const source =
    vehicles.length > 0 ? polishChatReplyWithCards(text, vehicles) : text;
  const visible = displayChatText(source);
  const ctaVehicle = resolveChatWhatsAppVehicle(
    vehicleContext
      ? {
          id: vehicleContext.id,
          label: vehicleContext.label,
          brand: vehicleContext.brand,
          model: vehicleContext.model,
          version: vehicleContext.version,
          year: vehicleContext.year,
          price: vehicleContext.price,
          path: vehicleContext.path,
          category: vehicleContext.category,
          sold: vehicleContext.sold,
        }
      : null,
    vehicles,
  );
  const cta = showWhatsApp
    ? chatWhatsAppCta(text, ctaVehicle, { force: true })
    : null;

  return (
    <>
      {visible ? <ChatBubbleBody text={visible} /> : null}
      {leadCreated ? (
        <div
          role="status"
          className="flex min-h-11 items-center gap-2.5 rounded-xl bg-[#25D366]/[0.08] px-3.5 py-2.5 text-[13px] leading-snug text-cream/90 ring-1 ring-inset ring-[#25D366]/25"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-[#25D366] shadow-[0_0_0_3px_rgba(37,211,102,0.18)]"
            aria-hidden="true"
          />
          Contato registrado. A equipe continua com você no WhatsApp.
        </div>
      ) : null}
      {vehicles.length > 0 ? (
        <div className="space-y-2">
          {vehicles.map((vehicle) => (
            <ChatVehicleMini
              key={vehicle.id}
              vehicle={vehicle}
              onVehicleClick={onVehicleClick}
            />
          ))}
        </div>
      ) : null}
      {stockHref ? (
        <Link
          href={stockHref}
          prefetch={false}
          onClick={onStockExplore}
          className="group flex min-h-11 items-center justify-between gap-2 rounded-xl border border-white/[0.08] px-4 text-[13px] font-semibold text-cream transition hover:border-white/[0.16] hover:bg-white/[0.03] touch-manipulation"
        >
          {chatStockExploreLabel(stockHref)}
          <IconArrowRight className="h-4 w-4 shrink-0 text-cream/60 transition group-hover:translate-x-0.5 group-hover:text-cream" />
        </Link>
      ) : null}
      {cta ? (
        <ChatWhatsAppButton href={cta.href} label={cta.label} benefit={cta.benefit} />
      ) : null}
      {followups.length > 0 && onFollowup ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {followups.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onFollowup(item)}
              className="min-h-11 rounded-full border border-white/[0.12] px-4 text-[13px] font-medium text-cream/90 transition hover:border-white/25 hover:bg-white/[0.04] hover:text-cream active:bg-white/[0.06] touch-manipulation"
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
      className={`min-w-0 space-y-2${latest ? " scroll-mt-2" : ""}`}
      data-chat-latest={latest ? "1" : undefined}
    >
      {pending ? (
        <div className="w-fit rounded-[18px] rounded-tl-md bg-[#1D1D22] px-4 py-3.5">
          {children}
        </div>
      ) : (
        children
      )}
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
    if (!open) {
      document.body.removeAttribute("data-chat-open");
      document.body.removeAttribute("data-chat-keyboard");
      return;
    }
    document.body.setAttribute("data-chat-open", "");
    return () => {
      document.body.removeAttribute("data-chat-open");
      document.body.removeAttribute("data-chat-keyboard");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const shell = shellRef.current;
    const viewport = window.visualViewport;
    if (!shell || !viewport) return;

    const clearShell = () => {
      document.body.removeAttribute("data-chat-keyboard");
      document.body.style.overflow = "";
      shell.style.top = "";
      shell.style.height = "";
      shell.style.bottom = "";
      shell.style.left = "";
      shell.style.width = "";
      shell.style.right = "";
    };

    let keyboardWasOpen = false;
    const sync = () => {
      const { keyboardOpen } = chatMobileKeyboardCovered({
        innerHeight: window.innerHeight,
        viewportHeight: viewport.height,
        viewportOffsetTop: viewport.offsetTop,
      });
      if (!keyboardOpen) {
        keyboardWasOpen = false;
        clearShell();
        return;
      }
      document.body.setAttribute("data-chat-keyboard", "");
      document.body.style.overflow = "hidden";
      const frame = chatKeyboardShellStyle({
        viewportHeight: viewport.height,
        viewportOffsetTop: viewport.offsetTop,
        viewportWidth: viewport.width,
        viewportOffsetLeft: viewport.offsetLeft,
      });
      shell.style.top = `${frame.top}px`;
      shell.style.height = `${frame.height}px`;
      shell.style.bottom = "auto";
      if (frame.left != null && frame.width != null) {
        shell.style.left = `${frame.left}px`;
        shell.style.width = `${frame.width}px`;
        shell.style.right = "auto";
      } else {
        shell.style.left = "";
        shell.style.width = "";
        shell.style.right = "";
      }
      if (!keyboardWasOpen) {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      }
      keyboardWasOpen = true;
    };

    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      clearShell();
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
          vehicleId: resolveChatRequestVehicleId({
            mensagem,
            pageVehicleId: vehicleContext?.id,
            lastSingleCardId: lastSingleChatVehicleId(messages),
            shownCards: lastShownChatVehicles(messages),
          }),
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
        let streamedText = "";
        let donePayload: {
          reply?: string;
          vehicles?: unknown;
          stockHref?: unknown;
          leadCreated?: unknown;
        } | null = null;
        while (true) {
          const { done, value } = await reader.read();
          if (value) buffer += decoder.decode(value, { stream: true });
          if (done) buffer += decoder.decode();
          const parsed = done
            ? { frames: drainSseBuffer(buffer), rest: "" }
            : parseSseChunks(buffer);
          buffer = parsed.rest;
          for (const frame of parsed.frames) {
            const event = readChatStreamFrame(frame.event, frame.data);
            if (!event) continue;
            if (event.type === "token" && event.text) {
              streamed = true;
              streamedText += event.text;
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
          if (done) break;
        }
        const doneReply =
          typeof donePayload?.reply === "string" ? donePayload.reply : "";
        commitAssistant(
          {
            ...(donePayload ?? {}),
            reply:
              finalChatStreamReply(streamedText, doneReply) ||
              CHAT_FALLBACK_REPLY,
          },
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
      className={`site-chat pointer-events-none fixed z-[60] flex flex-col items-end${
        open ? " is-open" : ""
      }`}
    >
      {open ? (
        <section
          role="dialog"
          aria-labelledby="site-chat-title"
          aria-label="Chat da Garagem"
          className="site-chat-panel pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#111113] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.85),0_0_0_1px_rgba(0,0,0,0.5)]"
          aria-busy={pending}
        >
          <header className="relative shrink-0 border-b border-white/[0.07] bg-[#141417]">
            <div
              className="absolute inset-x-0 top-0 h-0.5 bg-brand-gradient"
              aria-hidden="true"
            />
            <div className="flex items-center gap-2.5 py-3 pl-3.5 pr-1.5 sm:pl-4 sm:pr-2">
              <ChatLogo />
              <div className="min-w-0 flex-1">
                <p
                  id="site-chat-title"
                  className="truncate font-display text-[15px] font-semibold leading-5 tracking-[-0.01em] text-cream"
                >
                  {ASSISTANT_NAME}
                </p>
                <p
                  className="mt-0.5 truncate text-[11px] leading-4 text-muted min-[390px]:text-[12px]"
                  title="dúvida rápida · segue no WhatsApp"
                >
                  dúvida rápida · segue no WhatsApp
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <a
                href={whatsappUrl(
                  vehicleContext
                    ? vehicleContext.brand &&
                      vehicleContext.model &&
                      vehicleContext.year
                      ? formatVehicleWhatsAppMessage({
                          brand: vehicleContext.brand,
                          model: vehicleContext.model,
                          version: vehicleContext.version,
                          yearModel: vehicleContext.year,
                          price: vehicleContext.price,
                          path: vehicleContext.path,
                          isMoto: vehicleContext.category === "moto",
                        })
                      : WHATSAPP_MESSAGES.vehicle(
                          `${vehicleContext.label}${
                            vehicleContext.year ? ` ${vehicleContext.year}` : ""
                          }`.trim(),
                          vehicleContext.category === "moto",
                        )
                    : WHATSAPP_MESSAGES.help,
                  {
                    campaign: "chat",
                    content: whatsappContentFromVehicle({
                      id: vehicleContext?.id,
                      path: vehicleContext?.path,
                    }),
                  },
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick("chat", chatFunnelRef())}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366]/[0.12] text-[#25D366] ring-1 ring-inset ring-[#25D366]/25 transition hover:bg-[#25D366]/20 active:bg-[#25D366]/25 touch-manipulation"
                aria-label="Falar com um vendedor no WhatsApp"
              >
                <IconWhatsApp className="h-5 w-5" />
              </a>
              <button
                type="button"
                onClick={closeChat}
                className="flex h-11 w-11 items-center justify-center rounded-full text-cream/75 transition hover:bg-white/[0.08] hover:text-cream active:bg-white/[0.12] touch-manipulation"
                aria-label="Fechar chat"
              >
                <IconClose className="h-5 w-5" />
              </button>
              </div>
            </div>

          {vehicleContext ? (
            <div className="flex items-center gap-3 border-t border-white/[0.06] py-2 pl-4 pr-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase leading-4 tracking-[0.14em] text-muted">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      vehicleContext.sold ? "bg-amber-400" : "bg-brand"
                    }`}
                    aria-hidden="true"
                  />
                  {vehicleContext.sold
                    ? "Vendido"
                    : isMoto
                      ? "Moto"
                      : "Na tela"}
                </p>
                <p className="truncate text-[13px] font-medium leading-5 text-cream">
                  {vehicleContext.label}
                  {vehicleContext.year ? ` ${vehicleContext.year}` : ""}
                </p>
              </div>
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
                className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[12px] font-semibold transition disabled:opacity-50 touch-manipulation ${
                  vehicleContext.sold
                    ? "bg-amber-400/[0.12] text-amber-200 ring-1 ring-inset ring-amber-400/30 hover:bg-amber-400/20"
                    : "bg-white/[0.07] text-cream ring-1 ring-inset ring-white/10 hover:bg-white/[0.12]"
                }`}
              >
                {vehicleContext.sold
                  ? "Avisar quando chegar"
                  : "Perguntar sobre"}
              </button>
            </div>
          ) : null}
          </header>

          <div
            ref={listRef}
            className="site-chat-scroll flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5"
            aria-live="polite"
          >
            {messages.map((message, index) => {
              const latest = index === messages.length - 1;
              return message.role === "user" ? (
                <div
                  key={`user-${index}`}
                  className={`flex justify-end pl-10${latest ? " scroll-mt-2" : ""}`}
                  data-chat-latest={latest ? "1" : undefined}
                >
                  <p className="whitespace-pre-wrap rounded-[18px] rounded-tr-md bg-brand px-4 py-2.5 text-[14px] leading-[1.5] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] [overflow-wrap:anywhere]">
                    {message.content}
                  </p>
                </div>
              ) : (
                <AssistantRow
                  key={`assistant-${index}`}
                  latest={latest}
                >
                  <ChatText
                    text={message.content}
                    vehicles={message.vehicles}
                    stockHref={message.stockHref}
                    leadCreated={message.leadCreated}
                    showWhatsApp={latest && !pending}
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
              <div className="!mt-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#151518]">
                <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Perguntas rápidas
                </p>
                <ul className="divide-y divide-white/[0.06]">
                  {activeSuggestions.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void send(resolveSuggestionPrompt(suggestion, vehicleContext), "suggestion")}
                        className="group flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[14px] leading-snug text-cream/90 transition hover:bg-white/[0.04] hover:text-cream active:bg-white/[0.06] touch-manipulation"
                      >
                        {suggestion}
                        <IconArrowRight className="h-4 w-4 shrink-0 text-cream/35 transition group-hover:translate-x-0.5 group-hover:text-cream/80" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {vehicleContext && started && !pending ? (
            <div className="hidden flex-wrap gap-2 border-t border-white/[0.07] bg-[#141417] px-4 py-3 lg:flex">
              {activeSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(resolveSuggestionPrompt(suggestion, vehicleContext), "suggestion")}
                  className="min-h-11 rounded-full border border-white/[0.12] px-4 text-[12.5px] font-medium text-cream/85 transition hover:border-white/25 hover:bg-white/[0.04] hover:text-cream active:bg-white/[0.06]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className="shrink-0 border-t border-white/[0.07] bg-[#141417] px-3 pb-2 pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <label htmlFor="site-chat-input" className="sr-only">
              Mensagem
            </label>
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#1B1B20] p-1.5 pl-4 transition focus-within:border-white/25 focus-within:bg-[#1E1E23] focus-within:shadow-[0_0_0_4px_rgba(255,255,255,0.04)]">
              <textarea
                ref={inputRef}
                id="site-chat-input"
                value={draft}
                onFocus={() => {
                  keepFocusRef.current = true;
                  window.setTimeout(() => {
                    listRef.current?.scrollTo({
                      top: listRef.current.scrollHeight,
                    });
                  }, 280);
                }}
                enterKeyHint="send"
                inputMode="text"
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
                className="min-h-11 max-h-28 min-w-0 flex-1 resize-none bg-transparent py-[11px] text-base leading-[22px] text-cream outline-none placeholder:text-muted/80 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Enviar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_16px_-8px_rgba(232,24,28,0.8)] transition hover:bg-[#F0282C] active:bg-[#C8121A] disabled:bg-white/[0.06] disabled:text-cream/30 disabled:shadow-none touch-manipulation"
              >
                <IconSend className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3 pl-1">
              <p className="min-w-0 text-[11px] leading-4 text-muted">
                <span className={started ? undefined : "lg:hidden"}>
                  Resposta curta · consultor no WhatsApp
                </span>
                {started ? null : (
                  <span className="hidden lg:inline">
                    Dúvida rápida aqui. Parcela, vídeo e fechamento no WhatsApp.
                  </span>
                )}
              </p>
              {started ? (
                <button
                  type="button"
                  onClick={resetConversation}
                  className="-mr-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold text-cream/80 transition hover:bg-white/[0.06] hover:text-cream touch-manipulation"
                >
                  <IconRefresh className="h-3.5 w-3.5" />
                  Nova conversa
                </button>
              ) : null}
            </div>
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
        aria-hidden={open}
        tabIndex={open ? -1 : undefined}
        aria-label={open ? "Fechar chat" : CHAT_HELP_LABEL}
        className={`site-chat-launcher pointer-events-auto h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#F0282C] to-[#D0141A] pl-3.5 pr-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_12px_28px_-8px_rgba(232,24,28,0.65),0_2px_6px_rgba(0,0,0,0.35)] ring-1 ring-black/20 transition hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_16px_32px_-8px_rgba(232,24,28,0.75),0_2px_6px_rgba(0,0,0,0.35)] active:translate-y-0 touch-manipulation sm:h-14 sm:gap-2.5 sm:pl-5 sm:pr-6 ${
          open ? "hidden w-12" : "flex w-auto"
        }`}
      >
        {open ? (
          <IconClose className="h-6 w-6" />
        ) : (
          <>
            <IconChat className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
            <span className="whitespace-nowrap font-display text-[12px] font-semibold sm:text-[14px]">
              {CHAT_HELP_LABEL}
            </span>
          </>
        )}
      </button>
    </div>
  );
}
