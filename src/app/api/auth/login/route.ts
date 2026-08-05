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
  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
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

    const dbUrl = process.env.DATABASE_URL || "";
    const isLocalhost =
      /localhost|127\.0\.0\.1/.test(dbUrl) || !dbUrl.trim();

    if (isLocalhost) {
      return NextResponse.json(
        {
          error:
            "DATABASE_URL no Vercel está errada (localhost). Cole a URI do Supabase (Settings → Database → Connect) em DATABASE_URL e DIRECT_URL, depois Redeploy.",
        },
        { status: 500 },
      );
    }

    const raw = error instanceof Error ? error.message : String(error);
    let message =
      "Não foi possível entrar. Confira se o DATABASE_URL do Vercel é a URI do Supabase.";

    if (
      raw.includes("Prisma") ||
      raw.includes("Can't reach database") ||
      raw.includes("P1001") ||
      raw.includes("P1017") ||
      raw.includes("P2021") ||
      raw.includes("does not exist") ||
      (error instanceof Error && error.name.includes("Prisma"))
    ) {
      message =
        "Banco indisponível. No Vercel, use a URI do Supabase em DATABASE_URL (pooler) e DIRECT_URL (direct) e faça redeploy.";
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
