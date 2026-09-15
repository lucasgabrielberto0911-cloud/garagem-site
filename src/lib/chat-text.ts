import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";
import {
  formatVehicleWhatsAppMessage,
  shortVersion,
  type VehicleWhatsAppIntent,
} from "@/lib/vehicle-display";

export type ChatTextPart =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string };

export type ChatWhatsAppCta = {
  href: string;
  label: string;
  benefit: string;
};

const URL_RE = /https?:\/\/[^\s]+/g;

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function splitChatLinks(text: string): ChatTextPart[] {
  const parts: ChatTextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > last) {
      parts.push({ type: "text", value: text.slice(last, start) });
    }
    const raw = match[0];
    const href = raw.replace(/[.,;:!?]+$/, "");
    parts.push({
      type: "link",
      href,
      label: /wa\.me\//i.test(href) ? "WhatsApp" : href,
    });
    last = start + href.length;
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

/** Texto da bolha sem URL seca — o WhatsApp vira botão à parte. */
export function displayChatText(text: string) {
  let value = text.replace(URL_RE, "");
  value = value
    .split("\n")
    .map((line) => {
      const trimmed = line.replace(/[ \t]+$/g, "");
      if (/^(?:chama no |fala com a gente no |chama a gente no )?whatsapp\s*:?\s*$/i.test(
        trimmed.trim(),
      )) {
        return "";
      }
      return trimmed.replace(/\bwhatsapp\s*:\s*$/i, "WhatsApp");
    })
    .join("\n");
  value = value.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  value = value.replace(/\s+([.,;:])/g, "$1").trim();
  return value;
}

export type ChatWhatsAppVehicle = {
  id?: string;
  label: string;
  brand?: string;
  model?: string;
  version?: string | null;
  year?: number;
  price?: number;
  path?: string;
  category?: string;
  sold?: boolean;
};

export function chatCardWhatsAppVehicle(vehicle: {
  href: string;
  title: string;
  brand: string;
  model: string;
  version?: string | null;
  year: number;
  price: number;
  category?: string;
}): ChatWhatsAppVehicle {
  const version = shortVersion(vehicle.version, vehicle.model);
  return {
    label: `${vehicle.title}${version ? ` ${version}` : ""} ${vehicle.year}`.trim(),
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    year: vehicle.year,
    price: vehicle.price,
    path: vehicle.href,
    category: vehicle.category,
  };
}

export function resolveChatWhatsAppVehicle(
  pageVehicle?: ChatWhatsAppVehicle | null,
  cards: Array<{
    href: string;
    title: string;
    brand: string;
    model: string;
    version?: string | null;
    year: number;
    price: number;
    category?: string;
  }> = [],
): ChatWhatsAppVehicle | null {
  if (pageVehicle?.sold) return pageVehicle;
  if (pageVehicle && cards.length <= 1) return pageVehicle;
  if (cards.length === 1) return chatCardWhatsAppVehicle(cards[0]!);
  return pageVehicle ?? null;
}

function chatVehicleWhatsAppText(
  vehicle: ChatWhatsAppVehicle,
  intent: VehicleWhatsAppIntent,
) {
  const isMoto = vehicle.category === "moto";
  const path = vehicle.path?.startsWith("/estoque/") ? vehicle.path : "";
  if (
    vehicle.price != null &&
    vehicle.price > 0 &&
    vehicle.brand &&
    vehicle.model &&
    vehicle.year &&
    path
  ) {
    return formatVehicleWhatsAppMessage({
      brand: vehicle.brand,
      model: vehicle.model,
      version: vehicle.version,
      yearModel: vehicle.year,
      price: vehicle.price,
      path,
      isMoto,
      intent,
    });
  }
  if (intent === "finance") {
    return WHATSAPP_MESSAGES.vehicleFinance(vehicle.label, isMoto);
  }
  if (intent === "trade") {
    return WHATSAPP_MESSAGES.vehicleTrade(vehicle.label, isMoto);
  }
  if (intent === "video") {
    return WHATSAPP_MESSAGES.vehicleVideo(vehicle.label, isMoto);
  }
  return WHATSAPP_MESSAGES.vehicle(vehicle.label, isMoto);
}

