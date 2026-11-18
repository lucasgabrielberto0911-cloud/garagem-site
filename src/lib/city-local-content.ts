import { site } from "@/lib/site";

/**
 * Conteúdo próprio das praças prioritárias (Linhares, Aracruz, Vitória,
 * Grande Vitória, Serra, Vila Velha e Colatina). Cada uma tem title,
 * description, texto e perguntas diferentes — sem trocar só o nome da cidade.
 * Sem preço, parcela ou prazo: o valor vale o que estiver na ficha do dia.
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
      "Carros e motos seminovos em Linhares/ES com ficha, fotos e preço no site. Atendemos Linhares, Aracruz e Grande Vitória; combinamos o atendimento pelo WhatsApp.",
    heading: "Seminovos em Linhares e no norte do ES",
    paragraphs: [
      "Atendemos Linhares, Aracruz e Grande Vitória. Quem mora no Centro, em Interlagos, no Araçá, em Bebedouro ou vem de Sooretama e Rio Bananal combina visita, entrega ou retirada em Linhares com praticidade.",
      "Quem trabalha no comércio, no campo ou na indústria da região tem rotina corrida. O estoque fica aberto no site o dia todo e combinamos o atendimento pelo WhatsApp, das 8h às 23h, para enviar vídeo e tirar dúvidas.",
      "Se você já tem um carro ou uma moto em Linhares, vale começar pela avaliação: a troca com volta e o financiamento entram na mesma conversa. Os guias abaixo explicam cada passo.",
    ],
    faqs: [
      {
        question: "Dá para ver o carro pessoalmente em Linhares?",
        answer:
          "Dá. Combinamos o atendimento pelo WhatsApp: depois do vídeo e da proposta, alinhamos a visita para você conferir o veículo em Linhares, sem fila e sem pressa.",
      },
      {
        question: "Vocês compram carro e moto de quem mora em Linhares?",
        answer:
          "Sim. Também avaliamos só a venda, mesmo sem você comprar outro. Envie marca, modelo, ano, km e fotos pela página Vender/Trocar.",
      },
    ],
  },
  aracruz: {
    title: `Seminovos em Aracruz/ES: carros e motos com troca | ${site.name}`,
    description:
      "Carros e motos seminovos em Aracruz/ES: compare ficha, fotos e preço no site da Garagem. Atendemos Linhares, Aracruz e Grande Vitória pelo WhatsApp.",
    heading: "Seminovos em Aracruz e no litoral norte",
    paragraphs: [
      "Quem vive no Centro de Aracruz, em Coqueiral, em Barra do Riacho, em Guaraná ou trabalha no eixo industrial da ES-010 e da ES-257 ganha tempo comparando ano, quilometragem e câmbio direto nas fichas do site.",
      "Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp todos os dias, das 8h às 23h: você pede o vídeo do veículo, tira dúvidas de documentação e alinha visita, entrega ou retirada quando a proposta fizer sentido.",
      "Tem carro ou moto em Aracruz para entrar no negócio? Envie marca, modelo, ano, km e fotos pela página Vender/Trocar para receber a avaliação sem compromisso, ou consulte os guias abaixo.",
    ],
    faqs: [
      {
        question: "Como funciona a entrega ou visita em Aracruz?",
        answer:
          "Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp: depois que você analisa a ficha, vê o vídeo e alinha a proposta, definimos a visita, a entrega ou a retirada em Aracruz.",
      },
      {
        question: "Vocês avaliam carro ou moto de Aracruz só para compra?",
        answer:
          "Sim. Além da troca por outro veículo do estoque, avaliamos seu seminovo para compra direta pela página Vender/Trocar ou pelo WhatsApp.",
      },
    ],
  },
  vitoria: {
    title: `Seminovos em Vitória (ES): carros e motos | ${site.name}`,
    description:
      "Seminovos em Vitória/ES com ficha, fotos e preço no site da Garagem. Atendemos Linhares, Aracruz e Grande Vitória e combinamos o atendimento pelo WhatsApp.",
    heading: "Seminovos para quem mora ou trabalha em Vitória",
    paragraphs: [
      "Entre Jardim Camburi, Mata da Praia, Jardim da Penha, Praia do Canto, Bento Ferreira e o Centro de Vitória, cruzar a cidade de pátio em pátio toma horas. Na Garagem, cada ficha já mostra fotos reais, quilometragem, câmbio e valor.",
      "Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp das 8h às 23h: enviamos vídeo detalhado do veículo escolhido, explicamos a documentação e alinhamos visita, entrega ou retirada na capital.",
      "Se quiser incluir seu carro ou moto de Vitória na negociação, preencha os dados em Vender/Trocar. A avaliação é feita à distância e pode entrar como parte do pagamento.",
    ],
    faqs: [
      {
        question: "Como combino para ver ou receber o veículo em Vitória?",
        answer:
          "Atendemos Linhares, Aracruz e Grande Vitória e combinamos o atendimento pelo WhatsApp. Após conferir ficha, vídeo e proposta, alinhamos a visita, a entrega ou a retirada em Vitória.",
      },
      {
        question: "Consigo avaliar meu usado de Vitória antes de escolher outro no estoque?",
        answer:
          "Sim. Envie marca, modelo, ano, quilometragem e fotos pela página Vender/Trocar ou pelo WhatsApp para receber a avaliação sem compromisso.",
      },
    ],
  },
  "grande-vitoria": {
    title: `Seminovos na Grande Vitória (ES): carros e motos | ${site.name}`,
    description:
      "Seminovos na Grande Vitória: Vitória, Vila Velha, Serra e Cariacica. Atendemos Linhares, Aracruz e Grande Vitória; combinamos o atendimento pelo WhatsApp.",
    heading: "Seminovos em toda a Grande Vitória",
    paragraphs: [
      "Quem circula entre Vitória, Vila Velha, Serra, Cariacica e Viana costuma pesquisar seminovos na região metropolitana inteira antes de fechar. No site da Garagem, o estoque reúne carros e motos com ficha técnica, fotos reais e preço visível.",
      "Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp das 8h às 23h: você pede vídeo do motor e do interior, consulta financiamento com bancos parceiros e alinha visita, entrega ou retirada no seu município.",
      "Quer usar seu veículo atual como parte do pagamento na Grande Vitória? Cadastre os dados em Vender/Trocar ou chame no WhatsApp para avaliar a troca com volta.",
    ],
    faqs: [
      {
        question: "Quais cidades da Grande Vitória recebem atendimento da Garagem?",
        answer:
          "Atendemos Linhares, Aracruz e Grande Vitória — cobrindo Vitória, Vila Velha, Serra, Cariacica, Viana e Guarapari. Combinamos o atendimento pelo WhatsApp em todas elas.",
      },
      {
        question: "O estoque mostrado para a Grande Vitória é o mesmo do restante do site?",
        answer:
          "Sim. Os veículos disponíveis nas fichas são compartilhados entre todas as regiões atendidas, com preço e disponibilidade atualizados no site.",
      },
    ],
  },
  serra: {
    title: `Seminovos para quem mora na Serra (ES) | ${site.name}`,
    description:
      "Procurando seminovo na Serra? Veja carros e motos no site da Garagem. Atendemos Linhares, Aracruz e Grande Vitória e combinamos o atendimento pelo WhatsApp.",
    heading: "Comprar seminovo morando na Serra",
    paragraphs: [
      "A Serra tem rotina intensa entre Jacaraípe, Manguinhos, Laranjeiras, Carapina e o polo do Civit. Por isso vale comparar ficha, fotos, quilometragem e valor no site antes de qualquer deslocamento pela BR-101 ou pela Norte-Sul.",
      "Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp: enviamos vídeo do veículo sob pedido, orientamos financiamento e documentação e alinhamos visita, entrega ou retirada depois que a proposta está clara.",
      "Quem mora na Serra e quer vender o carro para trocar por outro também resolve tudo no WhatsApp: mande marca, modelo, ano, quilometragem e fotos e receba a avaliação.",
    ],
    faqs: [
      {
        question: "Como funciona a entrega para quem mora na Serra?",
        answer:
          "Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp, e a visita, a entrega ou a retirada na Serra é alinhada caso a caso depois da proposta e da conferência da documentação.",
      },
      {
        question: "Preciso sair da Serra antes de ter a proposta definida?",
        answer:
          "Não. Dúvidas, vídeo e proposta acontecem pelo site e na conversa. Combinamos o atendimento pelo WhatsApp, incluindo como e onde você vê ou recebe o veículo.",
      },
    ],
  },
  "vila-velha": {
    title: `Carros e motos seminovos para Vila Velha (ES) | ${site.name}`,
    description:
      "Seminovos para quem mora em Vila Velha: compare ficha, fotos e preço no site da Garagem, peça vídeo pelo WhatsApp e combine a entrega. Troca do usado inclusa.",
    heading: "Seminovos para quem mora em Vila Velha",
    paragraphs: [
      "Quem mora na Praia da Costa, em Itapuã, em Itaparica ou na Glória costuma comparar vários anúncios antes de decidir. Na Garagem cada ficha traz o ano, a quilometragem, o câmbio e as fotos reais, e você escolhe com calma, sem correr pela Rodovia do Sol.",
      "Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp: o vídeo do carro ou da moto vem quando você pedir, e a entrega ou retirada em Vila Velha é alinhada só depois de a proposta estar clara para os dois lados.",
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
      "Quem mora em Colatina e no noroeste do estado costuma pegar a BR-259 para resolver compra de veículo. Com o estoque no site e o vídeo no WhatsApp, você confere cada detalhe antes de sair de casa.",
      "No Centro, no Esplanada, em Lacerda ou nas comunidades do interior ao redor, a procura divide-se entre carro firme para estrada e moto para o dia a dia. Use os filtros do estoque por tipo, ano e câmbio e abra a ficha para ver fotos e quilometragem.",
      "Atendemos Linhares, Aracruz e Grande Vitória, além de Colatina e região. Combinamos o atendimento pelo WhatsApp e também avaliamos o seu usado na troca pela página Vender/Trocar.",
    ],
    faqs: [
      {
        question: "Como funciona a visita ou entrega para quem está em Colatina?",
        answer:
          "Antes de pegar a estrada, peça o vídeo e confirme a documentação. Combinamos o atendimento pelo WhatsApp e alinhamos a visita, a entrega ou a retirada quando a proposta fizer sentido.",
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
