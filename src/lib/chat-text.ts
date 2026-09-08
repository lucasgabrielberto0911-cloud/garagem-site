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
  value = value.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  value = value.replace(
    /(?:^|\n)\s*(?:whatsapp|chama no whatsapp|fala com a gente no whatsapp|chama a gente no whatsapp)\s*:?\s*$/i,
    "",
  );
  value = value.replace(/\s+([.,;:])/g, "$1").trim();
  return value;
}

export function chatWhatsAppCta(text: string): ChatWhatsAppCta | null {
  if (!/whatsapp|wa\.me/i.test(text)) return null;
  const folded = fold(text);
  if (/financi|parcela|60x|simul/.test(folded)) {
    return {
      href: whatsappUrl(
        "Olá! Vi o assistente da Garagem e quero simular financiamento em até 60x.",
      ),
      label: "Simular no WhatsApp",
      benefit: "Consultor monta a parcela no seu perfil",
    };
  }
  if (/\btroca\b/.test(folded)) {
    return {
      href: whatsappUrl(WHATSAPP_MESSAGES.sell),
      label: "Avaliar troca no WhatsApp",
      benefit: "Mandamos a avaliação com fotos do seu usado",
    };
  }
  return {
    href: whatsappUrl(WHATSAPP_MESSAGES.help),
    label: "Falar no WhatsApp",
    benefit: "Consultor confirma o carro e a condição",
  };
}
