import { site } from "@/lib/site";

export type FaqCategory =
  | "compra"
  | "troca"
  | "financiamento"
  | "documentacao"
  | "atendimento"
  | "loja";

export type FaqItem = {
  question: string;
  answer: string;
  category: FaqCategory;
};

export const FAQ_CATEGORIES: { id: FaqCategory | "todas"; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "compra", label: "Compra" },
  { id: "troca", label: "Troca" },
  { id: "financiamento", label: "Financiamento" },
  { id: "documentacao", label: "Documentação" },
  { id: "atendimento", label: "Atendimento" },
  { id: "loja", label: "Loja" },
];

export function faqItemId(question: string, index = 0) {
  const slug = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
  return `faq-${slug || index}`;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    category: "compra",
    question: "Como funciona a compra de um veículo na Garagem?",
    answer:
      "Você escolhe o veículo no site, chama no WhatsApp e a gente tira todas as dúvidas — com fotos extras, vídeo e detalhes do carro. Depois do aceite, cuidamos da documentação de transferência e combinamos a forma de pagamento. Somos loja digital, com atendimento humano do início ao fim.",
  },
  {
    category: "troca",
    question: "Vocês aceitam meu carro na troca?",
    answer:
      "Sim. Avaliamos seu usado e o valor entra como parte do pagamento. Para agilizar, preencha o formulário da página Vender/Trocar com marca, modelo, ano e quilometragem — a avaliação inicial sai pelo WhatsApp e a final é feita com o carro presente, no momento combinado.",
  },
  {
    category: "financiamento",
    question: "Trabalham com financiamento?",
    answer:
      "Sim, com bancos e financeiras parceiras. A aprovação e as taxas dependem da análise de crédito de cada instituição, então as condições são passadas caso a caso pelo WhatsApp. Também aceitamos pagamento à vista e entrada mais parcelas.",
  },
  {
    category: "compra",
    question: "Os veículos passam por vistoria?",
    answer:
      "Todo veículo do estoque passa por checagem de procedência, conferência de quilometragem e avaliação mecânica antes de ser anunciado. Se algo relevante for identificado, isso é informado antes da negociação.",
  },
  {
    category: "loja",
    question: "Vocês têm loja física?",
    answer:
      "No momento somos loja digital: o estoque está no site e o atendimento é online, todos os dias das 8h às 23h. Combinamos visita ao veículo, entrega ou retirada conforme a necessidade de cada cliente em Vitória, Linhares e região.",
  },
  {
    category: "atendimento",
    question: "Podem me mandar mais fotos ou um vídeo do carro?",
    answer:
      "Sim. Na página de cada veículo existe o botão “Pedir vídeo”, que já abre o WhatsApp com o modelo escolhido. Gravamos o vídeo mostrando os detalhes que você pedir.",
  },
  {
    category: "atendimento",
    question: "Qual o horário de atendimento?",
    answer:
      "Atendemos online todos os dias, das 8h às 23h — inclusive finais de semana e feriados — pelo WhatsApp, telefone e e-mail.",
  },
  {
    category: "compra",
    question: "Os preços do site estão sempre atualizados?",
    answer:
      "O site é atualizado pela própria loja, mas valores e disponibilidade podem mudar ao longo do dia — principalmente em veículos com muita procura. Confirme sempre pelo WhatsApp antes de fechar.",
  },
  {
    category: "documentacao",
    question: "Como funciona a transferência de documentação?",
    answer:
      "A Garagem cuida do processo de transferência junto ao Detran. Os prazos e custos variam conforme o município e a forma de pagamento, e são informados antes do fechamento do negócio.",
  },
  {
    category: "loja",
    question: "Vocês atendem outras cidades do Espírito Santo?",
    answer: `Sim. Atendemos clientes de todo o ${site.state}, com foco em ${site.region} e região, e organizamos a entrega ou a retirada conforme a localidade. Fale com a gente que combinamos a melhor forma.`,
  },
];
