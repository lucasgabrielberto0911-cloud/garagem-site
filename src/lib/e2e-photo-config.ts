export function isE2ePhotoFixtureEnabled() {
  if (process.env.E2E_TEST !== "1") return false;
  const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) || !["/ci", "/garagem_e2e"].includes(database.pathname)) {
    throw new Error("Fotos E2E exigem banco local dedicado; acesso ao Storage bloqueado.");
  }
  return true;
}
