/**
 * Dados de contato e institucionais do site público.
 *
 * Região, e-mail, endereço e horários podem ser sobrescritos em /admin/site.
 * Telefones ficam em formato internacional (55 + DDD + número) para o WhatsApp.
 */
export const PHONES = [
  { label: "(27) 99633-0706", digits: "5527996330706" },
  { label: "(27) 99956-6161", digits: "5527999566161" },
] as const;

export const site = {
  name: "Garagem",
  legalName: "Garagem Motocycles",
  cnpj: "47.740.076/0001-17",
  url: "https://suagaragem.net",
  tagline: "Seminovos com procedência em Aracruz, Vitória, Linhares e região.",
  region: "Aracruz, Vitória, Linhares",
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

export const WHATSAPP_MESSAGES = {
  general: "Olá! Vi o site da Garagem e gostaria de mais informações.",
  sell: "Olá! Gostaria de avaliar meu carro para venda/troca.",
  visit:
    "Olá! Gostaria de conhecer o estoque e receber mais informações pelo WhatsApp.",
  vehicle: (label: string) =>
    `Olá! Tenho interesse no ${label} que vi no site da Garagem.`,
  vehicleVisit: (label: string) =>
    `Olá! Gostaria de agendar para ver o ${label} de perto.`,
  vehicleVideo: (label: string) =>
    `Olá! Podem me mandar um vídeo do ${label} que está no site?`,
  vehicleTrade: (label: string) =>
    `Olá! Tenho interesse no ${label} e gostaria de dar meu carro na troca.`,
  wanted: "Olá! Não achei o que procuro no site. Estou buscando: ",
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

export const SECONDARY_LINKS = [
  { href: "/favoritos", label: "Favoritos" },
  { href: "/privacidade", label: "Política de privacidade" },
] as const;

export const SERVICES = [
  { label: "Compra", href: "/estoque" },
  { label: "Venda", href: "/vender" },
  { label: "Troca", href: "/vender" },
  { label: "Financiamento", href: "/contato" },
] as const;
