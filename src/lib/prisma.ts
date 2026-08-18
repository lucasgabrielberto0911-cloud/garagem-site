import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function warnIfDirectDbUrl() {
  if (process.env.NODE_ENV !== "production") return;
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (!url) return;
  try {
    const parsed = new URL(url.replace(/^postgresql:/i, "http:"));
    const port = parsed.port || "5432";
    const isPooler =
      port === "6543" ||
      parsed.hostname.includes("pooler") ||
      /(?:^|[?&])pgbouncer=true(?:&|$)/i.test(url);
    if (!isPooler && port === "5432") {
      console.warn(
        "[prisma] DATABASE_URL parece conexão direta (porta 5432). Em produção no Vercel use o Transaction pooler do Supabase (porta 6543 com pgbouncer=true). DIRECT_URL (5432) fica só para migrations.",
      );
    }
  } catch {
    // URI inválida — health check cobre o diagnóstico.
  }
}

warnIfDirectDbUrl();

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
