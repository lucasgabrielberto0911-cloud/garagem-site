import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { checkLoginRateLimit, clearLoginRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios." },
        { status: 400 },
      );
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const rateKey = `${ip}:${email}`;
    const rate = checkLoginRateLimit(rateKey);
    if (!rate.ok) {
      return NextResponse.json(
        {
          error: `Muitas tentativas. Aguarde ${rate.retryAfterSec}s e tente de novo.`,
        },
        { status: 429 },
      );
    }

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

    clearLoginRateLimit(rateKey);

    const token = await createSessionToken(admin.id, admin.email);
    const response = NextResponse.json({
      ok: true,
      admin: { id: admin.id, name: admin.name, email: admin.email },
    });

    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());

    return response;
  } catch (error) {
    console.error("Login error:", error);

    const raw = error instanceof Error ? error.message : String(error);
    let message =
      "Erro ao autenticar. Confira se o banco e o JWT_SECRET estão configurados.";

    if (raw.includes("JWT_SECRET")) {
      message =
        "Servidor sem JWT_SECRET. Defina JWT_SECRET nas Environment Variables do Vercel (Production) e faça redeploy.";
    } else if (
      raw.includes("Prisma") ||
      raw.includes("Can't reach database") ||
      raw.includes("P1001") ||
      raw.includes("P1017") ||
      raw.includes("P2021") ||
      raw.includes("does not exist") ||
      error instanceof Error && error.name.includes("Prisma")
    ) {
      message =
        "Não foi possível conectar ao banco. Configure DATABASE_URL e DIRECT_URL no Vercel (Production), rode prisma db push e o seed, e faça redeploy.";
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
