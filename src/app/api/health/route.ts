import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultAdmin } from "@/lib/ensure-admin";

export const dynamic = "force-dynamic";

/** Diagnóstico simples: só precisa de DATABASE_URL no Vercel. */
export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

  if (!hasDatabaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        database: "missing",
        hint: "Configure DATABASE_URL (Supabase) no Vercel → Environment Variables → Production e faça Redeploy.",
      },
      { status: 503 },
    );
  }

  try {
    await ensureDefaultAdmin();
    const adminCount = await prisma.admin.count();
    return NextResponse.json({
      ok: true,
      database: "ok",
      adminCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        hint: "DATABASE_URL inválida ou tabelas ainda não criadas. No Supabase/SQL ou com prisma db push, sincronize o schema.",
        detail:
          error instanceof Error ? error.message.slice(0, 160) : undefined,
      },
      { status: 503 },
    );
  }
}
