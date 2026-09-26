import { PHONES } from "@/lib/site";

export type ServiceCity = {
  slug: string;
  name: string;
  metaDescription: string;
  lead: string;
  paragraphs: readonly [string, string];
  bullets: readonly string[];
  faqs: readonly { question: string; answer: string }[];
};

export const SERVICE_CITIES = [
  {
    slug: "aracruz",
    name: "Aracruz",
    metaDescription:
      "Seminovos em Aracruz, no litoral norte do ES. Ficha, fotos e preço no site da Sua Garagem; vídeo no WhatsApp quando você pedir. Atendimento das 8h às 23h.",
    lead: "No Centro, no Coqueiral, na Barra do Riacho ou perto do polo industrial, você não precisa ir até a capital só para ler a ficha de um seminovo. Fotos e preço já estão no site da Sua Garagem. O que faltar, você pergunta no WhatsApp.",
    paragraphs: [
      "Se o seu caminho é a ES-010, o polo ou a praia, a comparação fica no celular: ficha, fotos e preço no anúncio. O vídeo do carro a gente manda quando você pedir — no horário em que estiver livre.",
      "O WhatsApp fica aberto todos os dias, das 8h às 23h. Troca e documentação entram nessa conversa, sem compromisso de fechar. Visita, entrega ou retirada a gente marca só depois que a proposta estiver clara.",
    ],
    bullets: [
      "Ficha, fotos e preço no anúncio, para comparar sem sair de Aracruz",
      "Vídeo do carro quando você pedir, no seu horário",
      "Troca e documentação na mesma conversa, sem compromisso",
      `WhatsApp ${PHONES[0].label} · todos os dias, 8h–23h`,
    ],
    faqs: [
      {
        question: "A Sua Garagem atende quem está em Aracruz?",
        answer:
          "Sim. Atendemos Aracruz e o litoral norte por WhatsApp e telefone: avaliação, fotos, vídeos e orientação de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Preciso ir a Vitória para ver o carro?",
        answer:
          "Não para começar. Você escolhe no estoque, recebe detalhes e vídeo e só combina visita ou entrega quando a proposta já fizer sentido.",
      },
      {
        question: "Posso colocar meu veículo na troca?",
        answer:
          "Pode. Envie os dados pela página Vender/Trocar ou pelo WhatsApp para uma avaliação sem compromisso.",
      },
    ],
  },
  {
    slug: "vitoria",
    name: "Vitória",
    metaDescription:
      "Seminovos em Vitória (ES): Praia do Canto, Jardim da Penha, Enseada e Camburi. Compare ficha e preço no site da Sua Garagem e fale no WhatsApp, das 8h às 23h.",
    lead: "Entre o trabalho e a ponte, sobra pouco tempo. Na Praia do Canto, no Jardim da Penha, na Enseada ou em Camburi, você olha o seminovo no site da Sua Garagem e chama no WhatsApp quando der.",
    paragraphs: [
      "No celular estão a ficha, as fotos e o preço. Peça o vídeo do que quiser conferir — motor, câmbio, um detalhe da lataria. A Sua Garagem é loja digital: tem gente do outro lado, do primeiro recado até a documentação, e ninguém empurra a decisão.",
      "Se você mora na ilha ou cruza a Terceira Ponte e a Segunda Ponte todo dia, o horário ajuda: das 8h às 23h, inclusive no fim de semana. Troca, orientação de financiamento e documentação ficam nessa conversa. O encontro só entra quando a proposta estiver clara.",
    ],
    bullets: [
      "Filtro de preço, ano e câmbio para achar o carro na hora que der",
      "Vídeo e ficha antes de você sair de casa",
      "Troca e financiamento explicados na conversa, com calma",
      `WhatsApp oficial ${PHONES[0].label} · todos os dias, 8h–23h`,
    ],
    faqs: [
      {
        question: "A Sua Garagem atende quem está em Vitória?",
        answer:
          "Sim. Atendemos a capital e a Grande Vitória por WhatsApp e telefone, com fotos, vídeos e orientação de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Como funciona a compra de um seminovo à distância?",
        answer:
          "Você escolhe no estoque, tira dúvidas pelo WhatsApp, recebe detalhes e vídeos do veículo e avança na proposta com transparência. A transferência é acompanhada pela equipe.",
      },
      {
        question: "Posso colocar meu veículo na troca?",
        answer:
          "Pode. Envie os dados do seu veículo pela página Vender/Trocar ou pelo WhatsApp para uma avaliação sem compromisso.",
      },
    ],
  },
  {
    slug: "linhares",
    name: "Linhares",
    metaDescription:
      "Seminovos em Linhares e no norte do ES. Antes da BR-101, veja ficha, fotos e preço no site da Sua Garagem e peça o vídeo no WhatsApp — das 8h às 23h.",
    lead: "De Linhares à capital são horas na BR-101. No Centro, no Araçá, no Interlagos ou no interior, você vê o seminovo no site da Sua Garagem e tira a dúvida no WhatsApp antes de sair.",
    paragraphs: [
      "Se o caminho passa pelo Rio Doce ou pela estrada, faz diferença decidir com o carro na tela. No anúncio estão a ficha, a quilometragem, as fotos e o preço. Se você pedir o vídeo, a gente mostra o que der para mostrar.",
      "Você fala com a gente todos os dias, das 8h às 23h. Troca e documentação entram na mesma conversa, sem pressa. Não temos loja em Linhares: visita, entrega ou retirada a gente combina com a proposta já clara.",
    ],
    bullets: [
      "Ficha, km e preço no site, para você decidir ainda em Linhares",
      "Vídeo do carro antes de pegar a BR-101",
      "Troca e documentação alinhadas com você na conversa",
      `WhatsApp ${PHONES[0].label} — das 8h às 23h, todos os dias`,
    ],
    faqs: [
      {
        question: "A Sua Garagem atende quem está em Linhares?",
        answer:
          "Sim. Atendemos Linhares e o norte do ES por WhatsApp e telefone: fotos, vídeos e orientação de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Consigo resolver quase tudo sem ir à loja?",
        answer:
          "A Sua Garagem é loja digital. A escolha, as dúvidas e a proposta acontecem no site e no WhatsApp. Visita, entrega ou retirada só entram quando vocês combinam.",
      },
      {
        question: "Posso colocar meu veículo na troca?",
        answer:
          "Pode. Envie os dados pela página Vender/Trocar ou pelo WhatsApp para uma avaliação sem compromisso.",
      },
    ],
  },
  {
    slug: "serra",
    name: "Serra",
    metaDescription:
      "Seminovos em Serra (ES): Laranjeiras, Carapina, Barcelona e região do Civit. Ficha e preço no site da Sua Garagem; vídeo no WhatsApp, das 8h às 23h.",
    lead: "Em Laranjeiras, Barcelona, Carapina, Novo Horizonte ou perto do Civit, você começa pelo site. A Sua Garagem mostra o seminovo com foto, ano, km e preço; o WhatsApp entra quando você quiser falar.",
    paragraphs: [
      "O dia na Serra passa na BR-101, no shopping, no colégio ou no corredor industrial. Dá para filtrar à noite, quando o trânsito já baixou: foto, ano, km e preço no anúncio. O vídeo do carro chega no WhatsApp, se você pedir.",
      "A gente atende todos os dias, das 8h às 23h. Troca do usado, orientação de financiamento e documentação ficam na mesma conversa. Não tem ponto físico obrigatório: visita ou entrega só quando preço e condições já estiverem alinhados.",
    ],
    bullets: [
      "Foto, ano, km e preço para filtrar depois do trânsito da Serra",
      "Vídeo no WhatsApp antes de sair de Laranjeiras ou de Carapina",
      "Avaliação do usado para venda ou troca, sem compromisso",
      `WhatsApp oficial ${PHONES[0].label}`,
    ],
    faqs: [
      {
        question: "A Sua Garagem atende quem mora na Serra?",
        answer:
          "Sim. Atendemos Serra e a Grande Vitória por WhatsApp e telefone. Você vê o estoque no site, pede vídeo e tira dúvida de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Tem loja física na Serra?",
        answer:
          "Não. A Sua Garagem é loja digital. A vitrine é o site e o atendimento é no WhatsApp. Combinamos visita ao veículo, entrega ou retirada quando o negócio avançar.",
      },
      {
        question: "Consigo colocar meu veículo na troca morando na Serra?",
        answer:
          "Sim. Envie marca, ano, km e fotos pela página Vender/Trocar ou pelo WhatsApp. A avaliação é sem compromisso.",
      },
    ],
  },
  {
    slug: "vila-velha",
    name: "Vila Velha",
    metaDescription:
      "Seminovos em Vila Velha (ES), da Praia da Costa ao Centro. Fotos, ficha e preço no site da Sua Garagem. Peça o vídeo no WhatsApp — todos os dias, das 8h às 23h.",
    lead: "Na Praia da Costa, em Itapoã, no Ibes ou no Coqueiral de Itaparica, você escolhe o seminovo sem cruzar a Terceira Ponte só para ler anúncio. A ficha está no site da Sua Garagem; a conversa, no WhatsApp.",
    paragraphs: [
      "Compare no celular o que pesa na decisão: preço, câmbio, km e fotos. Se um carro fizer sentido, peça o vídeo. A gente responde todos os dias, das 8h às 23h, e você não precisa decidir na mesma hora.",
      "Compra, venda e troca ficam nesse atendimento. Não temos loja na orla. Quando a proposta já estiver alinhada, a gente combina visita ou entrega e acompanha a documentação até a transferência.",
    ],
    bullets: [
      "Preço, câmbio e fotos para você comparar com calma",
      "Vídeo do seminovo antes de cruzar a Terceira Ponte",
      "Troca do usado e orientação de financiamento na conversa",
      `WhatsApp ${PHONES[0].label} · atendimento das 8h às 23h`,
    ],
    faqs: [
      {
        question: "A Sua Garagem atende Vila Velha?",
        answer:
          "Sim. Atendemos Vila Velha e a orla da Grande Vitória por WhatsApp e telefone, com fotos, vídeos e orientação de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Vocês têm loja na Praia da Costa?",
        answer:
          "Não. Somos loja digital. O estoque está no site e o contato é no WhatsApp. Visita, entrega ou retirada são combinadas depois que você já viu o veículo com calma.",
      },
      {
        question: "Posso avaliar meu carro para troca em Vila Velha?",
        answer:
          "Pode. Mande os dados na página Vender/Trocar ou no WhatsApp. A avaliação é gratuita e sem compromisso.",
      },
    ],
  },
  {
    slug: "guarapari",
    name: "Guarapari",
    metaDescription:
      "Seminovos em Guarapari (ES): Praia do Morro, Meaípe e Muquiçaba. Ficha e preço no site da Sua Garagem; vídeo no WhatsApp quando você pedir, das 8h às 23h.",
    lead: "Na Praia do Morro, em Meaípe, no Centro ou na Muquiçaba, você vê o seminovo no site da Sua Garagem. Se quiser falar, mesmo com a ES-060 cheia, chama no WhatsApp.",
    paragraphs: [
      "Na temporada, o sábado some no trânsito da orla. No celular você olha preço, câmbio, km e fotos e pede o vídeo do carro que passou no seu filtro. A gente responde todos os dias, das 8h às 23h.",
      "A Sua Garagem é loja digital: não temos ponto na Praia do Morro. Compra, venda e troca entram na mesma conversa. Visita, entrega ou retirada ficam para quando você já tiver visto o carro com calma e a proposta fizer sentido.",
    ],
    bullets: [
      "Ficha e fotos no site, para olhar com calma mesmo na temporada",
      "Vídeo do seminovo antes de você pegar a ES-060",
      "Seu usado avaliado para venda ou troca, quando você quiser",
      `WhatsApp ${PHONES[0].label} · das 8h às 23h`,
    ],
    faqs: [
      {
        question: "A Sua Garagem atende quem está em Guarapari?",
        answer:
          "Sim. Atendemos Guarapari e o litoral sul da Grande Vitória por WhatsApp e telefone, com fotos, vídeos e orientação de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Tem loja na Praia do Morro?",
        answer:
          "Não. A Sua Garagem é loja digital. O estoque está no site e o contato é no WhatsApp. Combinamos visita ou entrega quando o negócio avançar.",
      },
      {
        question: "Posso colocar meu veículo na troca morando em Guarapari?",
        answer:
          "Pode. Envie os dados pela página Vender/Trocar ou pelo WhatsApp. A avaliação é sem compromisso.",
      },
    ],
  },
  {
    slug: "cachoeiro-de-itapemirim",
    name: "Cachoeiro de Itapemirim",
    metaDescription:
      "Seminovos em Cachoeiro de Itapemirim, no sul do ES. Ficha, fotos e preço no site da Sua Garagem; vídeo no WhatsApp antes da BR-101. Atendimento das 8h às 23h.",
    lead: "Até a Grande Vitória são horas de estrada. No Centro, na Independência, no Recanto ou num distrito de Cachoeiro, você vê o seminovo no site da Sua Garagem e tira a dúvida no WhatsApp antes de viajar.",
    paragraphs: [
      "Você já sabe a distância: comércio, mármore e muita BR-101. Por isso a ficha, a quilometragem, as fotos e o preço ficam no anúncio. Se você pedir o vídeo, a gente manda antes da viagem.",
      "A gente atende todos os dias, das 8h às 23h. Troca e documentação ficam na mesma conversa, sem empurrar a decisão. Não temos loja em Cachoeiro: visita, entrega ou retirada a gente combina depois da proposta.",
    ],
    bullets: [
      "Ficha, fotos e preço para comparar antes da viagem",
      "Vídeo pedido por você, antes de ir até a Grande Vitória",
      "Seu usado na troca, e a documentação explicada na conversa",
      `WhatsApp ${PHONES[0].label} · resposta das 8h às 23h`,
    ],
    faqs: [
      {
        question: "A Sua Garagem atende Cachoeiro de Itapemirim?",
        answer:
          "Sim. Atendemos Cachoeiro e o sul do ES por WhatsApp e telefone: fotos, vídeos e orientação de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Consigo resolver quase tudo sem ir à capital?",
        answer:
          "A Sua Garagem é loja digital. A escolha, as dúvidas e a proposta acontecem no site e no WhatsApp. Visita, entrega ou retirada só entram quando vocês combinam.",
      },
      {
        question: "Posso colocar meu veículo na troca?",
        answer:
          "Pode. Envie os dados pela página Vender/Trocar ou pelo WhatsApp para uma avaliação sem compromisso.",
      },
    ],
  },
  {
    slug: "colatina",
    name: "Colatina",
    metaDescription:
      "Seminovos em Colatina, no noroeste do ES. Ficha, fotos e preço no site da Sua Garagem. Vídeo no WhatsApp quando você pedir — das 8h às 23h.",
    lead: "Se você está no Centro, no São Silvano, na Honório Fraga ou perto do Rio Doce, dá para escolher o seminovo com calma. A ficha, as fotos e o preço estão no site da Sua Garagem; no WhatsApp a gente combina o resto, sem pressão para fechar na hora.",
    paragraphs: [
      "Colatina fica longe da Grande Vitória, então vale ver o carro direito antes da estrada. No site você confere ficha, fotos e preço. Se quiser mais detalhe, peça um vídeo — do motor, do câmbio ou do ponto que você quiser olhar.",
      "A gente atende todos os dias, das 8h às 23h. Troca e documentação entram nessa conversa. Não tem ponto físico obrigatório: o encontro a gente marca só depois que a proposta estiver clara.",
    ],
    bullets: [
      "Estoque no site para você olhar à noite, com calma",
      "Vídeo do carro quando você pedir, antes da estrada",
      "Avaliação para venda ou troca do seu usado, sem compromisso",
      `WhatsApp oficial ${PHONES[0].label} · das 8h às 23h`,
    ],
    faqs: [
      {
        question: "A Sua Garagem atende quem mora em Colatina?",
        answer:
          "Sim. Atendemos Colatina e o noroeste do ES por WhatsApp e telefone. Você vê o estoque no site, pede vídeo e tira dúvida de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Tem loja física em Colatina?",
        answer:
          "Não. A Sua Garagem é loja digital. A vitrine é o site e o atendimento é no WhatsApp. Combinamos visita, entrega ou retirada quando o negócio avançar.",
      },
      {
        question: "Consigo colocar meu veículo na troca morando em Colatina?",
        answer:
          "Sim. Envie marca, ano, km e fotos pela página Vender/Trocar ou pelo WhatsApp. A avaliação é sem compromisso.",
      },
    ],
  },
  {
    slug: "cariacica",
    name: "Cariacica",
    metaDescription:
      "Seminovos em Cariacica (ES): Campo Grande, Itacibá e Porto de Santana. Foto, km e preço no site da Sua Garagem. Chame no WhatsApp das 8h às 23h.",
    lead: "Em Campo Grande, no Flexal, em Itacibá ou perto do porto, o seminovo está no site da Sua Garagem. Você pode deixar a conversa do WhatsApp para o fim do expediente — a gente responde até as 23h.",
    paragraphs: [
      "De Campo Grande ao porto, sobra pouco tempo para ir a uma loja. No anúncio tem foto, ano, km e preço — você começa por aí. O vídeo chega no WhatsApp quando você pedir.",
      "Troca, orientação de financiamento e documentação entram na mesma conversa, todos os dias das 8h às 23h, sem pressão para decidir na hora. Visita ou entrega a gente combina quando a proposta já fizer sentido para você.",
    ],
    bullets: [
      "Filtro de preço e câmbio para olhar depois que o trânsito baixar",
      "Vídeo antes de sair de Campo Grande ou do Porto de Santana",
      "Dá para avaliar o usado na troca, sem compromisso de fechar",
      `No WhatsApp ${PHONES[0].label}, das 8h às 23h`,
    ],
    faqs: [
      {
        question: "A Sua Garagem atende Cariacica?",
        answer:
          "Sim. Atendemos Cariacica e a Grande Vitória por WhatsApp e telefone, com fotos, vídeos e orientação de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Vocês têm loja em Campo Grande?",
        answer:
          "Não. Somos loja digital. O estoque está no site e o contato é no WhatsApp. Visita, entrega ou retirada são combinadas depois que você já viu o veículo com calma.",
      },
      {
        question: "Posso avaliar meu carro para troca em Cariacica?",
        answer:
          "Pode. Mande os dados na página Vender/Trocar ou no WhatsApp. A avaliação é gratuita e sem compromisso.",
      },
    ],
  },
  {
    slug: "viana",
    name: "Viana",
    metaDescription:
      "Seminovos em Viana (ES), no eixo da BR-262. Ficha, fotos e preço no site da Sua Garagem — Centro e Marcílio de Noronha. WhatsApp das 8h às 23h.",
    lead: "Viana fica na BR-262, no meio do caminho. Se você mora no Centro, em Marcílio de Noronha ou no Universal, o seminovo está no site da Sua Garagem — troca, dúvida ou visita a gente combina no WhatsApp.",
    paragraphs: [
      "Dá para comparar ficha, fotos e preço no celular, pedir o vídeo e conversar sem furar o expediente. A Sua Garagem é loja digital: tem gente atendendo, do primeiro recado até a documentação.",
      "Compra, venda e troca ficam no mesmo canal, todos os dias das 8h às 23h. Não temos ponto físico em Viana. A visita ou a entrega só acontece quando a proposta já estiver alinhada.",
    ],
    bullets: [
      "Ficha, fotos e preço no site, para decidir sem sair de Viana",
      "Vídeo do seminovo antes de pegar a BR-262",
      "Troca e financiamento explicados na conversa, sem pressão",
      `WhatsApp oficial ${PHONES[0].label}`,
    ],
    faqs: [
      {
        question: "A Sua Garagem atende quem está em Viana?",
        answer:
          "Sim. Atendemos Viana e o entorno da Grande Vitória por WhatsApp e telefone — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Preciso ir a Vitória para começar?",
        answer:
          "Não. Você escolhe no estoque, recebe detalhes e vídeo e só combina visita ou entrega quando a proposta já fizer sentido.",
      },
      {
        question: "Posso colocar meu veículo na troca?",
        answer:
          "Pode. Envie os dados pela página Vender/Trocar ou pelo WhatsApp para uma avaliação sem compromisso.",
      },
    ],
  },
] as const satisfies readonly ServiceCity[];

export type ServiceCitySlug = (typeof SERVICE_CITIES)[number]["slug"];

export function getServiceCity(slug: string) {
  return SERVICE_CITIES.find((city) => city.slug === slug) ?? null;
}

export function otherServiceCities(slug: string) {
  return SERVICE_CITIES.filter((city) => city.slug !== slug);
}
