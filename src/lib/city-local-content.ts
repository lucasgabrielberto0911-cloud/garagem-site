import { site } from "@/lib/site";

/**
 * Conteúdo próprio das cidades que já aparecem na busca (Linhares, Serra,
 * Vila Velha e Colatina). Cada uma tem title, description, texto e perguntas
 * diferentes — sem trocar só o nome da cidade. Sem preço, parcela ou prazo:
 * o valor vale o que estiver na ficha do dia.
 */
export type CityLocalContent = {
  title: string;
  description: string;
  heading: string;
  paragraphs: readonly string[];
  faqs: readonly { question: string; answer: string }[];
};

const CITY_LOCAL_CONTENT: Record<string, CityLocalContent> = {
  linhares: {
    title: `Seminovos em Linhares/ES: carros e motos com troca | ${site.name}`,
    description:
      "Carros e motos seminovos em Linhares/ES com ficha, fotos e preço no site. Vídeo, troca do seu usado e visita com hora marcada, todos os dias no WhatsApp.",
    heading: "Seminovos em Linhares e no norte do ES",
    paragraphs: [
      "Linhares é a cidade-base da Garagem. Quem mora no Centro, em Interlagos, em Pontal do Ipiranga ou em Regência, ou vem de Sooretama e Rio Bananal, é quem tem a visita, a entrega e a retirada mais simples de combinar.",
      "Quem trabalha no comércio, no campo ou na indústria da região tem horário apertado. O estoque fica aberto no site o dia todo; o WhatsApp atende das 8h às 23h para o que faltar.",
      "Se você já tem um carro ou uma moto em Linhares, vale começar pela avaliação: a troca com volta e o financiamento entram na mesma conversa. Os guias abaixo explicam cada passo.",
    ],
    faqs: [
      {
        question: "Dá para ver o carro pessoalmente em Linhares?",
        answer:
          "Dá. Depois do vídeo e da proposta, combinamos um horário para você conferir o veículo em Linhares, sem fila e sem pressa.",
      },
      {
        question: "Vocês compram carro e moto de quem mora em Linhares?",
        answer:
          "Sim. Também avaliamos só a venda, mesmo sem você comprar outro. Envie marca, modelo, ano, km e fotos pela página Vender/Trocar.",
      },
    ],
  },
  serra: {
    title: `Seminovos para quem mora na Serra (ES) | ${site.name}`,
    description:
      "Procurando seminovo na Serra? Veja carros e motos com ficha e fotos no site da Garagem, peça vídeo no WhatsApp e combine entrega ou retirada, sem ponto físico.",
    heading: "Comprar seminovo morando na Serra",
    paragraphs: [
      "A Serra tem rotina de deslocamento longo: Jacaraípe, Manguinhos, Laranjeiras, Parque Residencial Laranjeiras e as ruas do Civit ficam longe do norte do estado, e é justamente por isso que a compra funciona melhor à distância. Você vê ficha, fotos, quilometragem e valor no site, e só depois combina qualquer encontro.",
      "A Garagem fica em Linhares, a cerca de duas horas da Serra pela BR-101. Não existe ponto físico na Grande Vitória: o que existe é atendimento online, vídeo do veículo sob pedido e entrega ou retirada combinadas depois que a proposta está clara.",
      "Quem mora na Serra e quer vender o carro para trocar por outro também resolve tudo no WhatsApp: mande marca, modelo, ano, quilometragem e fotos e receba a avaliação.",
    ],
    faqs: [
      {
        question: "Como funciona a entrega para quem mora na Serra?",
        answer:
          "A loja é em Linhares. Para a Serra, a entrega ou a retirada é combinada caso a caso no WhatsApp, depois da proposta e da conferência da documentação.",
      },
      {
        question: "Preciso viajar até Linhares para fechar?",
        answer:
          "Não necessariamente. Dúvidas, vídeo e proposta acontecem online. Como e onde o veículo é entregue fica combinado na conversa.",
      },
    ],
  },
  "vila-velha": {
    title: `Carros e motos seminovos para Vila Velha (ES) | ${site.name}`,
    description:
      "Seminovos para quem mora em Vila Velha: compare ficha, fotos e preço no site da Garagem, peça vídeo pelo WhatsApp e combine a entrega. Troca do usado inclusa.",
    heading: "Seminovos para quem mora em Vila Velha",
    paragraphs: [
      "Quem mora na Praia da Costa, em Itapuã, em Itaparica ou na Glória costuma comparar vários anúncios antes de decidir. Na Garagem cada ficha traz o ano, a quilometragem, o câmbio e as fotos reais, e você escolhe com calma, sem ir de loja em loja pela Rodovia do Sol.",
      "A Garagem atende Vila Velha de forma digital, a partir de Linhares. O vídeo do carro ou da moto vem no WhatsApp quando você pedir, e a entrega ou retirada é combinada só depois de a proposta estar clara para os dois lados.",
      "Tem um usado em Vila Velha para dar na troca? Envie os dados pela página Vender/Trocar. Dependendo do caso, o valor da troca entra como parte do pagamento do seminovo escolhido.",
    ],
    faqs: [
      {
        question: "Vocês entregam o veículo em Vila Velha?",
        answer:
          "A entrega ou a retirada em Vila Velha é combinada pelo WhatsApp, caso a caso, depois que você já viu o veículo em vídeo e aceitou a proposta.",
      },
      {
        question: "Posso trocar meu carro de Vila Velha por um do estoque?",
        answer:
          "Pode. A avaliação é feita com base nas informações e fotos do seu veículo, e o valor pode entrar como entrada na compra.",
      },
    ],
  },
  colatina: {
    title: `Seminovos em Colatina (ES): carros e motos | ${site.name}`,
    description:
      "Seminovos para Colatina e o noroeste do ES: ficha, fotos e preço no site da Garagem, vídeo e proposta pelo WhatsApp. Avaliação do seu usado na troca.",
    heading: "Seminovos para Colatina e região",
    paragraphs: [
      "Colatina fica a cerca de 100 km de Linhares pela BR-259, um trajeto que muita gente do noroeste do estado já faz para resolver compra de veículo. Com o estoque no site e o vídeo no WhatsApp, você só viaja quando já sabe o que quer ver.",
      "Quem mora no Centro, no Esplanada, em Lacerda ou nas comunidades do interior ao redor costuma buscar carro firme para estrada e moto para o dia a dia. Use os filtros do estoque por tipo, ano e câmbio e abra a ficha para conferir as fotos e a quilometragem.",
      "A Garagem também compra e avalia o seu usado em Colatina: envie as informações pela página Vender/Trocar e combine a conversa pelo WhatsApp.",
    ],
    faqs: [
      {
        question: "Vale a viagem de Colatina até Linhares?",
        answer:
          "Antes de viajar, peça o vídeo e confirme a documentação pelo WhatsApp. Se o veículo fizer sentido, marcamos horário para você ver pessoalmente em Linhares.",
      },
      {
        question: "Dá para avaliar meu veículo de Colatina sem sair de casa?",
        answer:
          "Dá. Envie marca, modelo, ano, quilometragem e fotos, e retornamos com a avaliação pelo WhatsApp.",
      },
    ],
  },
};

export function getCityLocalContent(slug: string): CityLocalContent | undefined {
  return CITY_LOCAL_CONTENT[slug];
}
