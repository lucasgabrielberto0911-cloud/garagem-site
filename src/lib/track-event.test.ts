import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeEventParams } from "./track-event";

test("sanitizeEventParams mantém só primitivos curtos", () => {
  const out = sanitizeEventParams({
    a: "x".repeat(200),
    b: 3,
    c: NaN,
    d: { nested: 1 },
    e: "  ",
  });
  assert.equal((out.a as string).length, 80);
  assert.equal(out.b, 3);
  assert.deepEqual(Object.keys(out).sort(), ["a", "b"]);
});
