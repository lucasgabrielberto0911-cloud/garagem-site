/**
 * Segredos do projeto — NÃO há mais valores padrão no repositório.
 *
 * Segredo de sessão (JWT), em ordem de prioridade:
 *  1. env JWT_SECRET, se definida;
 *  2. senão, segredo determinístico derivado de SUPABASE_SERVICE_ROLE_KEY
 *     via SHA-256 (WebCrypto — funciona em Node e Edge Runtime);
 *  3. sem nenhuma das duas, falha com erro explícito.
 *
 * Assim o repositório nunca carrega uma credencial utilizável e os deploys
 * existentes continuam funcionando com as variáveis que a Vercel já tem.
 */
const encoder = new TextEncoder();

export async function getJwtSecret(): Promise<Uint8Array> {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return encoder.encode(fromEnv);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceKey) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`garagem:jwt:v1:${serviceKey}`),
    );
    return new Uint8Array(digest);
  }

  throw new Error(
    "[garagem] Segredo de sessão ausente: defina JWT_SECRET (ou SUPABASE_SERVICE_ROLE_KEY para derivação automática).",
  );
}

export const DEFAULT_ADMIN_EMAIL = "admin@loja.com";
export const DEFAULT_ADMIN_NAME = "Administrador";
