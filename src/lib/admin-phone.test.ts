import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAdminPhone } from "./admin-phone";
import { normalizePromissoryPhone } from "./promissory-notes";
import { parseAdminSellInput } from "./admin-sell";

for (const [raw, expected] of [
  ["(27) 3333-0000", "2733330000"], ["(27) 99999-0000", "27999990000"],
  ["+55 (27) 3333-0000", "2733330000"], ["+55 (27) 99999-0000", "27999990000"],
  ["", null], ["123456789", null], ["123456789012", null], ["1234567890123", null], ["552799999000099", null],
] as const) test(`telefone do admin e documentos: ${raw || "vazio"}`, () => {
  assert.equal(normalizeAdminPhone(raw), expected);
  assert.equal(normalizePromissoryPhone(raw), expected);
  const parsed = parseAdminSellInput({ buyerPhone: raw });
  if (raw && !expected) assert.equal(parsed.ok, false);
  else { assert.equal(parsed.ok, true); if (parsed.ok) assert.equal(parsed.input.buyerPhone, expected ?? undefined); }
});
