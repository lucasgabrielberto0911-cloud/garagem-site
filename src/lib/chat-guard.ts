import {
  CHAT_OFF_SCOPE_REPEAT_REPLY,
  CHAT_OFF_SCOPE_REPLY,
} from "@/lib/chat-prompt";
import type { ChatTurn } from "@/lib/chat-gemini";

/** Depois do fold (minúsculas, sem acento). Palavras da loja / estoque / lead. */
const GARAGE_HINT =
  /\b(carro|carros|moto|veiculo|estoque|seminovo|comprar|compra|vender|vende|vendem|troca|financi\w*|parcela|juros|cartao|credito|pix|vista|18x|60x|garantia|horario|atendimento|whatsapp|garagem|loja|endereco|localizacao|entrega|visita|video|documento|hb20|onix|civic|corolla|palio|prisma|kwid|mobi|argo|polo|creta|compass|renegade|hilux|s10|amarok|ranger|honda|fiat|hyundai|chevrolet|toyota|volkswagen|vw|nissan|ford|jeep|porsche|km|preco|valor|tem|modelo|marca|anunciar|blindad\w*|disponivel|anuncio|consultor|vendedor|telefone|celular|contato|nome)\b/;

const OFF_SCOPE_HINT =
  /\b(codigo|javascript|python|html|licao de casa|redacao|poema|receita|piada|traduz|escreva (um|uma|o|a) (texto|codigo|ensaio|historia)|modo desenvolvedor|developer mode|jailbreak|ignore (as )?instrucoes|ignore previous|aja como|act as|system prompt|prompt de sistema)\b/;

const JAILBREAK_HINT =
  /\b(ignore (as )?instrucoes|ignore previous|ignore all previous|aja como|act as|modo desenvolvedor|developer mode|dan mode|revela(r)? (o |seu )?prompt|system prompt|prompt de sistema|instrucoes (secretas|internas|deste prompt))\b/;

const PING_ONLY =
  /^(oi+|ola|eae+|e ai|eai+|falae|falai|salve|blz|beleza|tmj|suave|de boa|bom dia|boa tarde|boa noite|opa|fala|hey|hi|hello|obrigado|obrigada|valeu|ok|sim|nao|tudo bem|td bem|teste|test|ping)[\s!.?]*$/;

const REDIRECT_HINT =
  /assuntos da garagem|so posso ajudar|chama no whatsapp pra outros/;

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isJailbreakAttempt(message: string) {
  return JAILBREAK_HINT.test(fold(message));
}

export function isChatPing(message: string) {
  return PING_ONLY.test(fold(message).trim());
}

export function looksLikeOffScopeRedirect(text: string) {
  return REDIRECT_HINT.test(fold(text));
}

export function isOffScopeMessage(message: string) {
  const text = fold(message).trim();
  if (!text) return false;
  if (isChatPing(text)) return false;
  if (isJailbreakAttempt(text)) return true;
  return OFF_SCOPE_HINT.test(text) && !GARAGE_HINT.test(text);
}

export function previousOffScopeRedirects(history: ChatTurn[]) {
  return history.filter(
    (turn) => turn.role === "assistant" && REDIRECT_HINT.test(fold(turn.content)),
  ).length;
}

/** Primeiro desvio: redireciona. Dois ou mais depois do redirect: mensagem curta, sem Gemini. */
export function offScopeReply(history: ChatTurn[]) {
  return previousOffScopeRedirects(history) >= 1
    ? CHAT_OFF_SCOPE_REPEAT_REPLY
    : CHAT_OFF_SCOPE_REPLY;
}

export function sanitizeSensitiveText(value: string) {
  return value
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "")
    .replace(/\b(?:cpf|rg|cnpj)\b[:\s-]*[\d.\-\/]*/gi, "")
    .replace(/\b(?:agencia|ag[eê]ncia)\b[:\s-]*\S*/gi, "")
    .replace(/\b(?:conta corrente|conta banc[aá]ria)\b[:\s-]*\S*/gi, "")
    .replace(/\b(?:pix|iban|cvv|senha)\b[:\s-]*\S*/gi, "")
    .replace(/\b(?:cart[aã]o|cartao)\b[:\s-]*\d[\d\s.-]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
