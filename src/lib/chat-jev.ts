/**
 * Leitura do visitante pelo Jev: intenção (financiar, trocar, ver o carro…) e
 * temperatura (quente/morno/frio). Serve para o assistente conduzir a conversa
 * e para o lead chegar ao Lucas com uma nota curta.
 *
 * O Jev recebe só o texto das mensagens (sem nome, telefone, e-mail ou CPF) e o
 * veículo em tela (marca, modelo e ano; sem preço e sem cidade). A leitura nunca
 * vai para o cliente: não entra na resposta da API nem no texto do wa.me.
 */
import { isChatPing, sanitizeSensitiveText } from "@/lib/chat-guard";
import {
  askJev,
  jevChoice,
  jevScore,
  type JevAnswers,
  type JevQuestion,
} from "@/lib/jev";

export const CHAT_INTENTS = ["financiar", "trocar", "visitar", "preco", "curioso"] as const;
export type ChatIntent = (typeof CHAT_INTENTS)[number];
export type ChatHeat = "quente" | "morno" | "frio";

export type ChatReading = {
  intent: ChatIntent | null;
  heat: ChatHeat | null;
};

/** Espera máxima pela leitura antes de gerar a resposta (o Jev leva ~0,2 s). */
export const CHAT_READING_STEER_WAIT_MS = 350;
/** Espera máxima na hora de gravar o lead; o Gemini já terminou até lá. */
export const CHAT_READING_LEAD_WAIT_MS = 1_200;
/** Abaixo disso a resposta do Jev não vira rótulo. */
const MIN_CONFIDENCE = 0.5;
const STATE_TURNS = 6;

const HEAT_LEVELS = [
  "frio: só pesquisando, sem pressa",
  "morno: tem interesse, mas ainda compara ou falta decidir",
  "quente: quer fechar, ver o carro, financiar ou falar com o consultor",
];

/** A leitura do chat não pode atrasar a resposta: prazo menor que o do admin. */
export const CHAT_READING_TIMEOUT_MS = 2_500;

export const CHAT_READING_QUESTIONS: Record<string, JevQuestion> = {
  temperatura: {
    type: "score",
    instructions:
      "Quão perto este visitante de uma loja de seminovos está de fechar a compra? Escolha o nível que melhor descreve a conversa.",
    criteria: HEAT_LEVELS,
  },
  intencao: {
    type: "choice",
    instructions:
      "Qual é a principal intenção do visitante agora, pelo que ele escreveu por último?",
    criteria: {
      financiar: "Quer financiar ou parcelar o veículo",
      trocar: "Quer dar o veículo atual na troca",
      visitar: "Quer ver o veículo ou combinar uma visita",
      preco: "Tem dúvida ou quer negociar o preço",
      curioso: "Só pesquisando, sem intenção clara",
    },
  },
};

const INTENT_NOTE: Record<ChatIntent, string> = {
  financiar: "quer financiar",
  trocar: "quer dar o carro na troca",
  visitar: "quer ver o carro",
  preco: "dúvida de preço",
  curioso: "só pesquisando",
};

const HEAT_NOTE: Record<ChatHeat, string> = {
  quente: "Quente",
  morno: "Morno",
  frio: "Frio",
};

