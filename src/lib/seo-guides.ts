import { site } from "@/lib/site";

/**
 * Guias de busca local (/guia/[slug]). Sem preço, taxa ou simulação no texto:
 * valor e condições vivem na ficha do dia e na análise feita no WhatsApp.
 * `models` escolhe, entre os veículos DISPONÍVEIS, quais fichas linkar
 * (comparação sem acento, pelo nome do modelo).
 */
export type SeoGuide = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: readonly { heading: string; paragraphs: readonly string[]; items?: readonly string[] }[];
  /** Título da seção que lista as fichas do estoque, com a introdução. */
  stockHeading: string;
  stockIntro: string;
  models: readonly string[];
  faqs: readonly { question: string; answer: string }[];
  whatsappMessage: string;
  links: readonly { href: string; label: string }[];
};

export const SEO_GUIDES: readonly SeoGuide[] = [
  {
    slug: "financiamento-seminovos-linhares",
    title: `Financiamento de seminovos em Linhares | ${site.name}`,
    description:
      "Saiba como financiar seminovo em Linhares e no norte do ES. Análise pelo WhatsApp, bancos parceiros e estoque atual da Garagem.",
    h1: "Financiamento de seminovos em Linhares e no norte do ES",
    intro:
      "Financiar um seminovo é mais simples quando você sabe o que o banco olha e o que separar antes. Este guia resume o caminho na Garagem, para quem mora em Linhares, Aracruz, Vitória e no norte do Espírito Santo.",
    sections: [
      {
        heading: "Como funciona o financiamento na Garagem",
        paragraphs: [
          "Você escolhe o veículo no estoque, chama no WhatsApp e informa a entrada que pretende dar. A Garagem envia os dados para bancos e financeiras parceiras, que fazem a análise de crédito. A aprovação e as condições são definidas caso a caso, e só depois disso você decide se fecha.",
          "O site não calcula nem promete condições: o que vale é a resposta da análise, feita no WhatsApp com o veículo que você escolheu.",
        ],
      },
      {
        heading: "O que os bancos analisam",
        paragraphs: ["Cada instituição tem seus critérios, mas costumam pesar os mesmos pontos:"],
        items: [
          "Histórico de crédito e renda comprovada ou declarada",
          "Valor da entrada em relação ao preço do veículo",
          "Prazo desejado e idade do veículo",
          "Documentação em dia, de quem compra e do veículo",
        ],
      },
      {
        heading: "Entrada, troca e financiamento juntos",
        paragraphs: [
          "O seu usado pode virar a entrada. Avaliamos o carro ou a moto pelo WhatsApp ou pela página Vender/Trocar e o valor da troca entra na conta. O restante pode ser financiado. Veja o passo a passo no guia de troca com volta.",
        ],
      },
      {
        heading: "Documentos que você precisa",
        paragraphs: ["Separe antes de começar, para a análise andar mais rápido:"],
        items: [
          "Documento de identificação com foto e CPF",
          "Comprovante de residência recente",
          "Comprovante de renda, quando solicitado",
          "Se houver troca: documento do veículo (CRLV-e) e dados do seu usado",
        ],
      },
      {
        heading: "Por que simular no WhatsApp (e não no site)",
        paragraphs: [
          "A análise depende do seu perfil e do veículo escolhido, e muda com o tempo. Por isso a conversa acontece no WhatsApp, com uma pessoa da Garagem acompanhando do primeiro recado até a documentação.",
        ],
      },
    ],
    stockHeading: "Estoque pronto para financiar agora",
    stockIntro:
      "Alguns veículos disponíveis hoje. Abra a ficha para ver ano, quilometragem e fotos, e chame no WhatsApp com o veículo escolhido.",
    models: ["Civic", "Creta", "Kicks", "City", "Haval"],
    faqs: [
      {
        question: "Vocês financiam carros e motos?",
        answer:
          "Sim, com bancos e financeiras parceiras. A aprovação é analisada caso a caso.",
      },
      {
        question: "Dá para financiar com meu usado na troca?",
        answer: "Sim. O valor da troca pode virar entrada na compra do seminovo.",
      },
      {
        question: "O site mostra taxa ou valor de financiamento?",
        answer:
          "Não. As condições saem da análise de crédito, feita pelo WhatsApp com o veículo que você escolheu.",
      },
      {
        question: "Atendem só Linhares?",
        answer:
          "Atendimento online para Linhares, Vitória, Aracruz e toda a região norte do ES.",
      },
    ],
    whatsappMessage: "Oi Garagem! Quero simular financiamento de seminovo.",
    links: [
      { href: "/estoque", label: "Ver o estoque" },
      { href: "/vender", label: "Vender ou trocar meu veículo" },
      { href: "/contato", label: "Contato" },
      { href: "/guia/troca-com-volta", label: "Guia: troca com volta" },
    ],
  },
  {
    slug: "troca-com-volta",
    title: `Troca com volta: use seu usado na compra | ${site.name}`,
    description:
      "Troque seu carro ou moto com volta na Garagem. Avaliação pelo WhatsApp, proposta justa e estoque de seminovos no ES.",
    h1: "Troca com volta: seu usado entra na conta",
    intro:
      "Na troca com volta você entrega o seu carro ou moto como parte do pagamento e paga (ou financia) a diferença. Aqui está como funciona na Garagem, de Linhares a Vitória.",
    sections: [
      {
        heading: "O que é troca com volta",
        paragraphs: [
          "É quando o valor do seu usado cobre parte do seminovo escolhido e você complementa a diferença, à vista ou financiada. A “volta” é essa diferença.",
        ],
      },
      {
        heading: "Passo a passo da avaliação",
        paragraphs: ["O processo é todo online até a proposta ficar clara:"],
        items: [
          "Envie marca, modelo, ano, quilometragem e fotos pelo formulário ou pelo WhatsApp",
          "Analisamos o veículo real: estado, mercado e demanda",
          "Você recebe a proposta e escolhe o seminovo do estoque",
          "Combinamos conferência, documentação e entrega",
        ],
      },
      {
        heading: "Quando a troca cobre (ou não) o valor do seminovo",
        paragraphs: [
          "Se o seu usado vale mais do que o seminovo escolhido, a diferença fica com você. Se vale menos, a diferença pode ser paga ou financiada. Em ambos os casos, a conta fecha só depois da avaliação.",
        ],
      },
      {
        heading: "Documentação na troca",
        paragraphs: [
          "Tenha à mão o documento do veículo (CRLV-e), os dados do proprietário e informação sobre eventual financiamento em andamento. A Garagem acompanha a transferência até o fim.",
        ],
      },
      {
        heading: "Formulário Vender/Trocar + WhatsApp",
        paragraphs: [
          "O formulário da página Vender/Trocar organiza as informações e o WhatsApp acelera a conversa. Use os dois, o que for mais prático para você.",
        ],
      },
    ],
    stockHeading: "Modelos do estoque bons para trocar agora",
    stockIntro:
      "Alguns veículos disponíveis hoje que combinam com a troca. Abra a ficha e chame no WhatsApp com o seu usado.",
    models: ["Ka", "HB20", "Mobi", "Versa", "Duster"],
    faqs: [
      {
        question: "Vocês compram meu carro mesmo sem eu comprar outro?",
        answer: "Sim. Também avaliamos só a venda.",
      },
      {
        question: "Como acelerar a avaliação?",
        answer:
          "Mande marca, modelo, ano, quilometragem e fotos pelo formulário ou pelo WhatsApp.",
      },
      {
        question: "A proposta é FIPE automática?",
        answer:
          "Não. Avaliamos o veículo real: estado, mercado e demanda.",
      },
      {
        question: "Posso trocar moto por carro, ou o contrário?",
        answer: "Sim. Combinamos no WhatsApp.",
      },
    ],
    whatsappMessage: "Oi Garagem! Quero avaliar meu usado pra troca com volta.",
    links: [
      { href: "/vender", label: "Vender ou trocar meu veículo" },
      { href: "/estoque", label: "Ver o estoque" },
      { href: "/contato", label: "Contato" },
      { href: "/faq", label: "Perguntas frequentes" },
      { href: "/guia/financiamento-seminovos-linhares", label: "Guia: financiamento" },
    ],
  },
  {
    slug: "comparativos-estoque",
    title: `Comparativos do estoque | Qual seminovo escolher | ${site.name}`,
    description:
      "Compare seminovos reais do estoque da Garagem: SUV, hatch, sedan e moto. Preços e links das fichas atualizadas.",
    h1: "Comparativos com o estoque real da Garagem",
    intro:
      "Comparações entre veículos que estão (ou estiveram) no estoque da Garagem. Preço e disponibilidade mudam: o que vale é a ficha do dia.",
    sections: [
      {
        heading: "Como usar este guia",
        paragraphs: [
          "O estoque muda com frequência. Use os pares abaixo como ponto de partida e confira cada ficha: ano, quilometragem, câmbio e fotos. Veículos já vendidos saem da lista.",
        ],
      },
      {
        heading: "SUVs e crossovers: Creta × Kicks × Haval H6",
        paragraphs: [
          "Creta e Kicks disputam o mesmo público: SUV compacto, posição de dirigir alta e uso urbano com estrada. O Haval H6 é de outra faixa, com proposta híbrida plug-in. Compare ano, versão e quilometragem nas fichas.",
        ],
      },
      {
        heading: "Hatches e compactos: HB20 × Mobi × Ka+",
        paragraphs: [
          "Compactos são a escolha para cidade e para quem quer custo de uso baixo. Entre HB20, Mobi e Ka+, olhe o ano, o motor e o câmbio de cada ficha.",
        ],
      },
      {
        heading: "Sedãs: City × Versa × Civic",
        paragraphs: [
          "Sedãs oferecem porta-malas maior e conforto de estrada. City e Versa ficam na faixa intermediária; o Civic sobe de categoria. Compare versão e itens de série na ficha.",
        ],
      },
      {
        heading: "Motos de entrada: Biz × CG 160 × Fazer 250",
        paragraphs: [
          "A Biz é a mais econômica para o dia a dia, a CG 160 é a clássica de trabalho e a Fazer 250 entrega mais desempenho para estrada.",
        ],
      },
      {
        heading: "Qual combinar com financiamento ou troca",
        paragraphs: [
          "Escolheu dois modelos? Mande os dois no WhatsApp: avaliamos a troca e levantamos o financiamento dos dois, para você decidir com os números na mão.",
        ],
      },
    ],
    stockHeading: "Fichas do estoque para comparar",
    stockIntro:
      "Os veículos disponíveis hoje que aparecem neste guia, com o preço da ficha de hoje.",
    models: [
      "Creta", "Kicks", "Haval", "HB20", "Mobi", "Ka", "City", "Versa", "Civic",
      "Biz", "CG", "Fazer",
    ],
    faqs: [
      {
        question: "Os preços do guia são fixos?",
        answer: "Não. Valem o que estiver na ficha do site no dia.",
      },
      {
        question: "Posso pedir vídeo de dois carros?",
        answer:
          "Sim. Use “Pedir vídeo” em cada ficha ou chame no WhatsApp.",
      },
      {
        question: "Vocês têm loja física para test-drive?",
        answer:
          "Somos loja digital. Combinamos visita, entrega ou retirada pelo WhatsApp.",
      },
      {
        question: "Dá para comparar financiamento de dois modelos?",
        answer: "Sim. Mande os dois no WhatsApp que fazemos a análise.",
      },
    ],
    whatsappMessage: "Oi Garagem! Quero comparar dois seminovos do estoque.",
    links: [
      { href: "/estoque", label: "Ver o estoque" },
      { href: "/guia/financiamento-seminovos-linhares", label: "Guia: financiamento" },
      { href: "/guia/troca-com-volta", label: "Guia: troca com volta" },
    ],
  },
];

export function getSeoGuide(slug: string) {
  return SEO_GUIDES.find((guide) => guide.slug === slug);
}

const norm = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Veículos disponíveis cujo modelo começa com um dos nomes do guia. */
export function pickGuideVehicles<T extends { model: string }>(
  vehicles: readonly T[],
  models: readonly string[],
): T[] {
  const wanted = models.map(norm);
  return vehicles.filter((vehicle) => {
    const model = norm(vehicle.model);
    return wanted.some((name) => model === name || model.startsWith(`${name} `));
  });
}
