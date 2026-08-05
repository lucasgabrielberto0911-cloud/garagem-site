import { site } from "@/lib/site";

export type FaqItem = { question: string; answer: string };

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Como funciona a compra de um veículo na Garagem?",
    answer:
      "Você escolhe o veículo no site, chama no WhatsApp e a gente separa o carro para você ver de perto. Depois do aceite, cuidamos de toda a documentação de transferência e combinamos a forma de pagamento.",
  },
  {
    question: "Vocês aceitam meu carro na troca?",
    answer:
      "Sim. Avaliamos seu usado e o valor entra como parte do pagamento. Para agilizar, preencha o formulário da página Vender/Trocar com marca, modelo, ano e quilometragem — a avaliação inicial sai pelo WhatsApp e a final é feita na loja, com o carro presente.",
  },
  {
    question: "Trabalham com financiamento?",
    answer:
      "Sim, com bancos e financeiras parceiras. A aprovação e as taxas dependem da análise de crédito de cada instituição, então as condições são passadas caso a caso pelo WhatsApp. Também aceitamos pagamento à vista e entrada mais parcelas.",
  },
  {
    question: "Os veículos passam por vistoria?",
    answer:
      "Todo veículo do estoque passa por checagem de procedência, conferência de quilometragem e vistoria mecânica antes de ser anunciado. Se algo relevante for identificado, isso é informado antes da negociação.",
  },
  {
    question: "Posso agendar uma visita ou test drive?",
    answer:
      "Pode e recomendamos. Chame no WhatsApp, escolha o dia e o horário, e deixamos o veículo separado e pronto para você conhecer sem correria.",
  },
  {
    question: "Podem me mandar mais fotos ou um vídeo do carro?",
    answer:
      "Sim. Na página de cada veículo existe o botão “Pedir vídeo”, que já abre o WhatsApp com o modelo escolhido. Gravamos o vídeo mostrando os detalhes que você pedir.",
  },
  {
    question: "Os preços do site estão sempre atualizados?",
    answer:
      "O site é atualizado pela própria loja, mas valores e disponibilidade podem mudar ao longo do dia — principalmente em veículos com muita procura. Confirme sempre pelo WhatsApp antes de fechar.",
  },
  {
    question: "Como funciona a transferência de documentação?",
    answer:
      "A Garagem cuida do processo de transferência junto ao Detran. Os prazos e custos variam conforme o município e a forma de pagamento, e são informados antes do fechamento do negócio.",
  },
  {
    question: "Vocês atendem outras cidades do Espírito Santo?",
    answer: `Sim. Atendemos clientes de todo o ${site.state} e organizamos a entrega ou a retirada conforme a região. Fale com a gente que combinamos a melhor forma.`,
  },
];
