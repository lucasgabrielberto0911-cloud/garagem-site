import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";

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

export function chatWhatsAppCta(
  text: string,
  vehicle?: { label: string; model?: string; category?: string } | null,
): ChatWhatsAppCta | null {
  if (!/whatsapp|wa\.me/i.test(text)) return null;
  const folded = fold(text);

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
          ? WHATSAPP_MESSAGES.vehicleFinance(vehicle.label)
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
          ? WHATSAPP_MESSAGES.vehicleTrade(vehicle.label)
          : WHATSAPP_MESSAGES.sell,
      ),
      label: "Avaliar meu usado",
      benefit: "Valor da troca com fotos, pelo WhatsApp",
    };
  }
  if (/nao esta na lista|nao tem anuncio/.test(folded)) {
    return {
      href: whatsappUrl(WHATSAPP_MESSAGES.wanted()),
      label: "Avisar quando chegar",
      benefit: "Consultor procura o modelo pra você",
    };
  }
  return {
    href: whatsappUrl(
      vehicle
        ? WHATSAPP_MESSAGES.vehicle(vehicle.label)
        : WHATSAPP_MESSAGES.help,
    ),
    label: "Chamar consultor",
    benefit: "Confirma o modelo · das 8h às 23h",
  };
}
