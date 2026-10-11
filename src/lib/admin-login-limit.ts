import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
const WINDOW_MS = 15 * 60 * 1000;
function keyFor(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export type SharedLimitOptions = { windowMs: number; max: number };

export async function checkSharedLoginLimit(value: string) {
  return checkSharedLimit(value, { windowMs: WINDOW_MS, max: 8 });
}

/**
 * Contador compartilhado entre instâncias, na tabela privada de tentativas.
 * A chave é gravada só como hash; o prefixo evita colisão com o login.
 */
export async function checkSharedLimit(
  value: string,
  options: SharedLimitOptions,
) {
  // Limita retenção das chaves expiradas sem uma tarefa agendada adicional.
  await prisma.$executeRaw`DELETE FROM "AdminLoginAttempt" WHERE "key" IN (SELECT "key" FROM "AdminLoginAttempt" WHERE "expiresAt" < NOW() LIMIT 100)`;
  const key = keyFor(value);
  const expiry = new Date(Date.now() + options.windowMs);
  const rows = await prisma.$queryRaw<
    Array<{ count: number; expiresAt: Date }>
  >`
    INSERT INTO "AdminLoginAttempt" ("key", "count", "expiresAt") VALUES (${key}, 1, ${expiry})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "AdminLoginAttempt"."expiresAt" <= NOW() THEN 1 ELSE "AdminLoginAttempt"."count" + 1 END,
      "expiresAt" = CASE WHEN "AdminLoginAttempt"."expiresAt" <= NOW() THEN ${expiry} ELSE "AdminLoginAttempt"."expiresAt" END
    RETURNING "count", "expiresAt"`;
  return {
    ok: rows[0].count <= options.max,
    retryAfterSec: Math.max(
      1,
      Math.ceil((rows[0].expiresAt.getTime() - Date.now()) / 1000),
    ),
  };
}
export async function clearSharedLoginLimit(value: string) {
  await prisma.adminLoginAttempt.deleteMany({ where: { key: keyFor(value) } });
}
