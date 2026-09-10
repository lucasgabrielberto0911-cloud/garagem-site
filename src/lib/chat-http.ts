import { NextResponse } from "next/server";
import type { ChatTurn } from "@/lib/chat-gemini";
import { logChatTurn } from "@/lib/chat-metrics";
import {
  CHAT_FALLBACK_REPLY,
  CHAT_WHATSAPP_URL,
} from "@/lib/chat-prompt";
import {
  applyChatSessionCookie,
  checkChatRateLimit,
  getOrCreateChatSession,
} from "@/lib/chat-session";
import { encodeSse } from "@/lib/chat-stream";
import { loadChatStock, type ChatVehicleRecord } from "@/lib/chat-stock";
import { runChatTurn, type ChatTurnResult } from "@/lib/chat-turn";
import type { RateLimitResult } from "@/lib/rate-limit";

export const CHAT_MAX_MESSAGE = 800;
export const CHAT_MAX_HISTORY = 12;

export function chatHealthPayload() {
  return { ok: true as const };
}

export type ChatPostDeps = {
  getSession: () => Promise<{ id: string; fresh: boolean }>;
  checkLimit: (sessionId: string) => Promise<RateLimitResult>;
  loadStock: () => Promise<ChatVehicleRecord[]>;
  runTurn: (
    input: Parameters<typeof runChatTurn>[0],
  ) => Promise<ChatTurnResult>;
};

export const defaultChatPostDeps: ChatPostDeps = {
  getSession: getOrCreateChatSession,
  checkLimit: checkChatRateLimit,
  loadStock: loadChatStock,
  runTurn: runChatTurn,
};

function json(
  session: { id: string; fresh: boolean },
  payload: Record<string, unknown>,
  status = 200,
) {
  return applyChatSessionCookie(
    NextResponse.json(payload, { status }),
    session,
  );
}

function publicResult(result: ChatTurnResult) {
  return {
    reply: result.reply,
    leadCreated: result.leadCreated,
    vehicles: result.vehicles,
    stockHref: result.stockHref,
  };
}

export function wantsChatStream(request: Request, body: { stream?: unknown }) {
  if (body.stream === true) return true;
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/event-stream");
}

function sseResponse(
  session: { id: string; fresh: boolean },
  stream: ReadableStream<Uint8Array>,
) {
  return applyChatSessionCookie(
    new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    }),
    session,
  );
}

export function readChatTurns(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: ChatTurn[] = [];
  for (const item of raw.slice(-CHAT_MAX_HISTORY)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: string }).role;
    const content = String((item as { content?: string }).content ?? "").trim();
    if ((role === "user" || role === "assistant") && content) {
      turns.push({ role, content: content.slice(0, CHAT_MAX_MESSAGE) });
    }
  }
  return turns;
}

export function handleChatGet() {
  return NextResponse.json(chatHealthPayload());
}

export async function handleChatPost(
  request: Request,
  deps: ChatPostDeps = defaultChatPostDeps,
) {
  let session = { id: "anon", fresh: false };
  try {
    session = await deps.getSession();
    const limited = await deps.checkLimit(session.id);
    if (!limited.ok) {
      return json(
        session,
        {
          reply: `Você mandou várias mensagens seguidas. Chama a gente no WhatsApp que um consultor te atende agora: ${CHAT_WHATSAPP_URL}`,
          leadCreated: false,
          vehicles: [],
          stockHref: null,
        },
        429,
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      mensagem?: unknown;
      historico?: unknown;
      vehicleId?: unknown;
      stream?: unknown;
    };
    const vehicleId =
      typeof body.vehicleId === "string" && body.vehicleId.trim()
        ? body.vehicleId.trim().slice(0, 100)
        : undefined;
    const mensagem = String(body.mensagem ?? "")
      .trim()
      .slice(0, CHAT_MAX_MESSAGE);
    if (mensagem.length < 2) {
      return json(
        session,
        {
          reply: "Pode escrever sua dúvida — marca, modelo ou faixa de preço.",
          leadCreated: false,
          vehicles: [],
          stockHref: null,
        },
        400,
      );
    }

    const historico = readChatTurns(body.historico);
    let stock: ChatVehicleRecord[] = [];
    try {
      stock = await deps.loadStock();
    } catch (error) {
      console.error("[chat] estoque:", error);
    }

    const stream = wantsChatStream(request, body);
    const started = Date.now();

    if (!stream) {
      const result = await deps.runTurn({
        mensagem,
        historico,
        stock,
        vehicleId,
      });
      logChatTurn({
        ms: Date.now() - started,
        finishReason: result.meta?.finishReason,
        truncated: result.meta?.truncated,
        retried: result.meta?.retried,
        offScope: result.meta?.offScope,
        fipe: result.meta?.fipe,
        policy: result.meta?.policy,
        streamed: false,
        leadCreated: result.leadCreated,
        cards: result.vehicles.length,
        model: result.meta?.model,
      });
      return json(session, publicResult(result));
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(encodeSse(event, data)));
        };
        try {
          const result = await deps.runTurn({
            mensagem,
            historico,
            stock,
            vehicleId,
            onToken: (text) => {
              send("token", { text });
            },
          });
          logChatTurn({
            ms: Date.now() - started,
            finishReason: result.meta?.finishReason,
            truncated: result.meta?.truncated,
            retried: result.meta?.retried,
            offScope: result.meta?.offScope,
            fipe: result.meta?.fipe,
            policy: result.meta?.policy,
            streamed: true,
            leadCreated: result.leadCreated,
            cards: result.vehicles.length,
            model: result.meta?.model,
          });
          send("done", publicResult(result));
        } catch (error) {
          console.error("[chat] stream:", error);
          send("error", {
            reply: CHAT_FALLBACK_REPLY,
            leadCreated: false,
            vehicles: [],
            stockHref: null,
          });
        } finally {
          controller.close();
        }
      },
    });
    return sseResponse(session, readable);
  } catch (error) {
    console.error("[chat]", error);
    return json(session, {
      reply: CHAT_FALLBACK_REPLY,
      leadCreated: false,
      vehicles: [],
      stockHref: null,
    });
  }
}
