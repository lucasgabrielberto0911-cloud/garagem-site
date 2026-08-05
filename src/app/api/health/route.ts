import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultAdmin } from "@/lib/ensure-admin";

export const dynamic = "force-dynamic";

function databaseHost() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url.replace(/^postgresql:/i, "http:")).host;
  } catch {
    return "invalid";
  }
}

/** Diagnóstico simples: só precisa de DATABASE_URL do Supabase no Vercel. */
export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const host = databaseHost();

  if (!hasDatabaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        database: "missing",
        hint: "No Vercel → Settings → Environment Variables, cole o DATABASE_URL do Supabase (não use localhost) e faça Redeploy.",
      },
      { status: 503 },
    );
  }

  if (host?.includes("localhost") || host?.startsWith("127.")) {
    return NextResponse.json(
      {
        ok: false,
        database: "localhost",
        host,
        hint: "O DATABASE_URL no Vercel está como localhost. Troque pela URI do Supabase: Project Settings → Database → Connect → URI (Transaction pooler). Também configure DIRECT_URL (Direct connection).",
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
      host,
      adminCount,
      storage: {
        configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
        serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
        hint: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
          ? undefined
          : "Adicione SUPABASE_SERVICE_ROLE_KEY no Vercel para o upload de fotos funcionar.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        host,
        hint: "DATABASE_URL inválida ou tabelas ainda não criadas. Confira a URI do Supabase e rode prisma db push no banco.",
        detail:
          error instanceof Error ? error.message.slice(0, 160) : undefined,
      },
      { status: 503 },
    );
  }
}
