import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico seguro para produção: não revela segredos, só se as envs
 * existem e se o Prisma consegue falar com o banco.
 */
export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL?.trim()),
    DIRECT_URL: Boolean(process.env.DIRECT_URL?.trim()),
    JWT_SECRET: Boolean(process.env.JWT_SECRET?.trim()),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
    ),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    ),
  };

  let database: "ok" | "error" | "skipped" = "skipped";
  let databaseError: string | undefined;
  let adminCount: number | undefined;

  if (env.DATABASE_URL) {
    try {
      adminCount = await prisma.admin.count();
      database = "ok";
    } catch (error) {
      database = "error";
      databaseError =
        error instanceof Error
          ? error.name === "PrismaClientInitializationError"
            ? "Falha ao conectar no Postgres (URL/credenciais/rede)."
            : error.message.slice(0, 160)
          : "Erro desconhecido no banco.";
    }
  } else {
    database = "error";
    databaseError = "DATABASE_URL ausente no ambiente.";
  }

  const ok = env.JWT_SECRET && database === "ok";

  return NextResponse.json(
    {
      ok,
      env,
      database,
      databaseError,
      adminCount,
      hint: !ok
        ? "No Vercel → Project → Settings → Environment Variables, configure DATABASE_URL, DIRECT_URL e JWT_SECRET (Production). Depois rode prisma db push e o seed no banco."
        : undefined,
    },
    { status: ok ? 200 : 503 },
  );
}
