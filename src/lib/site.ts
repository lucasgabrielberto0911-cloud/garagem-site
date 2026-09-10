/**
 * Dados de contato e institucionais do site público.
 *
 * Região, e-mail, endereço e horários podem ser sobrescritos em /admin/site.
 * Telefones ficam em formato internacional (55 + DDD + número) para o WhatsApp.
 */
export const PHONES = [
  {
    label: "(27) 99633-0706",
    digits: "5527996330706",
    kind: "whatsapp",
    note: "WhatsApp",
  },
  {
    label: "(27) 99956-6161",
    digits: "5527999566161",
    kind: "alternate",
    note: "Telefone alternativo",
  },
] as const;

export const site = {
  name: "Sua Garagem",
  legalName: "Garagem Motorcycle Ltda",
  cnpj: "47.740.076/0001-17",
  url: "https://www.suagaragem.net",
  tagline:
    "Seminovos com procedência em Aracruz, Grande Vitória, Linhares, Guarapari, Cachoeiro, Colatina e região.",
  region: "Aracruz, Grande Vitória, Linhares e interior do ES",
  state: "Espírito Santo",
  stateCode: "ES",
  phoneLabel: PHONES[0].label,
  whatsappLabel: PHONES[0].label,
  whatsappNumber: PHONES[0].digits,
  email: "suagaragem2@gmail.com",
  instagram: "@suagaragem1",
  instagramUrl: "https://instagram.com/suagaragem1",
  address: "Loja digital — atendimento online",
  hours: "Todos os dias, 8h às 23h (online)",
  hoursWeekdays: "08:00 – 23:00",
  hoursSaturday: "08:00 – 23:00",
  hoursSunday: "08:00 – 23:00",
  /**
   * URL pública do Google Maps / Meu Negócio. Vazio de propósito:
   * preencha NEXT_PUBLIC_GOOGLE_MAPS_URL ou Admin → Site (googleProfileUrl).
   * Não inventar link.
   */
  googleMapsUrl: "",
} as const;

/** Config pública (defaults + overrides do painel). */
export type SiteConfig = {
  [K in keyof typeof site]: string;
};

/** Endereço físico real — loja digital não entra no mapa nem no schema.org. */
export function isPhysicalAddress(value: string) {
  if (!value || value.includes("[")) return false;
  const lower = value.toLowerCase();
  return !(
    lower.includes("digital") ||
    lower.includes("online") ||
    lower.includes("sem endereço") ||
    lower.includes("atendimento online")
  );
}

export function isConsumerMailbox(email: string) {
  return /@(gmail|hotmail|outlook|yahoo|icloud)\./i.test(email.trim());
}

/** E-mail de contato: Gmail não é apresentado como canal institucional. */
export function emailChannelCopy(email: string) {
  if (isConsumerMailbox(email)) {
    return {
      label: "E-mail",
      hint: "Canal complementar — o WhatsApp responde mais rápido.",
      hrefLabel: "Enviar e-mail",
    };
  }
  return {
    label: "E-mail",
    hint: "Resposta em horário comercial, pelo endereço da loja.",
    hrefLabel: "Enviar e-mail",
  };
}

export function configuredMapsUrl(
  mapsUrl?: string | null,
  googleProfileUrl?: string | null,
) {
  const candidates = [
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_URL,
    mapsUrl,
    googleProfileUrl,
    site.googleMapsUrl,
  ];
  for (const raw of candidates) {
    const url = (raw ?? "").trim();
    if (!url || url.includes("PREENCHER") || url.includes("[")) continue;
    if (/^https?:\/\//i.test(url)) return url;
  }
  return "";
}

export const WHATSAPP_MESSAGES = {
  general: `Olá! Vi o site da ${site.name} e gostaria de mais informações.`,
  help: `Olá! Vi o site da ${site.name} e quero ajuda para escolher um seminovo.`,
  sell: "Olá! Gostaria de avaliar meu veículo para venda/troca.",
  visit:
    "Olá! Gostaria de conhecer o estoque e receber mais informações pelo WhatsApp.",
  vehicle: (label: string, isMoto = false) =>
    `Olá! Tenho interesse ${isMoto ? "na" : "no"} ${label} que vi no site da ${site.name}.`,
  vehicleVisit: (label: string, isMoto = false) =>
    `Olá! Gostaria de agendar para ver ${isMoto ? "a" : "o"} ${label} de perto.`,
  vehicleVideo: (label: string, isMoto = false) =>
    `Olá! Podem me mandar um vídeo ${isMoto ? "da" : "do"} ${label} que está no site?`,
  vehicleFinance: (label: string, isMoto = false) =>
    `Olá! Gostaria de opções de financiamento para ${isMoto ? "a" : "o"} ${label}. Simulação sujeita a análise de crédito e CET.`,
  vehicleTrade: (label: string, isMoto = false) =>
    `Olá! Tenho interesse ${isMoto ? "na" : "no"} ${label} e gostaria de colocar meu veículo na troca.`,
  wanted: (detail?: string) => {
    const text = (detail ?? "").trim();
    return text
      ? `Olá! Quero ser avisado quando chegar: ${text}.`
      : "Olá! Não achei o que procuro no site. Podem me avisar quando chegar?";
  },
} as const;

/**
 * Monta o link do WhatsApp. Sem número configurado o link cai no wa.me
 * genérico, que ainda abre o app — evita href vazio quebrando a navegação.
 */
export function whatsappUrl(
  message: string = WHATSAPP_MESSAGES.general,
  phoneIndex = 0,
) {
  const digits = (PHONES[phoneIndex]?.digits ?? site.whatsappNumber).replace(
    /\D/g,
    "",
  );
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function telUrl(phoneIndex = 0) {
  const digits = (PHONES[phoneIndex]?.digits ?? site.whatsappNumber).replace(
    /\D/g,
    "",
  );
  return digits ? `tel:+${digits}` : "tel:";
}

export const NAV_LINKS = [
  { href: "/", label: "Início" },
  { href: "/estoque", label: "Estoque" },
  { href: "/vender", label: "Vender/Trocar" },
  { href: "/sobre", label: "Sobre" },
  { href: "/faq", label: "Dúvidas" },
  { href: "/contato", label: "Contato" },
] as const;

/** Menu do topo no desktop — Início fica no logo. */
export const DESKTOP_NAV_LINKS = NAV_LINKS.filter((link) => link.href !== "/");

export const SECONDARY_LINKS = [
  { href: "/favoritos", label: "Favoritos" },
  { href: "/privacidade", label: "Política de privacidade" },
] as const;

export const SERVICES = [
  { label: "Compra", href: "/estoque" },
  { label: "Venda", href: "/vender" },
  { label: "Troca", href: "/vender" },
  { label: "Financiamento", href: "/faq#financiamento" },
] as const;
