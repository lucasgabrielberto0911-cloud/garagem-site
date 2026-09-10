import assert from "node:assert/strict";
import { test } from "node:test";
import { chatPageKey, isVehicleChatPage } from "./chat-page";

test("conversa de anúncio não compartilha chave com a home", () => {
  assert.equal(chatPageKey("/"), "site");
  assert.equal(chatPageKey("/estoque"), "site");
  assert.equal(chatPageKey("/estoque?maxPrice=70000"), "site");
  assert.equal(
    chatPageKey("/estoque/toyota-etios-xs-2017"),
    "vehicle:/estoque/toyota-etios-xs-2017",
  );
  assert.equal(isVehicleChatPage("/estoque/toyota-etios-xs-2017"), true);
  assert.equal(isVehicleChatPage("/"), false);
  assert.notEqual(
    chatPageKey("/estoque/toyota-etios-xs-2017"),
    chatPageKey("/"),
  );
});
