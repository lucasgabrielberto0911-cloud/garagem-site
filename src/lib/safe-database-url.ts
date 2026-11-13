/** Recusa DATABASE_URL de produção (Supabase) em seed, e2e e scripts. */

export function isRemoteSupabaseDatabaseHost(hostname: string) {
  const host = hostname.trim().toLowerCase();
  return (
    host === "supabase.co" ||
    host.endsWith(".supabase.co") ||
    host === "supabase.com" ||
    host.endsWith(".supabase.com")
  );
}

function remoteAllowed(env: NodeJS.Dict<string>) {
  return env.ALLOW_REMOTE_DB === "1" || env.ALLOW_REMOTE_SEED === "true";
}

export function assertSafeDatabaseUrl(
  url = process.env.DATABASE_URL,
  env: NodeJS.Dict<string> = process.env,
) {
  if (!url?.trim()) {
    throw new Error("DATABASE_URL não configurada.");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL inválida.");
  }
  if (isRemoteSupabaseDatabaseHost(parsed.hostname) && !remoteAllowed(env)) {
    throw new Error(
      `Segurança: recusado host de produção (${parsed.hostname}). ` +
        "Use Postgres local. Só defina ALLOW_REMOTE_DB=1 se for intencional.",
    );
  }
}
