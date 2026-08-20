/**
 * Exemplos para a home enquanto o painel não tiver depoimentos publicados.
 *
 * TROCAR POR REAIS: edite no Painel → Depoimentos (ordem, nota, veículo).
 * A ordem do array (e o campo `order` no painel) é a ordem de exibição.
 * Dá para inserir um item no meio da lista sem quebrar nada.
 */
export type SeedTestimonial = {
  name: string;
  city: string;
  message: string;
  rating: 1 | 2 | 3 | 4 | 5;
  vehicleLabel?: string;
  order: number;
};

export const SEED_TESTIMONIALS: SeedTestimonial[] = [
  {
    name: "Camila R.",
    city: "Aracruz, ES",
    vehicleLabel: "Onix 2021",
    rating: 5,
    order: 0,
    message:
      "Chamei no WhatsApp numa terça de noite e ainda me atenderam. Pedi vídeo do Onix, vi o painel, os pneus, o porta-malas. Fechei sem aquela pressa de loja. Documentação eles foram acompanhando comigo.",
  },
  {
    name: "Eduardo P.",
    city: "Serra, ES",
    vehicleLabel: "Creta 2022",
    rating: 5,
    order: 1,
    message:
      "Eu sou chato com km e histórico. Mandaram tudo que pedi, sem enrolar. A Creta estava como no anúncio — isso pra mim vale mais que discurso bonito.",
  },
  {
    name: "Patrícia e João",
    city: "Linhares, ES",
    vehicleLabel: "T-Cross 2020",
    rating: 5,
    order: 2,
    message:
      "A gente trabalhava o dia inteiro e só conseguia ver carro à noite. Atendimento até 23h salvou. Trocamos nosso usado e a proposta veio no WhatsApp, sem teatro.",
  },
  {
    name: "Rafael M.",
    city: "Vitória, ES",
    vehicleLabel: "Honda CG 160",
    rating: 4,
    order: 3,
    message:
      "Comprei a moto pelo site. Única ressalva: demorei um pouco pra alinhar a retirada. Fora isso, moto em ordem e conversa franca no zap. Indicaria.",
  },
  {
    name: "Vanessa L.",
    city: "Vila Velha, ES",
    vehicleLabel: "Compass 2019",
    rating: 5,
    order: 4,
    message:
      "Primeira vez comprando seminovo sem ir numa loja física. Estranhei no começo. Depois do vídeo e das fotos de baixo do carro, fui. Transferência não virou dor de cabeça.",
  },
  {
    name: "Thiago N.",
    city: "Colatina, ES",
    rating: 5,
    order: 5,
    message:
      "Não fechei carro ainda — avaliei o meu pra troca. Resposta rápida e sem aquele papo de “te retorno amanhã”. Já deixa mais confiança pra quando for comprar.",
  },
];
