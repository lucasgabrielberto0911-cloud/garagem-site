import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { sessionFingerprint } from "@/lib/admin-session-fingerprint";
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
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { passwordHash: true, email: true },
  });
  if (!admin || admin.email !== email)
    throw new Error("Acesso não encontrado.");
  return signToken(
    {
      adminId,
      email,
      fingerprint: sessionFingerprint(admin.passwordHash, admin.email),
    },
    "7d",
  );
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

/** Uma verificação de JWT por request — layout e página compartilham o resultado. */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const session = await readSessionToken(token);
    if (typeof session.adminId !== "string") return null;
    const admin = await prisma.admin.findUnique({
      where: { id: session.adminId },
      select: { passwordHash: true, email: true },
    });
    if (
      !admin ||
      session.fingerprint !==
        sessionFingerprint(admin.passwordHash, admin.email)
    )
      return null;
    return session;
  } catch {
    return null;
  }
});
