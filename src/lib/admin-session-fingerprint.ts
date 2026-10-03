import { createHash } from "node:crypto";
export function sessionFingerprint(passwordHash: string, email: string) {
  return createHash("sha256").update(`${passwordHash}:${email}`).digest("hex");
}
