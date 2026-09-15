export type ChatStreamDone = {
  reply: string;
  leadCreated: boolean;
  vehicles: unknown[];
  stockHref: string | null;
};

export type ChatStreamEvent =
  | { type: "token"; text: string }
  | ({ type: "done" } & ChatStreamDone)
  | ({ type: "error" } & ChatStreamDone);

export type SseFrame = { event: string; data: string };

/** Gemini/HTTP SSE may use CRLF; treat CR LF the same as LF. */
export function normalizeSseBuffer(buffer: string) {
  return buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function encodeSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function parseSseChunks(buffer: string): {
  frames: SseFrame[];
  rest: string;
} {
  const frames: SseFrame[] = [];
  const normalized = normalizeSseBuffer(buffer);
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).replace(/^ /, "").trimEnd());
      }
    }
    if (dataLines.length > 0) {
      frames.push({ event, data: dataLines.join("\n") });
    }
  }
  return { frames, rest };
}

/** Flush a leftover SSE buffer when the byte stream ends. */
export function drainSseBuffer(buffer: string): SseFrame[] {
  const trimmed = buffer.trim();
  if (!trimmed) return [];
  const padded = /\n\n$/.test(normalizeSseBuffer(buffer))
    ? buffer
    : `${buffer}\n\n`;
  return parseSseChunks(padded).frames;
}

/**
 * Parse SSE frames whose `data:` payload is JSON (Gemini `alt=sse`).
 * Incomplete JSON stays in `rest` instead of being dropped.
 */
export function parseJsonSseFrames(buffer: string): {
  frames: unknown[];
  rest: string;
} {
  const parsed = parseSseChunks(buffer);
  const frames: unknown[] = [];
  const incomplete: string[] = [];
  for (const frame of parsed.frames) {
    if (!frame.data || frame.data === "[DONE]") continue;
    try {
      frames.push(JSON.parse(frame.data));
    } catch {
      incomplete.push(`data: ${frame.data}`);
    }
  }
  const rest = incomplete.length
    ? `${incomplete.join("\n")}\n${parsed.rest}`
    : parsed.rest;
  return { frames, rest };
}

export function drainJsonSseBuffer(buffer: string): unknown[] {
  const trimmed = buffer.trim();
  if (!trimmed) return [];
  const padded = /\n\n$/.test(normalizeSseBuffer(buffer))
    ? buffer
    : `${buffer}\n\n`;
  return parseJsonSseFrames(padded).frames;
}

export function readChatStreamFrame(
  event: string,
  raw: string,
): ChatStreamEvent | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (event === "token") {
    const text = typeof row.text === "string" ? row.text : "";
    return text ? { type: "token", text } : null;
  }
  const reply = typeof row.reply === "string" ? row.reply : "";
  const stockHref =
    typeof row.stockHref === "string" && row.stockHref.startsWith("/estoque")
      ? row.stockHref
      : null;
  const payload: ChatStreamDone = {
    reply,
    leadCreated: row.leadCreated === true,
    vehicles: Array.isArray(row.vehicles) ? row.vehicles : [],
    stockHref,
  };
  if (event === "done") return { type: "done", ...payload };
  if (event === "error") return { type: "error", ...payload };
  return null;
}

export function catchUpStreamText(emitted: string, finalReply: string): string {
  if (!finalReply) return "";
  if (!emitted) return finalReply;
  if (finalReply.startsWith(emitted)) return finalReply.slice(emitted.length);
  return "";
}

function hangingPricePrefix(text: string) {
  return /R\$\s*\.?$/.test(text.trim());
}

/** `done.reply` vence o rascunho do SSE — o visitante não fica com “limite de R$”. */
export function finalChatStreamReply(emitted: string, doneReply: string) {
  const final = doneReply.trim();
  if (final && !hangingPricePrefix(final)) return final;
  const streamed = emitted.trim();
  if (streamed && !hangingPricePrefix(streamed) && streamed.length >= final.length) {
    return streamed;
  }
  return final || streamed;
}
