import { NextResponse } from "next/server";
import { CHAT_FALLBACK_REPLY } from "@/lib/chat-prompt";
import { geminiConfigured, type ChatTurn } from "@/lib/chat-gemini";
import {
  applyChatSessionCookie,
  checkChatRateLimit,
  getOrCreateChatSession,
} from "@/lib/chat-session";
import { loadChatStock } from "@/lib/chat-stock";
import { runChatTurn } from "@/lib/chat-turn";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_MESSAGE = 800;
const MAX_HISTORY = 12;

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

function readTurns(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: ChatTurn[] = [];
  for (const item of raw.slice(-MAX_HISTORY)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: string }).role;
    const content = String((item as { content?: string }).content ?? "").trim();
    if ((role === "user" || role === "assistant") && content) {
      turns.push({ role, content: content.slice(0, MAX_MESSAGE) });
    }
  }
  return turns;
}

export async function GET() {
  return NextResponse.json({ ok: true, gemini: geminiConfigured() });
}

export async function POST(request: Request) {
  let session = { id: "anon", fresh: false };
  try {
    session = await getOrCreateChatSession();
    const limited = await checkChatRateLimit(session.id);
    if (!limited.ok) {
      return json(
        session,
        {
          reply:
            "Você mandou várias mensagens seguidas. Chama a gente no WhatsApp que um consultor te atende agora: https://wa.me/5527996330706",
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
    const mensagem = String(body.mensagem ?? "").trim().slice(0, MAX_MESSAGE);
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

    const historico = readTurns(body.historico);
    let stock: Awaited<ReturnType<typeof loadChatStock>> = [];
    try {
      stock = await loadChatStock();
    } catch (error) {
      console.error("[chat] estoque:", error);
    }
    const result = await runChatTurn({
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
