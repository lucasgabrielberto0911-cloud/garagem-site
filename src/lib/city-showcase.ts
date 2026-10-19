export type CityPageStockCopy = {
  heading: string;
  intro: string;
  empty: string;
  stockHref: string;
  stockLabel: string;
  whatsappMessage: string;
};

/**
 * Texto da landing. A lista é uma seleção do estoque — a cidade é o atendimento,
 * não um filtro por onde o carro está.
 */
export function cityPageStockCopy(cityName: string): CityPageStockCopy {
  const name = cityName.trim() || "sua cidade";
  return {
    heading: "Estoque disponível agora",
    intro: `Até seis anúncios do estoque do site, com foto, preço e ficha de cada veículo disponível. Quem está em ${name} vê opções do mesmo estoque. O WhatsApp pede vídeo ou visita — a escolha começa na ficha.`,
    empty:
      "Neste momento não tem veículo disponível no estoque. A página não inventa carro.",
    stockHref: "/estoque",
    stockLabel: "Ver o estoque",
    whatsappMessage: `Oi! Vi o site da Garagem e quero um vídeo ou combinar uma visita. Estou em ${name}.`,
  };
}
