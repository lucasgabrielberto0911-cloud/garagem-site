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

export function encodeSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function parseSseChunks(buffer: string): {
  frames: Array<{ event: string; data: string }>;
  rest: string;
} {
  const frames: Array<{ event: string; data: string }> = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (dataLines.length > 0) {
      frames.push({ event, data: dataLines.join("\n") });
    }
  }
  return { frames, rest };
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
