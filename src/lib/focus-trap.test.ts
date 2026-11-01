import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { handleFocusTrap } from "./focus-trap";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("handleFocusTrap ignora teclas que não são Tab", () => {
  const container = {
    querySelectorAll: () => [],
  } as unknown as HTMLElement;
  const event = {
    key: "Escape",
    preventDefault() {},
  } as KeyboardEvent;
  assert.equal(handleFocusTrap(event, container), false);
});

test("SiteHeader implementa dialog com focus trap no menu mobile", () => {
  const code = readFileSync(join(srcRoot, "components/site/SiteHeader.tsx"), "utf8");
  assert.match(code, /handleFocusTrap\(event,\s*menuRef\.current\)/);
  assert.match(code, /role="dialog"[\s\S]*aria-modal="true"/);
  assert.doesNotMatch(code, /role="button"[\s\S]{1,50}tabIndex=\{0\}[\s\S]{1,50}bg-black\/50/);
});
