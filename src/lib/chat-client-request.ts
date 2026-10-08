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
      if (buffer.length > 64_000)
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
