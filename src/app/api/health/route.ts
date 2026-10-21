import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  geminiKeyConfigured,
} from "@/lib/launch-readiness";

export const dynamic = "force-dynamic";

async function inspectSchema() {
  try {
    const rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'Testimonial' AND column_name = 'rating')
          OR (table_name = 'Photo' AND column_name = 'thumbnailUrl')
          OR (table_name = 'LeadVenda' AND column_name IN (
            'interestVehicleId', 'source', 'photoUrls', 'updatedAt'
          ))
        )
    `;
    const has = (table: string, column: string) =>
      rows.some((row) => row.table_name === table && row.column_name === column);
    const missing: string[] = [];
    if (!has("Testimonial", "rating")) missing.push("Testimonial.rating");
    if (!has("Photo", "thumbnailUrl")) missing.push("Photo.thumbnailUrl");
    if (!has("LeadVenda", "interestVehicleId")) missing.push("LeadVenda.interestVehicleId");
    if (!has("LeadVenda", "source")) missing.push("LeadVenda.source");
    if (!has("LeadVenda", "photoUrls")) missing.push("LeadVenda.photoUrls");
    if (!has("LeadVenda", "updatedAt")) missing.push("LeadVenda.updatedAt");
    return {
      ok: missing.length === 0,
      missing,
      hint:
        missing.length > 0
          ? "Rode supabase/migrations/20260827000100_alinhamento_schema.sql no SQL Editor do Supabase."
          : undefined,
    };
  } catch {
    return { ok: false, missing: ["unknown"], hint: "Não foi possível inspecionar o schema." };
  }
}

function databaseHost() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url.replace(/^postgresql:/i, "http:")).host;
  } catch {
    return "invalid";
  }
}

/** Diagnóstico do deploy com estado mínimo e sem configuração interna. */
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
    return NextResponse.json({
      ok: false,
      database: "missing",
      hint: "No Vercel → Settings → Environment Variables, configure o DATABASE_URL do Supabase e faça Redeploy.",
    }, { status: 503 });
  }

  if (host?.includes("localhost") || host?.startsWith("127.")) {
    return NextResponse.json({
      ok: false,
      database: "localhost",
      host,
      hint: "O DATABASE_URL no Vercel está como localhost. Configure a URI Transaction pooler do Supabase e DIRECT_URL para migrations.",
    }, { status: 503 });
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
    return NextResponse.json({
      ok: false,
      database: "direct-url",
      host,
      hint: "DATABASE_URL parece conexão direta. No Vercel use a URI Transaction pooler do Supabase; deixe a Direct connection em DIRECT_URL.",
    }, { status: 503 });
  }

  try {
    const adminCount = await prisma.admin.count();
    const schema = await inspectSchema();
    const storageConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
    const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
    const chat = geminiKeyConfigured();
    return NextResponse.json({
      ok: schema.ok,
      database: "ok",
      host,
      adminCount,
      schema,
      storage: {
        configured: storageConfigured,
        serviceRole: serviceRoleConfigured,
        hint: serviceRoleConfigured ? undefined : "Adicione SUPABASE_SERVICE_ROLE_KEY no Vercel para o upload de fotos funcionar.",
      },
      chat: { gemini: chat },
    });
  } catch (error) {
    const detail = error instanceof Error
      ? error.message
          .replace(/https?:\/\/\S+/gi, "[URL removida]")
          .replace(/((?:token|key|password|secret)\s*[=:]\s*)\S+/gi, "$1[redigido]")
          .slice(0, 160)
      : undefined;
    return NextResponse.json({
      ok: false,
      database: "error",
      host,
      hint: "DATABASE_URL inválida ou tabelas ainda não criadas. Confira a URI do Supabase e o schema.",
      detail,
    }, { status: 503 });
  }
}
