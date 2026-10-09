"use client";

import Link from "next/link";
import { publicPhotoSrc } from "@/lib/public-photo-url";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { VehicleCardWhatsApp } from "@/components/site/VehicleCardWhatsApp";
import {
  IconArrowRight,
  IconChat,
  IconGearShift,
  IconFileText,
  IconClose,
  IconRefresh,
  IconSend,
  IconWhatsApp,
} from "@/components/site/icons";
import {
  chatFollowupsAfterCards,
  chatStockExploreLabel,
  chatVehicleLabel,
  chatVehiclePrice,
  polishChatReplyWithCards,
  type ChatVehicleCard,
} from "@/lib/chat-cards";
import {
  CHAT_HELP_LABEL,
  consumeSiteChatOpenRequest,
  SITE_CHAT_OPEN_EVENT,
  type SiteChatOpenRequest,
} from "@/lib/chat-open";
import {
  emptyHistory,
  readHistoryStore,
  writeHistoryStore,
  saveHistoryForKey,
  readVehicleCards,
  type ChatHistoryStore,
  type ChatMessage,
} from "@/lib/chat-history";
import { chatPageKey } from "@/lib/chat-page";
import {
  chatKeyboardShellStyle,
  chatMobileKeyboardCovered,
} from "@/lib/chat-mobile-viewport";
import { CHAT_FALLBACK_REPLY } from "@/lib/chat-prompt";
import { requestChatReply, ChatRequestError } from "@/lib/chat-client-request";
import { readChatResearch } from "@/lib/chat-research-data";
import {
  chatHeaderWhatsAppMessage,
  chatSessionHints,
  chatWhatsAppCta,
  displayChatText,
  formatChatHandoffMessage,
  lastShownChatVehicles,
  lastSingleChatVehicleId,
  resolveChatRequestVehicleId,
  resolveChatWhatsAppVehicle,
  splitChatLinks,
  type ChatHandoffContext,
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

const ASSISTANT_NAME = "Sua Garagem";
const VEHICLE_PLACEHOLDER = "/branding/placeholder-car.png";

const OPENING: ChatMessage = {
  role: "assistant",
  content:
    "Me conta o modelo, o câmbio ou quanto você quer investir. Eu comparo as opções do estoque com você.",
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

const CHAT_STORAGE_OPEN_KEY = "garagem_site_chat_is_open_v1";

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
    if (
      lower.includes("semelhante") ||
      lower.includes("opções") ||
      lower.includes("opcoes")
    ) {
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
  if (
    lower.includes("garantia") ||
    lower.includes("condições") ||
    lower.includes("condicoes")
  ) {
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
      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#141417] bg-brand" />
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
  handoff,
}: {
  vehicle: ChatVehicleCard;
  onVehicleClick?: (vehicle: ChatVehicleCard) => void;
  handoff?: ChatHandoffContext;
}) {
  const version = vehicle.version?.trim();
  const photo = vehicle.photo || VEHICLE_PLACEHOLDER;
  const label = chatVehicleLabel(vehicle);

  const sessionContext =
    handoff?.priceLimit != null || handoff?.transmission != null;
  const whatsappMessage = sessionContext
    ? formatChatHandoffMessage({
        vehicles: [
          {
            brand: vehicle.brand,
            model: vehicle.model,
            version: vehicle.version,
            year: vehicle.year,
            label,
            category: vehicle.category,
          },
        ],
        priceLimit: handoff?.priceLimit,
        transmission: handoff?.transmission,
      })
    : formatVehicleWhatsAppMessage({
        brand: vehicle.brand,
        model: vehicle.model,
        version: vehicle.version,
        yearModel: vehicle.year,
        price: vehicle.price,
        path: vehicle.href,
        isMoto: vehicle.category === "moto",
      });

  return (
    <article
      data-chat-vehicle={vehicle.id}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-[#18181d] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.6)]"
    >
      <Link
        href={vehicle.href}
        prefetch={false}
        onClick={() => onVehicleClick?.(vehicle)}
        aria-label={`${label} — ${chatVehiclePrice(vehicle)}. Abrir ficha`}
        className="block p-3 transition hover:bg-white/[0.025] touch-manipulation"
      >
        <div className="flex items-start gap-3">
          <span className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-xl bg-asphalt">
            {/* eslint-disable-next-line @next/next/no-img-element -- capa remota, sem cota /_next/image */}
            <img
              src={publicPhotoSrc(photo)}
              alt=""
              width={224}
              height={168}
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
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[16px] font-semibold leading-5 text-cream [overflow-wrap:break-word]">
              {vehicle.title}
            </h3>
            {version ? (
              <p className="mt-1 text-[12px] leading-[1.5] text-cream/70 [overflow-wrap:break-word]">
                {version}
              </p>
            ) : null}
          </div>
          <IconArrowRight className="mt-0.5 hidden h-4 w-4 shrink-0 text-muted min-[374px]:block" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] leading-4 text-cream/80">
          {[
            vehicle.year ? String(vehicle.year) : null,
            Number.isFinite(vehicle.km)
              ? `${vehicle.km.toLocaleString("pt-BR")} km`
              : null,
            vehicle.transmission,
          ]
            .filter(Boolean)
            .map((fact, index) => (
              <span
                key={index}
                className="rounded-md border border-white/[0.08] bg-black/15 px-2 py-1"
              >
                {fact}
              </span>
            ))}
        </div>
        <p className="mt-2.5 font-display text-[23px] font-bold leading-7 tabular-nums tracking-[-0.02em] text-[#ff555b]">
          {chatVehiclePrice(vehicle)}
        </p>
      </Link>
      <VehicleCardWhatsApp
        vehicleId={vehicle.id}
        label={label}
        message={whatsappMessage}
        value={vehicle.price}
        make={vehicle.brand}
        model={vehicle.model}
        year={vehicle.year}
        path={vehicle.href}
        showOnStockList
        trackingLabel="chat-card"
        campaign="chat"
        className="!text-[13px] !normal-case !tracking-normal"
      />
    </article>
  );
}

function ChatBubbleBody({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter(Boolean);
  return (
    <div className="w-fit max-w-full rounded-[18px] rounded-tl-md bg-[#1D1D22] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      {blocks.map((block, index) => {
        const parts = splitChatLinks(block).filter(
          (part) => part.type !== "link" || !/wa\.me\//i.test(part.href),
        );
        const evidenceNote = /não foi medido|nao foi medido/i.test(block);
        return (
          <p
            key={`p-${index}`}
            className={`whitespace-pre-wrap text-pretty ${
              index > 0 ? "mt-2.5 " : ""
            }${
              evidenceNote
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

function ChatResearchDetails({
  research,
  answerText,
}: {
  research: import("@/lib/chat-research-data").ChatResearch;
  answerText?: string;
}) {
  // The answer already explains an unavailable search. Avoid repeating a
  // second empty panel before the ad and pushing the contact below the fold.
  if (research.unavailable) return null;
  const sources = [...new Map([
    ...(research.comparison?.sources ?? []),
    ...research.paragraphs.flatMap(paragraph => paragraph.sources),
  ].map(source => [source.href, source])).values()];
  const extraParagraphs = research.paragraphs.filter(paragraph => !answerText?.includes(paragraph.text));
  return (
    <section
      aria-label="Pesquisa técnica e fontes"
      className="space-y-2 rounded-xl border border-white/10 bg-white/[0.025] px-3.5 text-[13px] leading-relaxed text-cream/90"
    >
      {research.comparison && !answerText?.includes(research.comparison.text) ? (
        <p className="pt-3">{research.comparison.text}</p>
      ) : null}
      <details>
        <summary className="min-h-11 cursor-pointer py-3 font-semibold text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          Dados e fontes ({sources.length})
        </summary>
        <p className="mb-2 text-[12px] text-cream/60">Dados do modelo, da versão e do ano.</p>
        {extraParagraphs.map((paragraph, index) => (
          <p key={index} className="mb-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{paragraph.text}</p>
        ))}
        <ul className="space-y-1 pb-3">
          {sources.map(source => (
            <li key={source.href}>
              <a href={source.href} target="_blank" rel="noopener noreferrer"
                className="block min-h-11 rounded-lg border border-white/10 px-3 py-2 text-[12px] text-cream/85 underline underline-offset-2 [overflow-wrap:anywhere]">
                {source.title} ↗
              </a>
            </li>
          ))}
        </ul>
      </details>
      {research.suggestionsHtml ? (
        <iframe title="Sugestões da pesquisa Google" sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer" srcDoc={research.suggestionsHtml}
          className="mb-3 h-28 w-full rounded-lg border-0 bg-white" />
      ) : null}
    </section>
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
  handoff,
  research,
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
  handoff?: ChatHandoffContext;
  research?: import("@/lib/chat-research-data").ChatResearch;
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
    ? chatWhatsAppCta(text, ctaVehicle, {
        handoff: {
          vehicles:
            vehicles.length > 0
              ? vehicles.map((vehicle) => ({
                  brand: vehicle.brand,
                  model: vehicle.model,
                  version: vehicle.version,
                  year: vehicle.year,
                  label: vehicle.title,
                  category: vehicle.category,
                }))
              : handoff?.vehicles,
          priceLimit: handoff?.priceLimit,
          transmission: handoff?.transmission,
        },
      })
    : null;

  return (
    <>
      {visible ? <ChatBubbleBody text={visible} /> : null}
      {research ? <ChatResearchDetails research={research} answerText={source} /> : null}
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
              handoff={handoff}
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
        <ChatWhatsAppButton
          href={cta.href}
          label={cta.label}
          benefit={cta.benefit}
        />
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
  const [vehicleContext, setVehicleContext] =
    useState<ChatVehicleContext | null>(getChatVehicleContext);

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
  const [failure, setFailure] = useState<string | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  const [mobileDialog, setMobileDialog] = useState(false);
  const followScrollRef = useRef(true);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const requestRef = useRef<{
    controller: AbortController;
    history: ChatMessage[];
    question: string;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
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
    const unfinished = saved.at(-1);
    if (unfinished?.role === "user") {
      setDraft(unfinished.content);
      setFailure(
        "Esta pergunta ficou sem uma resposta concluída. Você pode rever a mensagem ou continuar com o consultor no WhatsApp.",
      );
    }
    messageCountRef.current = saved.filter(
      (item) => item.role === "user",
    ).length;
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
    if (!pending) saveHistoryForKey(pageKey, messages);
  }, [messages, pageKey, pending]);

  useEffect(() => {
    if (!restoredRef.current) return;
    if (pageKeyRef.current === pageKey) return;
    const previousKey = pageKeyRef.current;
    const active = requestRef.current;
    requestRef.current = null;
    active?.controller.abort();
    sendingRef.current = false;
    setPending(false);
    setFailure(null);
    setDraft("");
    followScrollRef.current = true;
    setShowLatest(false);
    pageKeyRef.current = pageKey;
    saveHistoryForKey(previousKey, active?.history ?? messagesRef.current);
    const store = readHistoryStore();
    const next = historyForKey(store, pageKey);
    setMessages(next);
    if (next.at(-1)?.role === "user") {
      setDraft(next.at(-1)!.content);
      setFailure(
        "Esta pergunta ficou sem uma resposta concluída. Você pode rever a mensagem ou continuar com o consultor no WhatsApp.",
      );
    }
    messageCountRef.current = next.filter(
      (item) => item.role === "user",
    ).length;
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

  useEffect(
    () => () => {
      requestRef.current?.controller.abort();
      requestRef.current = null;
    },
    [],
  );

  function openChat(source: string) {
    sourceRef.current = source || "site";
    if (!openRef.current) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      followScrollRef.current = true;
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
    requestAnimationFrame(() => {
      const previous = returnFocusRef.current;
      const target =
        previous?.isConnected && previous.getClientRects().length
          ? previous
          : Array.from(
              document.querySelectorAll<HTMLElement>(
                `[aria-label="${CHAT_HELP_LABEL}"]`,
              ),
            ).find((node) => node.getClientRects().length);
      target?.focus({ preventScroll: true });
    });
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

  function scrollToLatest() {
    const node = listRef.current;
    if (!node) return;
    const latest = node.querySelector<HTMLElement>("[data-chat-latest='1']");
    const top =
      latest && latest.offsetHeight > node.clientHeight
        ? latest.getBoundingClientRect().top -
          node.getBoundingClientRect().top +
          node.scrollTop -
          8
        : node.scrollHeight;
    node.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }

  useEffect(() => {
    if (open && followScrollRef.current) scrollToLatest();
  }, [open, messages, pending]);

  useEffect(() => {
    if (!open) return;
    // Focus a control without opening the mobile keyboard on launch.
    shellRef.current
      ?.querySelector<HTMLButtonElement>("[aria-label='Fechar chat']")
      ?.focus({ preventScroll: true });
  }, [open]);

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
      if (
        event.key !== "Tab" ||
        window.matchMedia("(min-width: 1024px)").matches
      )
        return;
      const panel = shellRef.current?.querySelector("[role='dialog']");
      const controls = panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              "a[href], button:not([disabled]), textarea:not([disabled])",
            ),
          ).filter((node) => node.getClientRects().length > 0)
        : [];
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel?.contains(active))) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !panel?.contains(active))
      ) {
        event.preventDefault();
        first?.focus();
      }
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
    const previousOverflow = document.body.style.overflow;
    const desktopQuery = window.matchMedia("(min-width: 1024px)");

    const clearShell = () => {
      document.body.removeAttribute("data-chat-keyboard");
      shell.style.top = "";
      shell.style.height = "";
      shell.style.bottom = "";
      shell.style.left = "";
      shell.style.width = "";
      shell.style.right = "";
    };

    let keyboardWasOpen = false;
    const sync = () => {
      setMobileDialog(!desktopQuery.matches);
      const { keyboardOpen } = chatMobileKeyboardCovered({
        innerHeight: window.innerHeight,
        viewportHeight: viewport.height,
        viewportOffsetTop: viewport.offsetTop,
      });
      document.body.style.overflow =
        keyboardOpen || !desktopQuery.matches ? "hidden" : previousOverflow;
      if (!keyboardOpen) {
        keyboardWasOpen = false;
        clearShell();
        return;
      }
      document.body.setAttribute("data-chat-keyboard", "");
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
    desktopQuery.addEventListener("change", sync);
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      desktopQuery.removeEventListener("change", sync);
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      clearShell();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function commitAssistant(
    data: {
      reply?: string;
      vehicles?: unknown;
      stockHref?: unknown;
      leadCreated?: unknown;
      research?: unknown;
    },
    intent: string,
    replaceLastAssistant: boolean,
  ) {
    const stockHref =
      typeof data.stockHref === "string" &&
      data.stockHref.startsWith("/estoque")
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
      research: readChatResearch(data.research),
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

    const nextHistory = [
      ...messages,
      { role: "user" as const, content: mensagem },
    ];
    setMessages(nextHistory);
    saveHistoryForKey(pageKeyRef.current, nextHistory);
    setDraft("");
    setPending(true);

    const controller = new AbortController();
    const active = { controller, history: nextHistory, question: mensagem };
    requestRef.current = active;
    const timer = window.setTimeout(() => controller.abort("timeout"), 45_000);
    let streamed = false;
    followScrollRef.current = true;
    setShowLatest(false);
    setFailure(null);
    try {
      const data = await requestChatReply(
        {
          mensagem,
          vehicleId: resolveChatRequestVehicleId({
            mensagem,
            pageVehicleId: vehicleContext?.id,
            lastSingleCardId: lastSingleChatVehicleId(messages),
            shownCards: lastShownChatVehicles(messages),
          }),
          historico: messages
            .filter(
              (item, index) => index !== 0 || item.content !== OPENING.content,
            )
            .slice(-12)
            .map(({ role, content }) => ({ role, content })),
        },
        controller.signal,
        (text) => {
          if (requestRef.current !== active) return;
          streamed = true;
          setMessages((current) => {
            const last = current[current.length - 1];
            if (last?.role === "assistant")
              return [
                ...current.slice(0, -1),
                { ...last, content: last.content + text },
              ];
            return [...current, { role: "assistant", content: text }];
          });
        },
      );
      if (requestRef.current === active)
        commitAssistant(data, intent, streamed);
    } catch (error) {
      if (requestRef.current !== active) return;
      setMessages(nextHistory);
      setDraft((current) => current || mensagem);
      const reply =
        error instanceof ChatRequestError
          ? displayChatText(error.message)
          : "Não consegui concluir a resposta. Sua mensagem ficou no campo para você tentar novamente.";
      setFailure(reply);
    } finally {
      window.clearTimeout(timer);
      if (requestRef.current === active) {
        requestRef.current = null;
        sendingRef.current = false;
        setPending(false);
      }
    }
  }

  function stopReply() {
    const active = requestRef.current;
    if (!active) return;
    requestRef.current = null;
    active.controller.abort();
    sendingRef.current = false;
    setPending(false);
    setMessages(active.history);
    setDraft((current) => current || active.question);
    setFailure(
      "Resposta interrompida. Sua mensagem ficou no campo. Se você já informou seu contato, confirme o atendimento com o consultor no WhatsApp.",
    );
  }

  const started = messages.length > 1;
  const sessionHints = chatSessionHints(messages);
  const lastChatCards = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" && (message.vehicles?.length ?? 0) > 0,
    )?.vehicles;
  const headerWhatsAppHref = whatsappUrl(
    chatHeaderWhatsAppMessage({
      cards: lastChatCards,
      pageMessage: vehicleContext
        ? vehicleContext.brand && vehicleContext.model && vehicleContext.year
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
        : null,
      priceLimit: sessionHints.priceLimit,
      transmission: sessionHints.transmission,
    }),
    {
      campaign: "chat",
      content: whatsappContentFromVehicle({
        id: lastChatCards?.[0]?.id ?? vehicleContext?.id,
        path: lastChatCards?.[0]?.href ?? vehicleContext?.path,
      }),
    },
  );
  const showSuggestions = !started && !pending;
  const canSend = !pending && !sendingRef.current && draft.trim().length >= 2;
  const lastIsAssistant = messages[messages.length - 1]?.role === "assistant";
  const showTyping = pending && !lastIsAssistant;

  function resetConversation() {
    if (pending || sendingRef.current) return;
    // Nova conversa zera o histórico local. O próximo POST vai sem orçamento, câmbio ou intenção.
    messageCountRef.current = 0;
    lastIntentRef.current = "other";
    leadTrackedRef.current = false;
    setMessages([OPENING]);
    setDraft("");
    setFailure(null);
    followScrollRef.current = true;
    setShowLatest(false);
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
          aria-modal={mobileDialog || undefined}
          className="site-chat-panel pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#101013] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.85),0_0_0_1px_rgba(0,0,0,0.5)]"
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
                  title="Assistente virtual"
                >
                  Assistente virtual
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                <a
                  href={headerWhatsAppHref}
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
                  <p className="text-[13px] font-medium leading-5 text-cream">
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
            className="site-chat-scroll min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5"
            onScroll={(event) => {
              const node = event.currentTarget;
              const nearBottom =
                node.scrollHeight - node.scrollTop - node.clientHeight < 80;
              followScrollRef.current = nearBottom;
              setShowLatest(!nearBottom && messages.length > 1);
            }}
          >
            {messages.map((message, index) => {
              const latest = index === messages.length - 1;
              return message.role === "user" ? (
                <div
                  key={`user-${index}`}
                  className={`flex justify-end pl-10${latest ? " scroll-mt-2" : ""}`}
                  data-chat-latest={latest ? "1" : undefined}
                >
                  <p className="whitespace-pre-wrap rounded-[18px] rounded-tr-md bg-[#28282f] ring-1 ring-inset ring-white/10 px-4 py-2.5 text-[14px] leading-[1.5] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] [overflow-wrap:anywhere]">
                    {message.content}
                  </p>
                </div>
              ) : (
                <AssistantRow key={`assistant-${index}`} latest={latest}>
                  {index === 0 && message.content === OPENING.content ? (
                    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#262129] via-[#1b1b21] to-[#17171c] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#ff7378]">
                        Ajuda para escolher
                      </p>
                      <h2 className="mt-2 font-display text-[22px] font-semibold leading-[1.2] tracking-[-0.025em] text-cream">
                        Vamos encontrar o seu próximo veículo.
                      </h2>
                      <p className="mt-3 text-[14px] leading-[1.6] text-cream/75">
                        {OPENING.content}
                      </p>
                    </div>
                  ) : (
                    <ChatText
                      text={message.content}
                      vehicles={message.vehicles}
                      stockHref={message.stockHref}
                      leadCreated={message.leadCreated}
                      research={message.research}
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
                      handoff={sessionHints}
                    />
                  )}
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
              <div className="!mt-4">
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Por onde você quer começar?
                </p>
                <ul className="grid grid-cols-2 gap-2">
                  {activeSuggestions.map((suggestion, index) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          void send(
                            resolveSuggestionPrompt(suggestion, vehicleContext),
                            "suggestion",
                          )
                        }
                        className="group flex h-full min-h-[88px] w-full flex-col items-start justify-between gap-2 rounded-xl border border-white/10 bg-[#19191e] p-3 text-left text-[13px] leading-snug text-cream/90 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-cream active:bg-white/[0.06] touch-manipulation"
                      >
                        <span className="text-cream/50" aria-hidden="true">
                          {index === 0 ? (
                            <span className="font-display text-[15px] font-semibold">
                              R$
                            </span>
                          ) : index === 1 ? (
                            <IconGearShift className="h-4 w-4" />
                          ) : index === 2 ? (
                            <IconFileText className="h-4 w-4" />
                          ) : (
                            <IconRefresh className="h-4 w-4" />
                          )}
                        </span>
                        <span>{suggestion}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {failure ? (
              <div
                role="alert"
                className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3 text-[12px] leading-5 text-cream/85"
              >
                <p>{failure}</p>
                <div className="mt-1 flex flex-wrap gap-x-4">
                  <button
                    type="button"
                    className="min-h-11 font-semibold underline underline-offset-4"
                    onClick={() => inputRef.current?.focus()}
                  >
                    Rever mensagem
                  </button>
                  <a
                    href={headerWhatsAppHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackWhatsAppClick("chat", chatFunnelRef())}
                    className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-[#25D366]"
                  >
                    <IconWhatsApp className="h-4 w-4" />
                    Falar com consultor
                  </a>
                </div>
              </div>
            ) : null}
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {pending
              ? "Consultando sua pergunta"
              : messages.length > 1
                ? "Resposta disponível no chat"
                : "Assistente aberto"}
          </p>
          {showLatest ? (
            <div className="flex shrink-0 justify-center border-t border-white/[0.06] py-1">
              <button
                type="button"
                className="min-h-11 rounded-full px-4 text-[12px] font-semibold text-cream"
                onClick={() => {
                  followScrollRef.current = true;
                  setShowLatest(false);
                  scrollToLatest();
                }}
              >
                Ver última resposta ↓
              </button>
            </div>
          ) : null}
          {vehicleContext && started && !pending ? (
            <div className="hidden flex-wrap gap-2 border-t border-white/[0.07] bg-[#141417] px-4 py-3 lg:flex">
              {activeSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() =>
                    void send(
                      resolveSuggestionPrompt(suggestion, vehicleContext),
                      "suggestion",
                    )
                  }
                  className="min-h-11 rounded-full border border-white/[0.12] px-4 text-[12.5px] font-medium text-cream/85 transition hover:border-white/25 hover:bg-white/[0.04] hover:text-cream active:bg-white/[0.06]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <form
            data-chat-composer=""
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
                  window.setTimeout(() => {
                    if (followScrollRef.current) scrollToLatest();
                  }, 280);
                }}
                enterKeyHint="send"
                inputMode="text"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
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
              {pending ? (
                <button
                  type="button"
                  onClick={stopReply}
                  className="min-h-11 shrink-0 rounded-lg px-2.5 text-[12px] font-semibold text-cream"
                >
                  Parar resposta
                </button>
              ) : started ? (
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
