import { leadFirstName, whatsappUrl } from "./leads";

/** Mensagens prontas do vendedor. Nunca citam preço: o carro pode já estar vendido. */
type LeadTemplateInput = {
  name: string;
  phone: string;
  vehicleInfo?: string | null;
  source?: string | null;
};

type Template = {
  id: string;
  label: string;
  hint: string;
  /** "estoque" = interesse em comprar; "avaliacao" = lead que quer vender o próprio carro. */
  scope: "estoque" | "avaliacao";
  text: (firstName: string, car: string) => string;
};

const TEMPLATES: Template[] = [
  {
    id: "disponivel",
    label: "Carro ainda disponível",
    hint: "Confirma e convida para a visita",
    scope: "estoque",
    text: (nome, car) =>
      `Olá, ${nome}! Aqui é da Garagem. O ${car} ainda está disponível. Quer agendar uma visita para ver de perto?`,
  },
  {
    id: "fotos",
    label: "Enviei as fotos",
    hint: "Depois de mandar fotos e vídeo",
    scope: "estoque",
    text: (nome, car) =>
      `${nome}, enviei as fotos e os detalhes do ${car}. Qualquer dúvida é só me chamar por aqui.`,
  },
  {
    id: "visita",
    label: "Confirmar visita",
    hint: "Lembrete do horário combinado",
    scope: "estoque",
    text: (nome, car) =>
      `Olá, ${nome}! Passando para confirmar sua visita para ver o ${car}. Está tudo certo para o horário combinado?`,
  },
  {
    id: "retorno",
    label: "Retomar contato",
    hint: "Cliente que parou de responder",
    scope: "estoque",
    text: (nome, car) =>
      `Olá, ${nome}! Aqui é da Garagem. Passando para saber se você ainda tem interesse no ${car}. Se preferir, posso te mostrar outras opções do estoque.`,
  },
  {
    id: "financiamento",
    label: "Simulação de financiamento",
    hint: "Pede entrada e prazo",
    scope: "estoque",
    text: (nome, car) =>
      `Olá, ${nome}! Posso fazer uma simulação de financiamento do ${car}. Me diga a entrada e o prazo que você pensa em usar. A aprovação final depende da análise.`,
  },
  {
    id: "troca",
    label: "Troca com avaliação do usado",
    hint: "Pede fotos, ano e km do carro dele",
    scope: "estoque",
    text: (nome, car) =>
      `Olá, ${nome}! Se você quiser o ${car}, também podemos avaliar o seu usado e montar uma proposta de troca. Me mande fotos, ano, quilometragem e as principais pendências para eu fazer uma primeira avaliação.`,
  },
  {
    id: "vendido",
    label: "Carro vendido, oferecer outros",
    hint: "Mantém o cliente no funil",
    scope: "estoque",
    text: (nome, car) =>
      `Olá, ${nome}! Aqui é da Garagem. O ${car} foi vendido. Como você se interessou, quer que eu procure outras opções parecidas para te enviar?`,
  },
  {
    id: "obrigado",
    label: "Agradecer a visita",
    hint: "Depois que o cliente passou na loja",
    scope: "estoque",
    text: (nome, car) =>
      `Obrigado pela visita, ${nome}! Foi bom te conhecer. Se ficou alguma dúvida sobre o ${car}, estou à disposição.`,
  },
  {
    id: "avaliacao-dados",
    label: "Pedir dados e fotos do usado",
    hint: "Para montar a avaliação",
    scope: "avaliacao",
    text: (nome, car) =>
      `Olá, ${nome}! Aqui é da Garagem. Para avaliar o seu ${car}, me envie a placa, a quilometragem e algumas fotos (frente, traseira, laterais e interior).`,
  },
  {
    id: "avaliacao-visita",
    label: "Convidar para avaliação",
    hint: "Avaliação presencial na loja",
    scope: "avaliacao",
    text: (nome, car) =>
      `${nome}, para fechar a avaliação do seu ${car} preciso ver o carro de perto. Quando você consegue passar na Garagem?`,
  },
];

export function leadWhatsAppTemplates(lead: LeadTemplateInput) {
  const firstName = leadFirstName(lead.name);
  const wantsToSell = lead.source === "vender";
  const info = lead.vehicleInfo?.trim();
  const car = info || (wantsToSell ? "carro" : "carro que você viu");
  return TEMPLATES.filter((t) => (t.scope === "avaliacao") === wantsToSell).map(
    ({ id, label, hint, text }) => ({
      id,
      label,
      hint,
      href: whatsappUrl(lead.phone, text(firstName, car)),
    }),
  );
}
