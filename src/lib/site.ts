/**
 * Dados de contato e institucionais do site público.
 *
 * Os valores entre colchetes são placeholders propositais: troque-os pelos
 * dados reais da loja. `whatsappNumber` precisa estar em formato internacional
 * apenas com dígitos (ex.: 5527999999999) para os links funcionarem.
 */
export const site = {
  name: "Garagem",
  tagline: "Seminovos com procedência, no Espírito Santo.",
  region: "[CIDADE/REGIÃO]",
  state: "Espírito Santo",
  phoneLabel: "[TELEFONE]",
  whatsappLabel: "[TELEFONE]",
  whatsappNumber: "",
  email: "[E-MAIL]",
  instagram: "[INSTAGRAM]",
  instagramUrl: "https://instagram.com/",
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
} as const;

/**
 * Monta o link do WhatsApp. Sem número configurado o link cai no wa.me
 * genérico, que ainda abre o app — evita href vazio quebrando a navegação.
 */
export function whatsappUrl(message: string = WHATSAPP_MESSAGES.general) {
  const digits = site.whatsappNumber.replace(/\D/g, "");
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function telUrl() {
  const digits = site.whatsappNumber.replace(/\D/g, "");
  return digits ? `tel:+${digits}` : "tel:";
}

export const NAV_LINKS = [
  { href: "/", label: "Início" },
  { href: "/estoque", label: "Estoque" },
  { href: "/vender", label: "Vender/Trocar" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
] as const;

export const SERVICES = [
  "Compra",
  "Venda",
  "Troca",
  "Financiamento",
] as const;
