import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertSafeDatabaseUrl, isRemoteSupabaseDatabaseHost } from "./safe-database-url";

const local = "postgresql://postgres:postgres@127.0.0.1:5432/garagem_e2e";
const supabaseDirect = "postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres";
const supabasePooler = "postgresql://postgres:secret@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";

test("localhost e 127.0.0.1 passam sem flag", () => {
  assert.equal(isRemoteSupabaseDatabaseHost("127.0.0.1"), false);
  assert.doesNotThrow(() => assertSafeDatabaseUrl(local, {}));
  assert.doesNotThrow(() =>
    assertSafeDatabaseUrl("postgresql://postgres:postgres@localhost:5432/ci", {}),
  );
});

test("host Supabase é recusado sem ALLOW_REMOTE_DB", () => {
  assert.equal(isRemoteSupabaseDatabaseHost("db.abcdefgh.supabase.co"), true);
  assert.equal(isRemoteSupabaseDatabaseHost("aws-0-sa-east-1.pooler.supabase.com"), true);
  assert.throws(() => assertSafeDatabaseUrl(supabaseDirect, {}), /ALLOW_REMOTE_DB=1/);
  assert.throws(() => assertSafeDatabaseUrl(supabasePooler, {}), /pooler\.supabase\.com/);
});

test("ALLOW_REMOTE_DB=1 libera host remoto de forma explícita", () => {
  assert.doesNotThrow(() =>
    assertSafeDatabaseUrl(supabaseDirect, { ALLOW_REMOTE_DB: "1" }),
  );
});

test("ALLOW_REMOTE_SEED=true continua válido no seed", () => {
  assert.doesNotThrow(() =>
    assertSafeDatabaseUrl(supabaseDirect, { ALLOW_REMOTE_SEED: "true" }),
  );
});

test("URL ausente ou inválida falha", () => {
  assert.throws(() => assertSafeDatabaseUrl("", {}), /não configurada/);
  assert.throws(() => assertSafeDatabaseUrl("not-a-url", {}), /inválida/);
});

test("scripts que escrevem no banco chamam a trava", () => {
  const files = [
    "prisma/seed.ts",
    "e2e/seed.ts",
    "scripts/import-stock-vehicle.ts",
    "scripts/backfill-photo-thumbnails.ts",
    "scripts/backfill-gallery-previews.ts",
    "scripts/test-admin-db.ts",
    "scripts/assert-safe-db.ts",
    "scripts/ci-apply-migrations.sh",
    "package.json",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.match(
      source,
      /assertSafeDatabaseUrl|assert-safe-db|assert_safe_database_url/,
      file,
    );
  }
  assert.match(readFileSync("package.json", "utf8"), /assert-safe-db\.ts/);
});
