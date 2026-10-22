import assert from "node:assert/strict";
import { test } from "node:test";
import { signToken, verifyToken } from "@/lib/jwt";

test("signToken e verifyToken: ciclo completo de payload", async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "super-secret-key-for-jwt-testing-12345";
  try {
    const payload = {
      adminId: "admin_123",
      email: "admin@loja.com",
      role: "admin",
    };
    const token = await signToken(payload, "1h");
    assert.ok(typeof token === "string" && token.split(".").length === 3);

    const verified = await verifyToken<{ adminId: string; email: string; role: string }>(token);
    assert.equal(verified.adminId, "admin_123");
    assert.equal(verified.email, "admin@loja.com");
    assert.equal(verified.role, "admin");
  } finally {
    if (originalSecret !== undefined) {
      process.env.JWT_SECRET = originalSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  }
});

test("verifyToken rejeita token com assinatura adulterada", async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "super-secret-key-for-jwt-testing-12345";
  try {
    const token = await signToken({ adminId: "admin_123" }, "1h");
    const parts = token.split(".");
    // Adultera payload
    const tamperedPayload = Buffer.from(JSON.stringify({ adminId: "admin_hacked" })).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    await assert.rejects(
      async () => verifyToken(tamperedToken),
      /signature verification failed/i,
    );
  } finally {
    if (originalSecret !== undefined) {
      process.env.JWT_SECRET = originalSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  }
});
