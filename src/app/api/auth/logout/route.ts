import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/admin-request-origin";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return NextResponse.json({ error: "Acesso inválido." }, { status: 403 });
  const response = NextResponse.json({ ok: true });

  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });

  return response;
}
