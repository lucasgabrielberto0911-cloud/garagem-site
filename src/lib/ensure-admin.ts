import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_NAME,
  DEFAULT_ADMIN_PASSWORD,
} from "@/lib/secrets";

/**
 * Se o banco ainda não tem admin, cria o acesso padrão automaticamente
 * (primeiro login / instalação). Não altera senha de admin já existente.
 */
export async function ensureDefaultAdmin() {
  const count = await prisma.admin.count();
  if (count > 0) return;

  await prisma.admin.create({
    data: {
      name: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10),
    },
  });
}