export function chatWhatsAppCta(
  text: string,
  vehicle?: ChatWhatsAppVehicle | null,
  opts: { force?: boolean } = {},
): ChatWhatsAppCta | null {
  if (!opts.force && !/whatsapp|wa\.me/i.test(text)) return null;
  const folded = fold(text);

  if (vehicle?.sold) {
    return {
      href: whatsappUrl(WHATSAPP_MESSAGES.wanted(vehicle.label)),
      label: "Avisar quando chegar",
      benefit: "Consultor procura o modelo pra você",
    };
  }

  if (/assuntos da garagem|outros temas/.test(folded)) {
    return {
      href: whatsappUrl(WHATSAPP_MESSAGES.help),
      label: "Falar com a loja",
      benefit: "Consultor humano · das 8h às 23h",
    };
  }
  if (/financi|parcela|60x|simul|cartao|18 vez/.test(folded)) {
    return {
      href: whatsappUrl(
        vehicle
          ? chatVehicleWhatsAppText(vehicle, "finance")
          : "Olá! Vi o assistente da Garagem e quero simular financiamento em até 60x.",
      ),
      label: "Simular parcela",
      benefit: "O consultor calcula no seu caso",
    };
  }
  if (/\btroca\b/.test(folded)) {
    return {
      href: whatsappUrl(
        vehicle
          ? chatVehicleWhatsAppText(vehicle, "trade")
          : WHATSAPP_MESSAGES.sell,
      ),
      label: "Avaliar meu usado",
      benefit: "Valor da troca com fotos, pelo WhatsApp",
    };
  }
  if (/nao esta na lista|nao tem anuncio|nessa combinacao/.test(folded)) {
    return {
      href: whatsappUrl(WHATSAPP_MESSAGES.wanted()),
      label: "Avisar quando chegar",
      benefit: "Consultor procura o modelo pra você",
    };
  }
  return {
    href: whatsappUrl(
      vehicle ? chatVehicleWhatsAppText(vehicle, "interest") : WHATSAPP_MESSAGES.help,
    ),
    label: "Chamar consultor",
    benefit: "Confirma o modelo · das 8h às 23h",
  };
}

/** “esse / dele” — aponta pro card único da tela, não pra um modelo nomeado. */
export function isAnaphoricVehicleFollowUp(mensagem: string): boolean {
  const folded = fold(mensagem);
  return /\b(esse|essa|esses|essas|este|esta|estes|estas|isso|isto|ele|ela|dele|dela|desse|dessa|deste|desta|nele|nela)\b/.test(
    folded,
  );
}

export type ChatShownVehicle = {
  id: string;
  brand?: string;
  model?: string;
};

export function lastSingleChatVehicleId(
  messages: Array<{ role: string; vehicles?: ChatShownVehicle[] }>,
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== "assistant") continue;
    const vehicles = msg.vehicles ?? [];
    if (vehicles.length === 1) return vehicles[0]?.id;
    if (vehicles.length > 1) return undefined;
  }
  return undefined;
}

/** Últimos mini-anúncios da conversa — inclusive lista de 2–3 cards. */
export function lastShownChatVehicles(
  messages: Array<{ role: string; vehicles?: ChatShownVehicle[] }>,
): ChatShownVehicle[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== "assistant") continue;
    const vehicles = msg.vehicles ?? [];
    if (vehicles.length > 0) return vehicles;
  }
  return [];
}

/** Casa “do fox” com um card já mostrado. Não pega marca solta (volkswagen). */
export function namedShownChatVehicleId(
  mensagem: string,
  shown: ChatShownVehicle[],
): string | undefined {
  if (shown.length === 0) return undefined;
  const folded = fold(mensagem);
  const hits = shown.filter((vehicle) => {
    const model = fold(vehicle.model ?? "");
    return model.length >= 3 && folded.includes(model);
  });
  if (hits.length === 0) return undefined;
  const uniqueIds = [...new Set(hits.map((vehicle) => vehicle.id))];
  if (uniqueIds.length === 1) return uniqueIds[0];
  const uniqueModels = [
    ...new Set(hits.map((vehicle) => fold(vehicle.model ?? ""))),
  ];
  if (uniqueModels.length === 1) return hits[0]?.id;
  return undefined;
}

export function resolveChatRequestVehicleId(opts: {
  mensagem: string;
  pageVehicleId?: string;
  lastSingleCardId?: string;
  shownCards?: ChatShownVehicle[];
}): string | undefined {
  const named = namedShownChatVehicleId(opts.mensagem, opts.shownCards ?? []);
  if (opts.pageVehicleId) {
    if (named && named !== opts.pageVehicleId) return named;
    return opts.pageVehicleId;
  }
  if (named) return named;
  if (!opts.lastSingleCardId) return undefined;
  if (!isAnaphoricVehicleFollowUp(opts.mensagem)) return undefined;
  return opts.lastSingleCardId;
}
