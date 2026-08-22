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

export function isFaqAnswerReady(answer: string) {
  return !answer.includes("PREENCHER");
}

const FAQ_CATEGORY_IDS = new Set<FaqCategory>(
  FAQ_CATEGORIES.filter((item): item is { id: FaqCategory; label: string } => item.id !== "todas").map(
    (item) => item.id,
  ),
);

export function isFaqCategory(value: unknown): value is FaqCategory {
  return typeof value === "string" && FAQ_CATEGORY_IDS.has(value as FaqCategory);
}

/** Interpreta o JSON salvo no painel. Array vazio/inválido = null (usa o texto-base). */
export function parseFaqItems(raw: unknown): FaqItem[] | null {
  if (!Array.isArray(raw)) return null;

  const items: FaqItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const question = typeof row.question === "string" ? row.question.trim() : "";
    const answer = typeof row.answer === "string" ? row.answer.trim() : "";
    if (!question) continue;
    items.push({
      question: question.slice(0, 180),
      answer: answer.slice(0, 2000),
      category: isFaqCategory(row.category) ? row.category : "compra",
    });
  }

  return items.length > 0 ? items : null;
}

/**
 * Ordem do array = ordem de exibição (home usa os primeiros prontos).
 * Respostas com PREENCHER não entram no site até você trocar o texto.
 */
export const FAQ_ITEMS: FaqItem[] = [
  {
    category: "compra",
    question: "Como funciona a compra de um veículo na Garagem?",
    answer:
      "Você escolhe o veículo no site, chama no WhatsApp e a gente tira as dúvidas — com fotos extras, vídeo e detalhes do carro. Depois do aceite, alinhamos pagamento e os próximos passos da documentação. Somos loja digital, com atendimento humano do início ao fim.",
  },
  {
    category: "troca",
    question: "Posso dar meu carro na troca?",
    answer:
      "Sim. Avaliamos seu usado e o valor entra como parte do pagamento. Para agilizar, preencha o formulário da página Vender/Trocar com marca, modelo, ano e quilometragem — a avaliação inicial sai pelo WhatsApp.",
  },
  {
    category: "financiamento",
    question: "Trabalham com financiamento?",
    answer:
      "Sim, com bancos e financeiras parceiras. Aprovação e taxas dependem da análise de crédito de cada instituição, então as condições são passadas caso a caso pelo WhatsApp. Também aceitamos pagamento à vista.",
  },
  {
    category: "loja",
    question: "Vocês têm loja física?",
    answer:
      "Não: somos loja digital. O estoque está no site e o atendimento é online, todos os dias das 8h às 23h. Combinamos visita ao veículo, entrega ou retirada pelo WhatsApp, em Aracruz, Vitória, Linhares e região.",
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
      "O site é atualizado pela própria loja, mas valores e disponibilidade podem mudar ao longo do dia. Confirme sempre pelo WhatsApp antes de fechar.",
  },
  {
    category: "loja",
    question: "Vocês atendem outras cidades do Espírito Santo?",
    answer: `Sim. Atendemos clientes de todo o ${site.state}, com foco em ${site.region} e região. Fale com a gente que combinamos a melhor forma de ver o veículo, entregar ou retirar.`,
  },
  {
    category: "compra",
    question: "Como funciona a garantia?",
    answer:
      "PREENCHER: resposta real da loja — prazo, cobertura e se a garantia varia por veículo",
  },
  {
    category: "documentacao",
    question: "Quais documentos preciso levar para fechar?",
    answer:
      "PREENCHER: resposta real da loja — documentos do comprador e do veículo na transferência",
  },
  {
    category: "compra",
    question: "O carro já passou por vistoria?",
    answer:
      "PREENCHER: resposta real da loja — o que é checado antes do anúncio e se há laudo/cautelar",
  },
  {
    category: "documentacao",
    question: "Como funciona a transferência de documentação?",
    answer:
      "PREENCHER: resposta real da loja — quem cuida do Detran, prazos e se há custo à parte",
  },
];

/** Itens que podem ir ao site/JSON-LD — respostas PREENCHER ficam só no arquivo. */
export function publishedFaqItems(items: FaqItem[] = FAQ_ITEMS) {
  return items.filter((item) => isFaqAnswerReady(item.answer));
}
