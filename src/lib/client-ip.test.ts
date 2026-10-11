import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp } from "./client-ip";

test("usa o primeiro IP encaminhado e ignora valores absurdos", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
  assert.equal(clientIp(new Headers({ "x-real-ip": "9.9.9.9" })), "9.9.9.9");
  assert.equal(clientIp(new Headers()), null);
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "x".repeat(200) })), null);
});
