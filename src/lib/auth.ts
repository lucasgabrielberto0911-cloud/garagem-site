import { cookies } from "next/headers";
import type { JWTPayload } from "jose";
import { signToken, verifyToken } from "@/lib/jwt";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = JWTPayload & {
  adminId: string;
  email: string;
};

export async function createSessionToken(adminId: string, email: string) {
  return signToken({ adminId, email }, "7d");
}

export async function readSessionToken(token: string) {
  return verifyToken<SessionPayload>(token);
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await readSessionToken(token);
  } catch {
    return null;
  }
}
