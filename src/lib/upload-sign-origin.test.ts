import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/upload/sign/route";

test("POST /api/upload/sign rejeita Origin ausente antes da sessão", async () => {
  const response = await POST(new Request("https://garagem.test/api/upload/sign", {
    method: "POST",
    headers: { host: "garagem.test", "content-type": "application/json" },
    body: "{}",
  }));

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Origem inválida." });
});
