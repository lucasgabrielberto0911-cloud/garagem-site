import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_NAME,
} from "@/lib/secrets";

/** Senhas antigas de instalação que podem ser migradas para a senha de bootstrap. */
const LEGACY_PASSWORDS = ["troque-esta-senha"] as const;

/**
 * Bootstrap EXPLÍCITO do admin.
 *
 * Em produção isto é um no-op seguro: nada é criado ou alterado a menos que
 * a env ADMIN_BOOTSTRAP_PASSWORD esteja definida (fluxo de instalação).
 * Assim, quem lê o repositório não descobre nenhuma credencial válida e o
 * /api/health público nunca recria o admin sozinho.
 */
export async function ensureDefaultAdmin() {
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  if (!bootstrapPassword || bootstrapPassword.length < 8) return;

  const passwordHash = await bcrypt.hash(bootstrapPassword, 10);

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

  const alreadyBootstrap = await bcrypt.compare(
    bootstrapPassword,
    existing.passwordHash,
  );
  if (alreadyBootstrap) return;

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
