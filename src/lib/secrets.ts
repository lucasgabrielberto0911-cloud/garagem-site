/**
 * Segredos padrão do projeto para reduzir configuração no Vercel.
 * Se existir a variável de ambiente correspondente, ela tem prioridade.
 */
export const DEFAULT_JWT_SECRET =
  "garagem-suagaragem-jwt-OGbmjKV0bsnENzv3zm7YbEgssLut2Bh9OwaD1A34DKdHBkRg0e80YG6AdF5E";

export const DEFAULT_ADMIN_EMAIL = "admin@loja.com";
export const DEFAULT_ADMIN_PASSWORD = "Lucas0911";
export const DEFAULT_ADMIN_NAME = "Administrador";

export function getJwtSecret() {
  const fromEnv = process.env.JWT_SECRET?.trim();
  return fromEnv || DEFAULT_JWT_SECRET;
}
