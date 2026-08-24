import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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

/**
 * Diagnóstico do deploy.
 *
 * - Sem sessão de admin (ex.: monitores de uptime): resposta MÍNIMA —
 *   apenas ok/erro de banco. Não expõe host, envs nem dicas internas.
 * - Com sessão de admin ativa: diagnóstico completo com host e hints,
 *   igual ao comportamento anterior.
 *
 * NÃO cria/migra admin aqui mais (isso agora é bootstrap explícito
 * via ADMIN_BOOTSTRAP_PASSWORD em src/lib/ensure-admin.ts).
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    try {
      if (!process.env.DATABASE_URL?.trim()) {
        return NextResponse.json({ ok: false }, { status: 503 });
      }
      await prisma.admin.count();
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ ok: false }, { status: 503 });
    }
  }

  // ===== Diagnóstico completo (somente admin autenticado) =====
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

  const dbUrl = process.env.DATABASE_URL?.trim() ?? "";
  let dbPort = "";
  try {
    dbPort = new URL(dbUrl.replace(/^postgresql:/i, "http:")).port || "5432";
  } catch {
    dbPort = "";
  }
  const looksPooled =
    dbPort === "6543" ||
    host?.includes("pooler") ||
    /(?:^|[?&])pgbouncer=true(?:&|$)/i.test(dbUrl);
  if (!looksPooled) {
    return NextResponse.json(
      {
        ok: false,
        database: "direct-url",
        host,
        hint: "DATABASE_URL parece conexão direta (porta 5432). No Vercel use a URI Transaction pooler do Supabase (porta 6543, com ?pgbouncer=true). Deixe a Direct connection só em DIRECT_URL (migrations).",
      },
      { status: 503 },
    );
  }

  try {
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
