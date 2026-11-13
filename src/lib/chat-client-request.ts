import { CHAT_FALLBACK_REPLY } from "@/lib/chat-prompt";
import {
  drainSseBuffer,
  finalChatStreamReply,
  parseSseChunks,
  readChatStreamFrame,
} from "@/lib/chat-stream";

export type ChatReplyPayload = {
  reply?: string;
  vehicles?: unknown;
  stockHref?: unknown;
  leadCreated?: unknown;
  research?: unknown;
};

export class ChatRequestError extends Error {}

/** A partial stream is not a completed answer, especially after a lead action. */
export async function requestChatReply(
  body: Record<string, unknown>,
  signal: AbortSignal,
  onToken: (text: string) => void,
  fetcher: typeof fetch = fetch,
): Promise<ChatReplyPayload> {
  const response = await fetcher("/api/chat", {
    method: "POST",
    credentials: "same-origin",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ChatRequestError(
      typeof payload?.reply === "string" ? payload.reply : CHAT_FALLBACK_REPLY,
    );
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    const payload = await response.json();
    if (typeof payload?.reply !== "string" || !payload.reply.trim())
      throw new ChatRequestError(CHAT_FALLBACK_REPLY);
    return payload;
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ChatRequestError(CHAT_FALLBACK_REPLY);
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      // A cited result includes bounded source URLs and Google's search suggestions.
      if (buffer.length > 256_000)
        throw new ChatRequestError(CHAT_FALLBACK_REPLY);
      const parsed = done
        ? { frames: drainSseBuffer(buffer), rest: "" }
        : parseSseChunks(buffer);
      buffer = parsed.rest;
      for (const frame of parsed.frames) {
        const event = readChatStreamFrame(frame.event, frame.data);
        if (!event) continue;
        if (event.type === "error")
          throw new ChatRequestError(event.reply || CHAT_FALLBACK_REPLY);
        if (event.type === "token") {
          text += event.text;
          if (text.length > 32_000)
            throw new ChatRequestError(CHAT_FALLBACK_REPLY);
          onToken(event.text);
        }
        if (event.type === "done") {
          if (!event.reply?.trim())
            throw new ChatRequestError(CHAT_FALLBACK_REPLY);
          return { ...event, reply: finalChatStreamReply(text, event.reply) };
        }
      }
      if (done) break;
    }
    throw new ChatRequestError(CHAT_FALLBACK_REPLY);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export const CHAT_OFFLINE_FAILURE =
  "Você está sem conexão com a internet. Sua mensagem ficou no campo; assim que a conexão voltar, toque em Tentar novamente.";
export const CHAT_TIMEOUT_FAILURE =
  "A resposta demorou mais que o normal. Sua mensagem ficou no campo para você tentar novamente.";
export const CHAT_NETWORK_FAILURE =
  "Não consegui falar com o servidor agora. Sua mensagem ficou no campo; confira a conexão e toque em Tentar novamente.";
export const CHAT_ONLINE_AGAIN =
  "A conexão voltou. Toque em Tentar novamente para enviar sua mensagem.";

/** Texto de falha para o chat: separa servidor, lentidão, queda de rede e erro desconhecido. */
export function chatFailureMessage(
  error: unknown,
  online: boolean,
  fallback: (message: string) => string = (message) => message,
): string {
  if (error instanceof ChatRequestError) return fallback(error.message);
  if (!online) return CHAT_OFFLINE_FAILURE;
  const name = (error as { name?: unknown } | null)?.name;
  if (error === "timeout" || name === "TimeoutError") return CHAT_TIMEOUT_FAILURE;
  if (error instanceof TypeError) return CHAT_NETWORK_FAILURE;
  return "Não consegui concluir a resposta. Sua mensagem ficou no campo para você tentar novamente.";
}
