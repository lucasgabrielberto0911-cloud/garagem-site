import { NextResponse } from "next/server";
import type { ChatTurn } from "@/lib/chat-gemini";
import {
  CHAT_FALLBACK_REPLY,
  CHAT_WHATSAPP_URL,
} from "@/lib/chat-prompt";
import {
  applyChatSessionCookie,
  checkChatRateLimit,
  getOrCreateChatSession,
} from "@/lib/chat-session";
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
    };
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
    const result = await deps.runTurn({
      mensagem,
      historico,
      stock,
    });
    return json(session, result);
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