/** "Quente · quer financiar". Vazio quando não há leitura confiável. */
export function formatReadingNote(reading: ChatReading | null | undefined) {
  if (!reading) return "";
  return [
    reading.heat ? HEAT_NOTE[reading.heat] : null,
    reading.intent ? INTENT_NOTE[reading.intent] : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Notas do lead: a leitura na primeira linha, depois o resumo do assistente. */
export function composeLeadNotes(message: string, reading: ChatReading | null | undefined) {
  const note = formatReadingNote(reading);
  const lines = [note ? `Leitura: ${note}` : "", message.trim()].filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

const INTENT_GUIDE: Record<ChatIntent, string> = {
  financiar:
    "quer financiar. Se ainda não disse, pergunte UMA coisa: o valor de entrada ou se tem veículo na troca. Não calcule parcela nem invente banco; o consultor monta a simulação no WhatsApp.",
  trocar:
    "quer dar um veículo na troca. Se ainda não disse, pergunte UMA coisa: modelo e ano do que ele tem. A avaliação é com o consultor no WhatsApp.",
  visitar:
    "quer ver o carro. Leve para combinar com o consultor no WhatsApp (visita, entrega ou vídeo). Não invente endereço, dia nem horário.",
  preco:
    "tem dúvida de preço. Use só o preço do anúncio, sem prometer desconto; a negociação é com o consultor no WhatsApp.",
  curioso:
    "está só pesquisando. Seja leve e ajude a comparar; não empurre o WhatsApp nem peça nome e telefone.",
};

/** Instrução interna para o prompt. Só texto fixo, nunca texto vindo do Jev. */
export function chatReadingHint(reading: ChatReading | null | undefined) {
  if (!reading || (!reading.intent && !reading.heat)) return "";
  const lines = [
    "LEITURA INTERNA DO VISITANTE (use para conduzir a conversa; nunca cite esta leitura, rótulos nem “temperatura” ao visitante):",
  ];
  if (reading.intent) lines.push(`- Intenção: ${INTENT_GUIDE[reading.intent]}`);
  if (reading.heat === "quente")
    lines.push(
      "- Está perto de decidir: facilite o próximo passo com o consultor, sem pressão nem urgência falsa.",
    );
  if (reading.heat === "frio")
    lines.push("- Ainda frio: não peça nome nem telefone agora.");
  return `\n\n${lines.join("\n")}`;
}

/** Interpreta as respostas do Jev. Qualquer coisa fora do esperado vira `null`. */
export function parseChatReading(answers: JevAnswers | null): ChatReading | null {
  if (!answers) return null;
  const heatAnswer = jevScore(answers, "temperatura", HEAT_LEVELS.length);
  const intentAnswer = jevChoice(answers, "intencao", CHAT_INTENTS);
  let heat: ChatHeat | null = null;
  if (heatAnswer && heatAnswer.confidence >= MIN_CONFIDENCE) {
    heat = heatAnswer.value >= 0.75 ? "quente" : heatAnswer.value >= 0.25 ? "morno" : "frio";
  }
  const intent =
    intentAnswer && intentAnswer.confidence >= MIN_CONFIDENCE ? intentAnswer.choice : null;
  return heat || intent ? { intent, heat } : null;
}

/** Tira telefone, e-mail e documentos do texto antes de sair para o Jev. */
export function redactForJev(text: string, max: number) {
  return sanitizeSensitiveText(text)
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[e-mail]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, (run) =>
      run.replace(/\D/g, "").length >= 8 ? "[número]" : run,
    )
    .slice(0, max);
}

export type ChatReadingState = {
  veiculo_na_tela: string | null;
  conversa: Array<{ de: "visitante" | "assistente"; texto: string }>;
};

/** Estado compacto: veículo em tela e as últimas mensagens, sem dado pessoal. */
export function buildReadingState(input: {
  mensagem: string;
  historico: Array<{ role: "user" | "assistant"; content: string }>;
  vehicle?: { brand: string; model: string; yearModel: number } | null;
}): ChatReadingState {
  const turns = [...input.historico, { role: "user" as const, content: input.mensagem }]
    .slice(-STATE_TURNS)
    .map((turn) =>
      turn.role === "user"
        ? { de: "visitante" as const, texto: redactForJev(turn.content, 300) }
        : { de: "assistente" as const, texto: redactForJev(turn.content, 160) },
    )
    .filter((turn) => turn.texto);
  const vehicle = input.vehicle;
  return {
    veiculo_na_tela: vehicle
      ? `${vehicle.brand} ${vehicle.model} ${vehicle.yearModel}`
      : null,
    conversa: turns,
  };
}

/** Pings e agradecimentos não mudam a leitura: poupa a chamada. */
export function shouldReadChat(mensagem: string) {
  const text = mensagem.trim();
  return text.length >= 3 && !isChatPing(text);
}

export type ReadChatIntent = typeof readChatIntent;

/** Uma chamada por rodada, as duas perguntas no mesmo pedido. Nunca lança. */
export async function readChatIntent(input: {
  mensagem: string;
  historico: Array<{ role: "user" | "assistant"; content: string }>;
  vehicle?: { brand: string; model: string; yearModel: number } | null;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  apiKey?: string;
}): Promise<ChatReading | null> {
  try {
    if (!shouldReadChat(input.mensagem)) return null;
    const answers = await askJev(buildReadingState(input), CHAT_READING_QUESTIONS, {
      signal: input.signal,
      fetchImpl: input.fetcher,
      apiKey: input.apiKey,
      timeoutMs: CHAT_READING_TIMEOUT_MS,
    });
    return parseChatReading(answers);
  } catch {
    return null;
  }
}

/** Espera a leitura por no máximo `ms`; passado disso a conversa segue sem ela. */
export async function readingWithin(
  reading: Promise<ChatReading | null>,
  ms: number,
): Promise<ChatReading | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reading.catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
