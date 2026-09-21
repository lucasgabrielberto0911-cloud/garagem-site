import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const banned = [
  "@aws-sdk/client-rekognition",
  "blurDetectedPlates",
  "hasPlate",
  "Tem placa",
  "/api/upload/reblur",
  "DetectTextCommand",
  "Rekognition",
];

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "fixtures") {
      continue;
    }
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...filesUnder(path));
      continue;
    }
    if (/\.(ts|tsx|mjs|json|md|prisma)$/.test(entry)) out.push(path);
  }
  return out;
}

test("detector automático de placa saiu do código", () => {
  const paths = [
    ...filesUnder(join(root, "src")),
    ...filesUnder(join(root, "scripts")),
    join(root, "package.json"),
    join(root, "next.config.mjs"),
    join(root, "prisma/schema.prisma"),
    join(root, "docs/ops.md"),
  ].filter((path) => !path.endsWith("manual-blur-only.test.ts"));

  const hits: string[] = [];
  for (const path of paths) {
    const text = readFileSync(path, "utf8");
    for (const token of banned) {
      if (text.includes(token)) {
        hits.push(`${relative(root, path)} → ${token}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});
