import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAT_WHATSAPP_URL } from "./chat-prompt";
import { site } from "./site";

test("domínio canônico e WhatsApp do chat batem com o site", () => {
  assert.equal(site.url, "https://www.suagaragem.net");
  assert.equal(CHAT_WHATSAPP_URL, `https://wa.me/${site.whatsappNumber}`);
});
