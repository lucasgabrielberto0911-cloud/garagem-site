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
      "Seminovos com procedência para quem vive em Aracruz e no litoral norte do ES. Estoque no site, vídeo pelo WhatsApp e atendimento online da Sua Garagem, todos os dias das 8h às 23h.",
    lead: "Quem está em Aracruz — no Centro, no Coqueiral, na Barra do Riacho ou no entorno do polo industrial — escolhe o seminovo no site e fecha pelo WhatsApp, sem precisar ir à capital só para ver ficha.",
    paragraphs: [
      "Aracruz concentra rotina de trabalho, escola e deslocamento no litoral norte. A Sua Garagem atende esse ritmo no digital: estoque atualizado, fotos e ficha no anúncio, vídeo do carro quando você pede e conversa direta no WhatsApp até a documentação.",
      "Se o seu dia a dia passa pela ES-010, pelo complexo industrial ou pela praia, a gente resolve a triagem à distância. Combinamos visita, entrega ou retirada quando o negócio já estiver claro — todos os dias, das 8h às 23h.",
    ],
    bullets: [
      "Estoque com fotos e ficha para triar em Aracruz, sem deslocamento cego",
      "Vídeo e dúvidas pelo WhatsApp no horário em que você está livre",
      "Avaliação do seu usado para venda ou troca",
      `Canal oficial: WhatsApp ${PHONES[0].label}`,
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
      "Seminovos em Vitória (ES) com procedência verificada. A Sua Garagem atende a capital no digital: estoque no site, WhatsApp das 8h às 23h, troca e orientação de financiamento.",
    lead: "Em Vitória o tempo some entre trabalho, ponte e trânsito. A Sua Garagem deixa a escolha do seminovo no site e a conversa no WhatsApp — para quem está na Praia do Canto, Jardim da Penha, Enseada ou Camburi.",
    paragraphs: [
      "A capital pede praticidade: você compara anúncios no celular, pede o vídeo do motor e do câmbio e negocia sem furar o expediente. A Sua Garagem é loja digital, com atendimento humano do primeiro recado até a transferência.",
      "Atendemos quem mora na ilha e quem cruza a Terceira Ponte ou a Segunda Ponte todo dia. Horário contínuo, das 8h às 23h, inclusive fim de semana — o estoque gira, então o caminho mais rápido é filtrar no site e chamar no WhatsApp.",
    ],
    bullets: [
      "Filtros de preço, ano e câmbio para achar o carro no ritmo da capital",
      "Vídeo e procedência antes de você sair de casa",
      "Troca e financiamento explicados sem enrolação",
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
      "Seminovos para Linhares e norte do ES, com procedência e atendimento online da Sua Garagem. Veja o estoque, peça vídeo no WhatsApp e feche sem viajar à toa.",
    lead: "De Linhares à capital são horas na BR-101. Por isso a Garagem mostra o seminovo no site e no WhatsApp antes de você sair — para quem está no Centro, no Araçá, no Interlagos ou no interior do município.",
    paragraphs: [
      "Linhares é polo do norte capixaba: Rio Doce, estrada, trabalho no campo e na indústria. A Sua Garagem atende essa distância no digital. Você vê ficha, quilometragem e fotos, pede vídeo e só combina o encontro quando o negócio estiver alinhado.",
      "O atendimento roda todos os dias, das 8h às 23h. Troca, financiamento e documentação entram na mesma conversa — sem pressão de balcão e sem inventar loja física na cidade.",
    ],
    bullets: [
      "Triagem completa no site para quem está longe da Grande Vitória",
      "Vídeo do veículo antes de qualquer deslocamento",
      "Avaliação do usado para venda ou troca",
      `WhatsApp ${PHONES[0].label} — resposta no horário estendido`,
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
      "Seminovos em Serra (ES) — Laranjeiras, Carapina, Barcelona e região. Estoque da Sua Garagem no site, vídeo no WhatsApp e atendimento online todos os dias, das 8h às 23h.",
    lead: "Serra é a cidade mais populosa do Espírito Santo. Quem vive em Laranjeiras, Barcelona, Carapina, Novo Horizonte ou no entorno do Civit escolhe o seminovo no site da Sua Garagem e fecha pelo WhatsApp, no fim do expediente.",
    paragraphs: [
      "Na Serra o dia a dia é deslocamento: BR-101, shopping, colégio e o corredor industrial. A Sua Garagem não pede que você perca uma tarde em showroom. O estoque está no site — com foto, ano, km e preço — e o consultor manda vídeo do carro pelo WhatsApp quando você pedir.",
      "Atendemos a Grande Vitória a partir do digital, todos os dias das 8h às 23h. Troca do usado, orientação de financiamento e documentação entram na mesma conversa. Sem ponto físico obrigatório: combinamos visita ou entrega só depois que a proposta estiver clara.",
    ],
    bullets: [
      "Estoque para filtrar à noite, depois do trânsito da Serra",
      "Vídeo e procedência antes de sair de Laranjeiras ou Carapina",
      "Avaliação para venda ou troca do seu usado",
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
      "Seminovos em Vila Velha (ES) — Praia da Costa, Itapoã e Centro. A Sua Garagem atende pelo site e WhatsApp, com procedência, troca e horário das 8h às 23h.",
    lead: "Vila Velha mistura praia, Centro Histórico e o vai-e-vem da Terceira Ponte. A Sua Garagem atende quem está na Praia da Costa, em Itapoã, no Ibes ou no Coqueiral de Itaparica com estoque no site e conversa no WhatsApp.",
    paragraphs: [
      "É a cidade mais antiga do Estado e uma das que mais se desloca para Vitória. Em vez de perder o sábado em loja, você compara seminovos no celular — preço à vista, câmbio, km — e pede o vídeo do carro que passou no filtro. A Sua Garagem responde todos os dias, das 8h às 23h.",
      "Compra, venda e troca entram no mesmo atendimento digital. Não inventamos showroom na orla: o combinado de visita ou entrega acontece só quando a proposta já estiver alinhada, com documentação acompanhada até a transferência.",
    ],
    bullets: [
      "Ficha e fotos para escolher entre um banho de mar e o expediente",
      "Vídeo do seminovo antes de cruzar a Terceira Ponte à toa",
      "Troca do usado e orientação de financiamento",
      `WhatsApp ${PHONES[0].label} · loja digital, atendimento humano`,
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
      "Seminovos em Guarapari (ES) — Muquiçaba, Praia do Morro e Centro. Estoque da Sua Garagem no site, vídeo no WhatsApp e atendimento online todos os dias, das 8h às 23h.",
    lead: "Guarapari mistura temporada, orla e o vai-e-vem da ES-060. A Sua Garagem atende quem está na Praia do Morro, em Meaípe, no Centro ou na Muquiçaba com estoque no site e conversa no WhatsApp.",
    paragraphs: [
      "Na alta temporada o trânsito da orla come o sábado. Em vez de sair às cegas, você compara seminovos no celular — preço, câmbio, km — e pede o vídeo do carro que passou no filtro. A Sua Garagem responde todos os dias, das 8h às 23h.",
      "Somos loja digital: não inventamos showroom na Praia do Morro. Compra, venda e troca entram na mesma conversa. Visita, entrega ou retirada só depois que a proposta estiver alinhada.",
    ],
    bullets: [
      "Ficha e fotos para escolher sem perder o fim de semana na orla",
      "Vídeo do seminovo antes de pegar a ES-060 à toa",
      "Avaliação do usado para venda ou troca",
      `WhatsApp ${PHONES[0].label} · loja digital, atendimento humano`,
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
      "Seminovos para Cachoeiro de Itapemirim e sul do ES. Veja o estoque da Sua Garagem no site, peça vídeo no WhatsApp e feche sem viajar à toa — atendimento das 8h às 23h.",
    lead: "De Cachoeiro à Grande Vitória são horas na BR-101. Por isso a Garagem mostra o seminovo no site e no WhatsApp antes de você sair — Centro, Independência, Recanto ou distrito.",
    paragraphs: [
      "Cachoeiro é polo do sul capixaba: mármore, comércio e estrada. A Sua Garagem atende essa distância no digital. Você vê ficha, quilometragem e fotos, pede vídeo e só combina o encontro quando o negócio estiver alinhado.",
      "O atendimento roda todos os dias, das 8h às 23h. Troca, financiamento e documentação entram na mesma conversa — sem inventar loja física na cidade e sem pressão de balcão.",
    ],
    bullets: [
      "Triagem completa no site para quem está no sul do Estado",
      "Vídeo do veículo antes de qualquer deslocamento longo",
      "Avaliação do usado para venda ou troca",
      `WhatsApp ${PHONES[0].label} — resposta no horário estendido`,
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
      "Seminovos para Colatina e noroeste do ES. Estoque da Sua Garagem no site, vídeo pelo WhatsApp e atendimento online todos os dias, das 8h às 23h.",
    lead: "Colatina concentra o noroeste capixaba. Quem está no Centro, no São Silvano, na Honório Fraga ou no entorno do Rio Doce escolhe o seminovo no site da Sua Garagem e fecha pelo WhatsApp.",
    paragraphs: [
      "A distância até a Grande Vitória pede triagem boa. A Sua Garagem deixa ficha, fotos e preço no site e manda vídeo do motor e do câmbio quando você pede — sem deslocamento cego.",
      "Atendemos todos os dias, das 8h às 23h. Troca do usado e orientação de documentação entram na mesma conversa. Sem ponto físico obrigatório: combinamos o encontro só depois que a proposta estiver clara.",
    ],
    bullets: [
      "Estoque para filtrar à noite, no ritmo de Colatina",
      "Vídeo e procedência antes de pegar a estrada",
      "Avaliação para venda ou troca do seu usado",
      `WhatsApp oficial ${PHONES[0].label}`,
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
      "Seminovos em Cariacica (ES) — Campo Grande, Porto de Santana e Itacibá. Estoque da Sua Garagem no site, WhatsApp das 8h às 23h, troca e orientação de financiamento.",
    lead: "Cariacica é corredor da Grande Vitória: Campo Grande, Flexal, Itacibá e o porto. A Sua Garagem deixa a escolha do seminovo no site e a conversa no WhatsApp, no fim do expediente.",
    paragraphs: [
      "O dia a dia aqui é deslocamento — BR-101, shopping, colégio. A Sua Garagem não pede que você perca uma tarde em showroom. O estoque está no site, com foto, ano, km e preço, e o consultor manda vídeo pelo WhatsApp.",
      "Atendemos a Grande Vitória a partir do digital, todos os dias das 8h às 23h. Troca, financiamento e documentação entram na mesma conversa. Combinamos visita ou entrega só depois que a proposta estiver clara.",
    ],
    bullets: [
      "Filtros de preço e câmbio para achar o carro depois do trânsito",
      "Vídeo antes de sair de Campo Grande ou do Porto de Santana",
      "Avaliação do usado para venda ou troca",
      `WhatsApp ${PHONES[0].label} · todos os dias, 8h–23h`,
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
      "Seminovos em Viana (ES) — Centro, Marcílio de Noronha e região. A Sua Garagem atende pelo site e WhatsApp, com procedência, troca e horário das 8h às 23h.",
    lead: "Viana fica no eixo da BR-262, entre Cariacica e o interior. Quem mora no Centro, em Marcílio de Noronha ou no Universal escolhe o seminovo no site da Sua Garagem e fecha pelo WhatsApp.",
    paragraphs: [
      "O município cresce no entorno da Grande Vitória e pede praticidade: comparar anúncio no celular, pedir vídeo e negociar sem furar o expediente. A Sua Garagem é loja digital, com atendimento humano do primeiro recado até a transferência.",
      "Compra, venda e troca entram no mesmo canal. Não inventamos ponto físico na cidade: visita ou entrega só quando a proposta já estiver alinhada — todos os dias, das 8h às 23h.",
    ],
    bullets: [
      "Estoque no site para triar sem deslocamento cego",
      "Vídeo do seminovo antes de pegar a BR-262",
      "Troca do usado e orientação de financiamento",
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
