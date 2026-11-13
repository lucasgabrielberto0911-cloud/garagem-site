import { assertSafeDatabaseUrl } from "../src/lib/safe-database-url";

assertSafeDatabaseUrl();
if (process.env.DIRECT_URL?.trim()) {
  assertSafeDatabaseUrl(process.env.DIRECT_URL);
}
