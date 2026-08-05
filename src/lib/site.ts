/**
 * Dados de contato e institucionais do site público.
 *
 * Os valores entre colchetes continuam sendo placeholders: troque-os pelos
 * dados reais da loja. Os dígitos dos telefones ficam em formato internacional
 * (55 + DDD + número) porque é o formato exigido pelos links do WhatsApp.
 */
export const PHONES = [
  { label: "(27) 99956-6161", digits: "5527999566161" },
  { label: "(27) 99633-0706", digits: "5527996330706" },
] as const;

export const site = {
  name: "Garagem",
  legalName: "Garagem Veículos",
  cnpj: "47.740.076/0001-17",
  url: "https://suagaragem.net",
  tagline: "Seminovos com procedência, no Espírito Santo.",
  region: "[CIDADE/REGIÃO]",
  state: "Espírito Santo",
  stateCode: "ES",
  phoneLabel: PHONES[0].label,
  whatsappLabel: PHONES[0].label,
  whatsappNumber: PHONES[0].digits,
  email: "[E-MAIL]",
  instagram: "@suagaragem1",
  instagramUrl: "https://instagram.com/suagaragem1",
  address: "[ENDEREÇO COMPLETO]",
  hours: "[HORÁRIO]",
  hoursWeekdays: "[HORÁRIO SEG-SEX]",
  hoursSaturday: "[HORÁRIO SÁBADO]",
} as const;

export const WHATSAPP_MESSAGES = {
  general: "Olá! Vi o site da Garagem e gostaria de mais informações.",
  sell: "Olá! Gostaria de avaliar meu carro para venda/troca.",
  visit: "Olá! Gostaria de agendar uma visita para conhecer o estoque.",
  vehicle: (label: string) =>
    `Olá! Tenho interesse no ${label} que vi no site da Garagem.`,
  vehicleVisit: (label: string) =>
    `Olá! Gostaria de agendar uma visita para ver o ${label} de perto.`,
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
  { href: "/contato", label: "Contato" },
] as const;

export const SECONDARY_LINKS = [
  { href: "/favoritos", label: "Favoritos" },
  { href: "/faq", label: "Dúvidas frequentes" },
  { href: "/privacidade", label: "Política de privacidade" },
] as const;

export const SERVICES = [
  "Compra",
  "Venda",
  "Troca",
  "Financiamento",
] as const;
