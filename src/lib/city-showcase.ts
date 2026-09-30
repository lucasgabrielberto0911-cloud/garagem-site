export type CityPageStockCopy = {
  heading: string;
  intro: string;
  empty: string;
  stockHref: string;
  stockLabel: string;
  whatsappMessage: string;
};

/**
 * Texto da landing. A lista é o estoque inteiro — a cidade é o atendimento,
 * não um filtro por onde o carro está.
 */
export function cityPageStockCopy(cityName: string): CityPageStockCopy {
  const name = cityName.trim() || "sua cidade";
  return {
    heading: "Estoque disponível agora",
    intro: `A lista é a mesma do estoque do site: foto, preço e ficha de cada anúncio disponível. Quem está em ${name} vê os mesmos carros. O WhatsApp pede vídeo ou visita — a escolha começa na ficha.`,
    empty:
      "Neste momento não tem veículo disponível no estoque. A página não inventa carro.",
    stockHref: "/estoque",
    stockLabel: "Ver o estoque",
    whatsappMessage: `Oi! Vi o site da Garagem e quero um vídeo ou combinar uma visita. Estou em ${name}.`,
  };
}
