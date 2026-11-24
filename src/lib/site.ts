import { applyWhatsAppOrigin, type LeadOrigin } from "./lead-origin";
/**
 * Dados de contato e institucionais do site público.
 *
 * Região, e-mail, endereço e horários podem ser sobrescritos em /admin/site.
 * Telefones ficam em formato internacional (55 + DDD + número) para o WhatsApp.
 */
/** Um único WhatsApp público. O site não publica telefone alternativo. */
export const PHONES = [
  {
    label: "(27) 99633-0706",
    digits: "5527996330706",
    kind: "whatsapp",
    note: "WhatsApp",
  },
] as const;

export const site = {
  name: "Garagem",
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
  address: "Combinamos o atendimento pelo WhatsApp",
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

/** Endereço físico real — atendimento combinado pelo WhatsApp não entra no mapa nem no schema.org. */
export function isPhysicalAddress(value: string) {
  if (!value || value.includes("[")) return false;
  const lower = value.toLowerCase();
  return !(
    lower.includes("digital") ||
    lower.includes("online") ||
    lower.includes("whatsapp") ||
    lower.includes("combinamos") ||
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

/** Wordmark falado no WhatsApp do cliente → loja (não o nome comercial). */
export const WHATSAPP_BRAND = "Garagem";

export type CustomerWhatsAppVehicleIntent =
  | "interest"
  | "video"
  | "finance"
  | "visit"
  | "trade"
  | "similar"
  | "question"
  | "photos";

/** Campanhas internas dos CTAs públicos; não representam a origem do visitante. */
export type WhatsAppCampaignBase =
  | "ficha"
  | "estoque"
  | "filtro"
  | "home"
  | "favoritos"
  | "vendidos"
  | "vender"
  | "troca"
  | "financiamento"
  | "como-funciona"
  | "sobre"
  | "contato"
  | "faq"
  | "privacidade"
  | "pedido"
  | "guia"
  | "modelos"
  | "marca"
  | "modelo"
  | "cidade"
  | "chat"
  | "pwa"
  | "links"
  | "404"
  | "erro";

export type WhatsAppCampaign =
  | WhatsAppCampaignBase
  | `${WhatsAppCampaignBase}-${string}`;

/** Atalho do app instalado. Tem que ser same-origin (o manifesto não aceita wa.me). */
export const PWA_WHATSAPP_SHORTCUT_PATH = "/atalho/whatsapp";

export type WhatsAppVehicleRef = {
  id?: string | null;
  path?: string | null;
  slug?: string | null;
  brand?: string | null;
  model?: string | null;
};

export type WhatsAppTracking = {
  campaign?: WhatsAppCampaign;
  content?: string;
  /** Veículo ou slug para compor `utm_campaign=[pagina]-[carro]`. */
  car?: string | WhatsAppVehicleRef | null;
  phoneIndex?: number;
  /** Sem UTM — compartilhar o anúncio com um amigo, não CTA da loja. */
  bare?: boolean;
  /** Categoria consentida, sem UTMs livres. */
  origin?: LeadOrigin | null;
};

export const WHATSAPP_UTM_SOURCE = "site";
export const WHATSAPP_UTM_MEDIUM = "whatsapp";

/** Texto natural do cliente no WhatsApp. Sem “por R$” se faltar preço. */
export function formatCustomerVehicleWhatsAppText(input: {
  intent?: CustomerWhatsAppVehicleIntent;
  label?: string | null;
  priceLabel?: string | null;
  isMoto?: boolean;
  sold?: boolean;
  reserved?: boolean;
  /** Assunto da dúvida (“motor, câmbio e porta-malas”), só no intent question. */
  topic?: string | null;
}) {
  const label = (input.label ?? "").replace(/\s+/g, " ").trim();
  const priceLabel = (input.priceLabel ?? "").replace(/\s+/g, " ").trim();
  const article = input.isMoto ? "a" : "o";
  if (input.sold) {
    return label
      ? `Oi! Vi que ${article} ${label} já foi ${input.isMoto ? "vendida" : "vendido"} no site da ${WHATSAPP_BRAND} e quero ver opções parecidas no estoque.`
      : `Oi! Vi um anúncio já vendido no site da ${WHATSAPP_BRAND} e quero ver opções parecidas no estoque.`;
  }
  if (input.reserved) {
    const reservedWord = input.isMoto ? "reservada" : "reservado";
    if (!label) {
      return `Oi! Vi um anúncio reservado no site da ${WHATSAPP_BRAND} e quero saber mais caso fique disponível ou ver opções parecidas.`;
    }
    const withPrice = priceLabel ? ` por ${priceLabel}` : "";
    return `Oi! Vi ${article} ${label}${withPrice} (${reservedWord}) no site da ${WHATSAPP_BRAND} e quero saber mais caso fique disponível ou ver opções parecidas.`;
  }
  const seen = label
    ? priceLabel
      ? `Vi ${article} ${label} por ${priceLabel} no site da ${WHATSAPP_BRAND}`
      : `Vi ${article} ${label} no site da ${WHATSAPP_BRAND}`
    : `Vi o site da ${WHATSAPP_BRAND}`;

  switch (input.intent) {
    case "finance":
      return `Oi! ${seen} e quero saber sobre o financiamento.`;
    case "trade":
      return `Oi! ${seen} e quero avaliar uma troca.`;
    case "video":
      return `Oi! ${seen} e queria um vídeo${label ? ` ${input.isMoto ? "dela" : "dele"}` : ""}.`;
    case "visit":
      return label
        ? `Oi! ${seen} e quero ver ${input.isMoto ? "ela" : "ele"} de perto.`
        : `Oi! ${seen} e quero conhecer o estoque.`;
    case "question": {
      const topic = (input.topic ?? "").replace(/\s+/g, " ").trim();
      const about = topic
        ? `sobre ${topic}`
        : label
          ? `sobre ${input.isMoto ? "ela" : "ele"}`
          : "";
      return `Oi! ${seen} e quero tirar umas dúvidas${about ? ` ${about}` : ""}.`;
    }
    case "photos":
      return `Oi! ${seen} e queria mais fotos${label ? ` ${input.isMoto ? "dela" : "dele"}` : ""}.`;
    case "similar":
      return label
        ? `Oi! ${seen} e queria ver outros na mesma faixa.`
        : `Oi! ${seen} e queria ver seminovos na mesma faixa.`;
    default:
      return label
        ? `Oi! ${seen} e quero saber mais.`
        : `Oi! ${seen} e gostaria de mais informações.`;
  }
}

export const WHATSAPP_MESSAGES = {
  general: `Oi! Vi o site da ${WHATSAPP_BRAND} e gostaria de mais informações.`,
  help: `Oi! Vi o site da ${WHATSAPP_BRAND} e quero ajuda pra escolher um seminovo.`,
  sell: `Oi! Vi o site da ${WHATSAPP_BRAND} e quero avaliar meu veículo pra venda ou troca.`,
  visit: `Oi! Vi o site da ${WHATSAPP_BRAND} e quero conhecer o estoque.`,
  vehicle: (label: string, isMoto = false) =>
    formatCustomerVehicleWhatsAppText({ intent: "interest", label, isMoto }),
  vehicleVisit: (label: string, isMoto = false) =>
    formatCustomerVehicleWhatsAppText({ intent: "visit", label, isMoto }),
  vehicleVideo: (label: string, isMoto = false) =>
    formatCustomerVehicleWhatsAppText({ intent: "video", label, isMoto }),
  vehicleFinance: (label: string, isMoto = false) =>
    formatCustomerVehicleWhatsAppText({ intent: "finance", label, isMoto }),
  vehicleTrade: (label: string, isMoto = false) =>
    formatCustomerVehicleWhatsAppText({ intent: "trade", label, isMoto }),
  sameBand: (label: string, isMoto = false) =>
    formatCustomerVehicleWhatsAppText({ intent: "similar", label, isMoto }),
  finance: formatCustomerVehicleWhatsAppText({ intent: "finance" }),
  similarFavorites: `Oi! Ainda não salvei favoritos no site da ${WHATSAPP_BRAND}. Podem me indicar seminovos parecidos?`,
  wanted: (detail?: string) => {
    const text = (detail ?? "").trim();
    return text
      ? `Oi! Quero ser avisado quando chegar: ${text}.`
      : `Oi! Não achei o que procuro no site da ${WHATSAPP_BRAND}. Podem me avisar quando chegar?`;
  },
} as const;

/** Ficha de um anúncio (`/estoque/[slug]`), não a listagem. */
export function isVehicleFichaPath(pathname: string): boolean {
  const path = (pathname || "/").split("?")[0]?.replace(/\/+$/, "") || "/";
  return path.startsWith("/estoque/") && path !== "/estoque";
}

/**
 * O logo do header só pede alta prioridade fora da home e da ficha.
 * Na home o wordmark do hero já é a imagem prioritária; na ficha a
 * primeira foto da galeria é o LCP e não deve disputar banda.
 */
export function headerWordmarkPriority(pathname: string): boolean {
  if (isVehicleFichaPath(pathname)) return false;
  const path = (pathname || "/").split("?")[0]?.replace(/\/+$/, "") || "/";
  return path !== "/";
}

const TWO_WORD_BRANDS = new Set([
  "caoa chery",
  "land rover",
  "mercedes benz",
  "royal enfield",
  "harley davidson",
  "alfa romeo",
  "aston martin",
  "rolls royce",
]);

const ONE_WORD_BRANDS = new Set([
  "chevrolet",
  "ford",
  "fiat",
  "volkswagen",
  "vw",
  "hyundai",
  "toyota",
  "honda",
  "jeep",
  "mitsubishi",
  "renault",
  "nissan",
  "peugeot",
  "citroen",
  "kia",
  "bmw",
  "mercedes",
  "audi",
  "volvo",
  "chery",
  "caoa",
  "byd",
  "gwm",
  "suzuki",
  "subaru",
  "landrover",
  "ram",
  "dodge",
  "chrysler",
  "mini",
  "porsche",
  "jaguar",
  "lexus",
  "iveco",
  "jac",
  "troller",
  "ssangyong",
  "smart",
  "yamaha",
  "kawasaki",
  "harley",
  "triumph",
  "ducati",
  "dafra",
  "shineray",
  "haojue",
  "bajaj",
]);

const COMPOUND_CAR_MODELS = new Set([
  "hr-v",
  "cr-v",
  "wr-v",
  "zr-v",
  "t-cross",
  "x-trail",
  "s-cross",
  "c-hr",
  "e-js1",
  "gt-r",
  "v-strom",
  "s-10",
  "corolla-cross",
  "onix-plus",
  "grand-siena",
  "grand-vitara",
  "grand-livina",
  "grand-cherokee",
  "santa-fe",
  "range-rover",
  "discovery-sport",
  "new-fiesta",
  "new-civic",
  "hilux-sw4",
  "pajero-sport",
  "pajero-tr4",
  "pajero-full",
  "pajero-dakar",
  "l200-triton",
  "eclipse-cross",
  "sandero-stepway",
  "polo-sedan",
  "palio-weekend",
  "ka-sedan",
  "c4-cactus",
  "c4-lounge",
  "c4-picasso",
  "c3-aircross",
  "tiggo-2",
  "tiggo-3x",
  "tiggo-5x",
  "tiggo-7",
  "tiggo-8",
  "arrizo-6",
  "dolphin-mini",
  "song-plus",
  "song-pro",
  "yuan-plus",
  "yuan-pro",
  "haval-h6",
  "ora-03",
  "africa-twin",
  "cb-twister",
  "yaris-sedan",
  "yaris-hatch",
  "city-hatch",
  "city-sedan",
  "civic-si",
  "golf-gti",
  "polo-gts",
  "up-tsi",
  "c-180",
  "c-200",
  "c-250",
  "c-300",
  "a-200",
  "a-250",
  "b-200",
  "cla-200",
  "gla-200",
  "glb-200",
  "glc-250",
  "glc-300",
  "xc-40",
  "xc-60",
  "xc-90",
]);

const MOTO_PREFIX_TOKENS = new Set([
  "cg",
  "biz",
  "cb",
  "cbr",
  "cbx",
  "crf",
  "xre",
  "nxr",
  "pcx",
  "adv",
  "nc",
  "mt",
  "gsx",
  "xtz",
  "sh",
  "pop",
  "bros",
  "titan",
  "fan",
  "start",
  "fazer",
  "factor",
  "lander",
  "crosser",
  "twister",
  "tenere",
  "nmax",
  "xmax",
]);

const NUMERIC_CAR_MODELS = new Set([
  "206",
  "207",
  "208",
  "307",
  "308",
  "408",
  "500",
  "911",
  "1500",
  "2008",
  "2500",
  "3008",
  "3500",
  "5008",
]);

const NON_VEHICLE_CONTENT = new Set([
  "atalho",
  "chat-visita",
  "vendido-link-antigo",
  "estoque-vazio",
  "filtro-vazio",
]);

const NON_CAR_TOKENS = new Set([
  "veiculo",
  "carro",
  "carros",
  "moto",
  "motos",
  "seminovo",
  "seminovos",
  "estoque",
  "ficha",
  "home",
  "site",
  "whatsapp",
  "atalho",
  "visita",
  "vazio",
  "vendido",
  "vendidos",
  "entrega",
  "cuid",
  "id",
  "abc",
  "xyz",
  "garagem",
  "placa",
  "cpf",
  "chassi",
  "renavam",
]);

function isSafeCarModelToken(token: string): boolean {
  if (!token || token.length < 2 || token.length > 20) return false;
  if (NON_CAR_TOKENS.has(token)) return false;
  if (/^\d+$/.test(token)) return NUMERIC_CAR_MODELS.has(token);
  // Nunca refletir placa (ABC1234 / ABC1D23), CUID, chassi (17 chars) ou sequências longas.
  if (/^[a-z]{3}\d[a-z0-9]\d{2}$/i.test(token)) return false;
  if (/^c[a-z0-9]{15,}$/i.test(token) || /^[a-z0-9]{15,}$/i.test(token)) return false;
  if (/^(?:cuid|id)\d*$/i.test(token)) return false;
  if (/\d{5,}/.test(token)) return false;
  return /^[a-z0-9]+$/.test(token);
}

function extractCarSlugFromRaw(raw: string): string {
  const first = (raw || "").split(",")[0]?.trim() ?? "";
  if (!first) return "";
  const cleanPath =
    first
      .split(/[?#]/)[0]
      ?.replace(/^https?:\/\/[^/]+/i, "")
      .replace(/^\/+|\/+$/g, "") ?? "";
  const withoutPrefix = cleanPath.toLowerCase().startsWith("estoque/")
    ? cleanPath.slice("estoque/".length).replace(/^\/+|\/+$/g, "")
    : cleanPath;
  if (!withoutPrefix) return "";
  const lower = withoutPrefix.toLowerCase();
  if (NON_VEHICLE_CONTENT.has(lower) || lower.startsWith("entrega-")) return "";
  if (/^c[a-z0-9]{15,}$/i.test(withoutPrefix)) return "";
  if (/^(?:cuid|id)[a-z0-9_-]*$/i.test(withoutPrefix)) return "";

  const base = withoutPrefix.replace(/-c[a-z0-9]{20,32}$/i, "");
  const tokens = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (tokens.length === 0) return "";

  let rest = tokens;
  if (
    tokens.length > 2 &&
    TWO_WORD_BRANDS.has(`${tokens[0]} ${tokens[1]}`)
  ) {
    rest = tokens.slice(2);
  } else if (tokens.length > 1 && ONE_WORD_BRANDS.has(tokens[0])) {
    rest = tokens.slice(1);
  }
  if (rest.length === 0) return "";

  const [t0, t1] = rest;
  if (!t0 || !isSafeCarModelToken(t0)) return "";

  if (t1) {
    const pair = `${t0}-${t1}`;
    if (COMPOUND_CAR_MODELS.has(pair)) return pair;
    const isYear = /^\d{4}$/.test(t1) && Number(t1) >= 1980 && Number(t1) <= 2035;
    if (
      MOTO_PREFIX_TOKENS.has(t0) &&
      /^\d{2,4}[a-z]?$/.test(t1) &&
      !isYear
    ) {
      return pair;
    }
  }

  return t0.slice(0, 24);
}

/**
 * Slug curto e estável do veículo para `utm_campaign=[pagina]-[carro]` (ex.: `versa`, `hr-v`).
 * Nunca inclui placa, CPF, telefone, chassi, RENAVAM, CUID ou dados de cliente.
 */
export function whatsappCarSlug(
  input?: string | WhatsAppVehicleRef | null,
): string {
  if (!input) return "";
  if (typeof input === "string") return extractCarSlugFromRaw(input);
  if (input.model) {
    const fromModel = extractCarSlugFromRaw(
      [input.brand, input.model].filter(Boolean).join(" "),
    );
    if (fromModel) return fromModel;
  }
  if (input.slug) {
    const fromSlug = extractCarSlugFromRaw(input.slug);
    if (fromSlug) return fromSlug;
  }
  if (input.path) {
    const fromPath = extractCarSlugFromRaw(input.path);
    if (fromPath) return fromPath;
  }
  return "";
}

export function whatsappCampaignFromPath(pathname: string): WhatsAppCampaignBase {
  if (isVehicleFichaPath(pathname)) return "ficha";
  const path = (pathname || "/").split("?")[0]?.replace(/\/+$/, "") || "/";
  if (path === "/estoque" || path.startsWith("/estoque")) return "estoque";
  if (path === "/favoritos") return "favoritos";
  if (path === "/vendidos") return "vendidos";
  if (path === "/vender") return "vender";
  if (path === "/troca") return "troca";
  if (path === "/financiamento") return "financiamento";
  if (path === "/como-funciona") return "como-funciona";
  if (path === "/sobre") return "sobre";
  if (path === "/contato") return "contato";
  if (path === "/faq") return "faq";
  if (path === "/privacidade") return "privacidade";
  if (path === "/pedido") return "pedido";
  if (
    path === "/guias" ||
    path.startsWith("/guias/") ||
    path.startsWith("/guia/")
  ) {
    return "guia";
  }
  if (path === "/modelos") return "modelos";
  if (path.startsWith("/marca/")) return "marca";
  if (path.startsWith("/modelo/")) return "modelo";
  if (path === "/links") return "links";
  if (
    path === "/cidades" ||
    path === "/seminovos" ||
    path.startsWith("/seminovos/")
  ) {
    return "cidade";
  }
  return "home";
}

export function whatsappCampaignFromLabel(label: string): WhatsAppCampaignBase {
  const key = (label || "").toLowerCase();
  if (key.includes("pwa") || key.includes("atalho")) return "pwa";
  if (key.includes("chat")) return "chat";
  if (key.includes("ficha") || key.includes("vendido-link")) return "ficha";
  if (key.includes("home")) return "home";
  if (key.includes("favorit")) return "favoritos";
  if (key.includes("vendidos")) return "vendidos";
  if (key.includes("vender")) return "vender";
  if (key.includes("troca") && !key.includes("financiamento")) return "troca";
  if (key.includes("financiamento")) return "financiamento";
  if (key.includes("como-funciona")) return "como-funciona";
  if (key.includes("sobre")) return "sobre";
  if (key.includes("contato")) return "contato";
  if (key.includes("faq")) return "faq";
  if (key.includes("privacidade")) return "privacidade";
  if (key.includes("pedido")) return "pedido";
  if (key.includes("guia")) return "guia";
  if (key.includes("modelos")) return "modelos";
  if (key.includes("marca")) return "marca";
  if (key.includes("modelo")) return "modelo";
  if (key.includes("links")) return "links";
  if (key.includes("404")) return "404";
  if (key.includes("erro")) return "erro";
  if (key.includes("cidade") || key.includes("seminovos")) return "cidade";
  if (key.includes("filtro")) return "filtro";
  if (
    key.includes("estoque") ||
    key.includes("vehicle-card") ||
    key.includes("avise")
  ) {
    return "estoque";
  }
  return "home";
}

export type FavoritesWhatsAppVehicle = {
  id: string;
  path?: string | null;
  label: string;
};

const FAVORITES_WHATSAPP_CAP = 4;

/**
 * Lista salva → WhatsApp. O recado leva modelo e ano.
 * `vehicle_id` do pixel é o salvo por último (entra no topo da lista).
 * `utm_content` junta os slugs, no máximo 80 caracteres.
 */
export function favoritesListWhatsApp(vehicles: FavoritesWhatsAppVehicle[]) {
  const rows = vehicles.filter((vehicle) => vehicle.id || vehicle.label);
  const labels = rows
    .map((vehicle) => vehicle.label.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const shown = labels.slice(0, FAVORITES_WHATSAPP_CAP);
  const extra = labels.length - shown.length;
  const links = rows
    .filter((vehicle) => vehicle.path?.startsWith("/estoque/"))
    .slice(0, FAVORITES_WHATSAPP_CAP)
    .map((vehicle) => `${site.url.replace(/\/$/, "")}${vehicle.path}`);
  const message = labels.length
    ? [
        `Oi! Separei no site da ${WHATSAPP_BRAND}: ${shown.join(", ")}${
          extra > 0 ? ` e mais ${extra}` : ""
        }. Pode me passar as condições?`,
        ...links,
      ].join("\n")
    : WHATSAPP_MESSAGES.similarFavorites;
  const slugs = rows
    .map((vehicle) =>
      whatsappContentFromVehicle({ id: vehicle.id, path: vehicle.path }),
    )
    .filter(Boolean);
  const primary = rows[0];
  const slug = primary
    ? whatsappContentFromVehicle({ id: primary.id, path: primary.path })
    : "";
  return {
    message,
    campaign: "favoritos" as const,
    content: slugs.join(",").slice(0, 80) || undefined,
    vehicleId: primary?.id || undefined,
    slug: slug || undefined,
  };
}

export function whatsappContentFromVehicle(input: {
  id?: string | null;
  path?: string | null;
}) {
  const path = (input.path ?? "").trim();
  const slug = path.startsWith("/estoque/")
    ? path.slice("/estoque/".length).split(/[?#]/)[0].replace(/\/+$/, "")
    : "";
  return (slug || input.id || "").slice(0, 80);
}

/** UTM dos CTAs da ficha: campanha `ficha` + id/slug em `utm_content`. */
export function fichaWhatsAppTracking(
  vehicle: WhatsAppVehicleRef,
): WhatsAppTracking {
  return {
    campaign: "ficha",
    content: whatsappContentFromVehicle(vehicle),
    ...(vehicle.brand || vehicle.model || vehicle.slug
      ? { car: vehicle }
      : {}),
  };
}

/**
 * Header/float/nav: na ficha usa `ficha` + veículo; no resto, campanha da rota.
 * CTA genérico de rodapé continua `whatsappUrl()` → `home`.
 */
export function pageWhatsAppTracking(input: {
  pathname?: string | null;
  vehicle?: WhatsAppVehicleRef | null;
}): WhatsAppTracking {
  const pathname = input.pathname || "/";
  if (!isVehicleFichaPath(pathname)) {
    return { campaign: whatsappCampaignFromPath(pathname) };
  }
  const vehicle = input.vehicle;
  if (vehicle && (vehicle.id || vehicle.path)) {
    return fichaWhatsAppTracking({
      id: vehicle.id,
      path: vehicle.path || pathname,
      slug: vehicle.slug,
      brand: vehicle.brand,
      model: vehicle.model,
    });
  }
  return fichaWhatsAppTracking({ path: pathname });
}

function resolveWhatsAppTracking(
  phoneIndexOrTracking?: number | WhatsAppTracking,
  tracking?: WhatsAppTracking,
): WhatsAppTracking & { phoneIndex: number } {
  if (typeof phoneIndexOrTracking === "number") {
    return { phoneIndex: phoneIndexOrTracking, ...tracking };
  }
  if (phoneIndexOrTracking) {
    return {
      phoneIndex: phoneIndexOrTracking.phoneIndex ?? 0,
      ...phoneIndexOrTracking,
    };
  }
  return { phoneIndex: 0, ...tracking };
}

/** Resolve `utm_campaign`: `[pagina]-[carro]` quando houver carro, ou só `[pagina]`. */
export function whatsappCampaignValue(tracking: WhatsAppTracking = {}): string {
  const base = tracking.campaign ?? "home";
  const carSlug = whatsappCarSlug(tracking.car ?? tracking.content);
  if (!carSlug || base.endsWith(`-${carSlug}`)) return base;
  return `${base}-${carSlug}`;
}

/** Anexa UTM sem reescrever o `text` já encoded (decodeURIComponent precisa de %20). */
export function applyWhatsAppUtm(
  href: string,
  tracking: WhatsAppTracking = {},
) {
  if (tracking.origin !== undefined) href = applyWhatsAppOrigin(href, tracking.origin);
  const campaign = whatsappCampaignValue(tracking);
  const extra = [
    `utm_source=${encodeURIComponent(WHATSAPP_UTM_SOURCE)}`,
    `utm_medium=${encodeURIComponent(WHATSAPP_UTM_MEDIUM)}`,
    `utm_campaign=${encodeURIComponent(campaign)}`,
  ];
  const content = (tracking.content ?? "").trim();
  if (content) {
    extra.push(`utm_content=${encodeURIComponent(content.slice(0, 80))}`);
  }
  if (/[?&]utm_source=/.test(href)) return href;
  return href.includes("?") ? `${href}&${extra.join("&")}` : `${href}?${extra.join("&")}`;
}

/**
 * Monta o link do WhatsApp oficial (99633-0706).
 * Sem número configurado o link cai no wa.me genérico, que ainda abre o app.
 * Origem consentida entra no texto; UTMs externas identificam apenas o CTA.
 * `phoneIndex` antigo não troca o destino: o site tem um número só.
 */
export function whatsappUrl(
  message: string = WHATSAPP_MESSAGES.general,
  phoneIndexOrTracking: number | WhatsAppTracking = 0,
  tracking?: WhatsAppTracking,
) {
  const opts = resolveWhatsAppTracking(phoneIndexOrTracking, tracking);
  const digits = site.whatsappNumber.replace(/\D/g, "");
  void opts.phoneIndex;
  const text = encodeURIComponent(message);
  const base = digits
    ? `https://wa.me/${digits}?text=${text}`
    : `https://wa.me/?text=${text}`;
  if (opts.bare) return base;
  return applyWhatsAppUtm(base, opts);
}

/** WhatsApp aberto pelo atalho do PWA — mesmo UTM dos CTAs, campanha `pwa`. */
export function pwaShortcutWhatsAppUrl() {
  return whatsappUrl(WHATSAPP_MESSAGES.general, {
    campaign: "pwa",
    content: "atalho",
  });
}

/** Liga no mesmo WhatsApp oficial. O índice não escolhe outro número. */
export function telUrl(phoneIndex = 0) {
  void phoneIndex;
  const digits = site.whatsappNumber.replace(/\D/g, "");
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
  { href: "/modelos", label: "Marcas e modelos" },
  { href: "/guias", label: "Guias de compra" },
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/financiamento", label: "Financiamento" },
  { href: "/vendidos", label: "Vendidos e entregas" },
  { href: "/favoritos", label: "Favoritos" },
  { href: "/links", label: "Links" },
  { href: "/privacidade", label: "Política de privacidade" },
] as const;

export const SERVICES = [
  { label: "Compra", href: "/estoque" },
  { label: "Venda", href: "/vender" },
  { label: "Troca", href: "/vender" },
  { label: "Financiamento", href: "/financiamento" },
] as const;
