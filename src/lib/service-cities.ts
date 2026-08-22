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
      "Seminovos com procedência para quem vive em Aracruz e no litoral norte do ES. Estoque no site, vídeo pelo WhatsApp e atendimento online da Garagem, todos os dias das 8h às 23h.",
    lead: "Quem está em Aracruz — no Centro, no Coqueiral, na Barra do Riacho ou no entorno do polo industrial — escolhe o seminovo no site e fecha pelo WhatsApp, sem precisar ir à capital só para ver ficha.",
    paragraphs: [
      "Aracruz concentra rotina de trabalho, escola e deslocamento no litoral norte. A Garagem atende esse ritmo no digital: estoque atualizado, fotos e ficha no anúncio, vídeo do carro quando você pede e conversa direta no WhatsApp até a documentação.",
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
        question: "A Garagem atende quem está em Aracruz?",
        answer:
          "Sim. Atendemos Aracruz e o litoral norte por WhatsApp e telefone: avaliação, fotos, vídeos e orientação de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Preciso ir a Vitória para ver o carro?",
        answer:
          "Não para começar. Você escolhe no estoque, recebe detalhes e vídeo e só combina visita ou entrega quando a proposta já fizer sentido.",
      },
      {
        question: "Posso dar meu carro na troca?",
        answer:
          "Pode. Envie os dados pela página Vender/Trocar ou pelo WhatsApp para uma avaliação sem compromisso.",
      },
    ],
  },
  {
    slug: "vitoria",
    name: "Vitória",
    metaDescription:
      "Seminovos em Vitória (ES) com procedência verificada. A Garagem atende a capital no digital: estoque no site, WhatsApp das 8h às 23h, troca e orientação de financiamento.",
    lead: "Em Vitória o tempo some entre trabalho, ponte e trânsito. A Garagem deixa a escolha do seminovo no site e a conversa no WhatsApp — para quem está na Praia do Canto, Jardim da Penha, Enseada ou Camburi.",
    paragraphs: [
      "A capital pede praticidade: você compara anúncios no celular, pede o vídeo do motor e do câmbio e negocia sem furar o expediente. A Garagem é loja digital, com atendimento humano do primeiro recado até a transferência.",
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
        question: "A Garagem atende quem está em Vitória?",
        answer:
          "Sim. Atendemos a capital e a Grande Vitória por WhatsApp e telefone, com fotos, vídeos e orientação de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Como funciona a compra de um seminovo à distância?",
        answer:
          "Você escolhe no estoque, tira dúvidas pelo WhatsApp, recebe detalhes e vídeos do veículo e avança na proposta com transparência. A transferência é acompanhada pela equipe.",
      },
      {
        question: "Posso dar meu carro na troca?",
        answer:
          "Pode. Envie os dados do seu veículo pela página Vender/Trocar ou pelo WhatsApp para uma avaliação sem compromisso.",
      },
    ],
  },
  {
    slug: "linhares",
    name: "Linhares",
    metaDescription:
      "Seminovos para Linhares e norte do ES, com procedência e atendimento online da Garagem. Veja o estoque, peça vídeo no WhatsApp e feche sem viajar à toa.",
    lead: "De Linhares à capital são horas na BR-101. Por isso a Garagem mostra o seminovo no site e no WhatsApp antes de você sair — para quem está no Centro, no Araçá, no Interlagos ou no interior do município.",
    paragraphs: [
      "Linhares é polo do norte capixaba: Rio Doce, estrada, trabalho no campo e na indústria. A Garagem atende essa distância no digital. Você vê ficha, quilometragem e fotos, pede vídeo e só combina o encontro quando o negócio estiver alinhado.",
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
        question: "A Garagem atende quem está em Linhares?",
        answer:
          "Sim. Atendemos Linhares e o norte do ES por WhatsApp e telefone: fotos, vídeos e orientação de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Consigo resolver quase tudo sem ir à loja?",
        answer:
          "A Garagem é loja digital. A escolha, as dúvidas e a proposta acontecem no site e no WhatsApp. Visita, entrega ou retirada só entram quando vocês combinam.",
      },
      {
        question: "Posso dar meu carro na troca?",
        answer:
          "Pode. Envie os dados pela página Vender/Trocar ou pelo WhatsApp para uma avaliação sem compromisso.",
      },
    ],
  },
  {
    slug: "serra",
    name: "Serra",
    metaDescription:
      "Seminovos em Serra (ES) — Laranjeiras, Carapina, Barcelona e região. Estoque da Garagem no site, vídeo no WhatsApp e atendimento online todos os dias, das 8h às 23h.",
    lead: "Serra é a cidade mais populosa do Espírito Santo. Quem vive em Laranjeiras, Barcelona, Carapina, Novo Horizonte ou no entorno do Civit escolhe o seminovo no site da Garagem e fecha pelo WhatsApp, no fim do expediente.",
    paragraphs: [
      "Na Serra o dia a dia é deslocamento: BR-101, shopping, colégio e o corredor industrial. A Garagem não pede que você perca uma tarde em showroom. O estoque está no site — com foto, ano, km e preço — e o consultor manda vídeo do carro pelo WhatsApp quando você pedir.",
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
        question: "A Garagem atende quem mora na Serra?",
        answer:
          "Sim. Atendemos Serra e a Grande Vitória por WhatsApp e telefone. Você vê o estoque no site, pede vídeo e tira dúvida de documentação — online, todos os dias das 8h às 23h.",
      },
      {
        question: "Tem loja física na Serra?",
        answer:
          "Não. A Garagem é loja digital. A vitrine é o site e o atendimento é no WhatsApp. Combinamos visita ao veículo, entrega ou retirada quando o negócio avançar.",
      },
      {
        question: "Consigo dar o carro na troca morando na Serra?",
        answer:
          "Sim. Envie marca, ano, km e fotos pela página Vender/Trocar ou pelo WhatsApp. A avaliação é sem compromisso.",
      },
    ],
  },
  {
    slug: "vila-velha",
    name: "Vila Velha",
    metaDescription:
      "Seminovos em Vila Velha (ES) — Praia da Costa, Itapoã e Centro. A Garagem atende pelo site e WhatsApp, com procedência, troca e horário das 8h às 23h.",
    lead: "Vila Velha mistura praia, Centro Histórico e o vai-e-vem da Terceira Ponte. A Garagem atende quem está na Praia da Costa, em Itapoã, no Ibes ou no Coqueiral de Itaparica com estoque no site e conversa no WhatsApp.",
    paragraphs: [
      "É a cidade mais antiga do Estado e uma das que mais se desloca para Vitória. Em vez de perder o sábado em loja, você compara seminovos no celular — preço à vista, câmbio, km — e pede o vídeo do carro que passou no filtro. A Garagem responde todos os dias, das 8h às 23h.",
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
        question: "A Garagem atende Vila Velha?",
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
] as const satisfies readonly ServiceCity[];

export type ServiceCitySlug = (typeof SERVICE_CITIES)[number]["slug"];

export function getServiceCity(slug: string) {
  return SERVICE_CITIES.find((city) => city.slug === slug) ?? null;
}

export function otherServiceCities(slug: string) {
  return SERVICE_CITIES.filter((city) => city.slug !== slug);
}
