import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_NAME,
  DEFAULT_ADMIN_PASSWORD,
} from "@/lib/secrets";

/** Senhas antigas de instalação que devem ser trocadas pela padrão atual. */
const LEGACY_PASSWORDS = ["troque-esta-senha"] as const;

/**
 * Garante o admin padrão. Se a senha ainda for a antiga de instalação,
 * atualiza para Lucas0911 automaticamente.
 */
export async function ensureDefaultAdmin() {
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

  const existing = await prisma.admin.findUnique({
    where: { email: DEFAULT_ADMIN_EMAIL },
  });

  if (!existing) {
    await prisma.admin.create({
      data: {
        name: DEFAULT_ADMIN_NAME,
        email: DEFAULT_ADMIN_EMAIL,
        passwordHash,
      },
    });
    return;
  }

  const alreadyDefault = await bcrypt.compare(
    DEFAULT_ADMIN_PASSWORD,
    existing.passwordHash,
  );
  if (alreadyDefault) return;

  const isLegacy = (
    await Promise.all(
      LEGACY_PASSWORDS.map((password) =>
        bcrypt.compare(password, existing.passwordHash),
      ),
    )
  ).some(Boolean);

  if (isLegacy) {
    await prisma.admin.update({
      where: { email: DEFAULT_ADMIN_EMAIL },
      data: { passwordHash, name: DEFAULT_ADMIN_NAME },
    });
  }
}
