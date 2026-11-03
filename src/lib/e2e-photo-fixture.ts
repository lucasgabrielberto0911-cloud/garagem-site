import { readFile } from "node:fs/promises";
import path from "node:path";

/** Interceptação no browser não cobre fetch do servidor nem APIRequestContext. */
export async function e2ePhotoFixture(): Promise<Buffer | null> {
  if (process.env.E2E_TEST !== "1") return null;
  const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) || !["/ci", "/garagem_e2e"].includes(database.pathname)) {
    throw new Error("Fotos E2E exigem banco local dedicado; acesso ao Storage bloqueado.");
  }
  return readFile(path.join(process.cwd(), "public/branding/placeholder-car.png"));
}
