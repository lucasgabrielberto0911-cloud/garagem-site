import { isSameOriginRequest } from "@/lib/admin-request-origin";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { ensureDefaultAdmin } from "@/lib/ensure-admin";
import { checkLoginRateLimit, clearLoginRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return NextResponse.json({ error: "Acesso inválido." }, { status: 403 });
  try {
    const type = request.headers.get("content-type") || "";
    const body = type.includes("application/json")
      ? await request.json()
      : Object.fromEntries(await request.formData());
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password || email.length > 254 || password.length > 256) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios." },
        { status: 400 },
      );
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const rateKey = `${ip}:${email}`;
    const rate = await checkLoginRateLimit(rateKey);
    if (!rate.ok) {
      return NextResponse.json(
        {
          error: `Muitas tentativas. Aguarde ${rate.retryAfterSec}s e tente de novo.`,
        },
        { status: 429 },
      );
    }

    await ensureDefaultAdmin();

    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin) {
      return NextResponse.json(
        { error: "Credenciais inválidas." },
        { status: 401 },
      );
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);

    if (!valid) {
      return NextResponse.json(
        { error: "Credenciais inválidas." },
        { status: 401 },
      );
    }

    await clearLoginRateLimit(rateKey);

    const token = await createSessionToken(admin.id, admin.email);
    const response = NextResponse.json({
      ok: true,
      admin: { id: admin.id, name: admin.name, email: admin.email },
    });

    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        error:
          "Não foi possível entrar agora. Aguarde um momento e tente novamente.",
      },
      { status: 500 },
    );
  }
}
