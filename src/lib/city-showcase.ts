import { parseVehicleLocationCity, type VehicleLocationCity } from "@/lib/vehicle-location";

/**
 * De onde saem os carros da landing.
 * Serra mostra só Serra. Linhares e as cidades de atendimento
 * (Colatina, Vitória, Aracruz…) mostram o estoque de Linhares —
 * Aracruz não é cidade padrão do anúncio.
 */
export function cityShowcaseStockCity(slug: string): VehicleLocationCity {
  return parseVehicleLocationCity(slug) === "serra" ? "serra" : "linhares";
}

export type CityPageStockCopy = {
  stockCity: VehicleLocationCity;
  heading: string;
  intro: string;
  empty: string;
  stockHref: string;
  stockLabel: string;
  whatsappMessage: string;
  /** Leitor fora da Serra: a lista de lá fica na página da Serra. */
  linkSerra: boolean;
  /** Página da Serra: o restante do estoque está em Linhares. */
  linkLinhares: boolean;
};

/** Texto da vitrine. Não inventa modelo, foto nem equipamento. */
export function cityPageStockCopy(slug: string, cityName: string): CityPageStockCopy {
  const stockCity = cityShowcaseStockCity(slug);
  const name = cityName.trim() || "sua cidade";
  if (stockCity === "serra") {
    return {
      stockCity,
      heading: "Carros que estão na Serra",
      intro:
        "Aqui só entram os veículos cuja cidade é Serra. Cada card é um anúncio do estoque: foto, preço e ficha. O WhatsApp serve para pedir um vídeo ou combinar uma visita — a escolha começa na ficha.",
      empty:
        "Neste momento não tem veículo marcado na Serra. A lista não completa com carro de outra cidade. O estoque de Linhares continua no site.",
      stockHref: "/estoque?city=serra",
      stockLabel: "Ver os que estão em Serra",
      whatsappMessage: `Oi! Vi os seminovos na Serra no site da Garagem e quero um vídeo ou combinar uma visita.`,
      linkSerra: false,
      linkLinhares: true,
    };
  }

  const inLinhares = slug === "linhares";
  return {
    stockCity,
    heading: inLinhares
      ? "Carros que estão em Linhares"
      : `Seminovos para quem está em ${name}`,
    intro: inLinhares
      ? "Estes anúncios estão em Linhares. Abra a ficha para ver a foto, o preço e o que o anúncio confirma. O WhatsApp é para vídeo ou visita."
      : `A maior parte do estoque está em Linhares. Abaixo estão anúncios reais — foto, preço e ficha. Os carros da Serra não entram nesta lista. De ${name}, o WhatsApp é para pedir vídeo ou combinar visita, depois da ficha.`,
    empty:
      "Neste momento não tem veículo disponível em Linhares. O estoque completo continua no site. Se quiser um vídeo ou uma visita, chama no WhatsApp.",
    stockHref: "/estoque?city=linhares",
    stockLabel: "Ver os que estão em Linhares",
    whatsappMessage: inLinhares
      ? "Oi! Vi os seminovos em Linhares no site da Garagem e quero um vídeo ou combinar uma visita."
      : `Oi! Vi o site da Garagem e quero um vídeo ou combinar uma visita. Estou em ${name}.`,
    linkSerra: true,
    linkLinhares: false,
  };
}

/** Offset estável para cada cidade não repetir o mesmo recorte de 8 carros. */
export function cityShowcaseOffset(slug: string, length: number) {
  if (length <= 0) return 0;
  let hash = 0;
  for (const char of slug) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % length;
}

export function rotateItems<T>(items: T[], offset: number) {
  if (items.length === 0) return items;
  const start = ((offset % items.length) + items.length) % items.length;
  if (start === 0) return items.slice();
  return [...items.slice(start), ...items.slice(0, start)];
}

export function pickCityShowcase<T>(items: T[], slug: string, take: number) {
  if (items.length === 0 || take <= 0) return [];
  const rotated = rotateItems(items, cityShowcaseOffset(slug, items.length));
  return rotated.slice(0, Math.min(take, rotated.length));
}
