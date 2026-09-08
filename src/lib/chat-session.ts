import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { checkDistributedRateLimit } from "@/lib/rate-limit";

export const CHAT_SESSION_COOKIE = "garagem_chat";
export const CHAT_SESSION_MAX_MESSAGES = 30;
const CHAT_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

function newSessionId() {
  return crypto.randomUUID();
}

export function chatCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function getOrCreateChatSession() {
  const jar = await cookies();
  const existing = jar.get(CHAT_SESSION_COOKIE)?.value?.trim();
  if (existing && existing.length >= 8 && existing.length <= 80) {
    return { id: existing, fresh: false };
  }
  return { id: newSessionId(), fresh: true };
}

export function applyChatSessionCookie(
  response: NextResponse,
  session: { id: string; fresh: boolean },
) {
  if (session.fresh) {
    response.cookies.set(CHAT_SESSION_COOKIE, session.id, chatCookieOptions());
  }
  return response;
}

export async function checkChatRateLimit(sessionId: string) {
  return checkDistributedRateLimit(`chat:${sessionId}`, {
    windowMs: CHAT_SESSION_WINDOW_MS,
    max: CHAT_SESSION_MAX_MESSAGES,
  });
}
