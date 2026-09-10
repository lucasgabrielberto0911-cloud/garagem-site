import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isIosSafariUserAgent,
  isMoneyPagePath,
  isStandaloneDisplay,
  shouldShowInstallCoach,
} from "./pwa-install";

test("detecta iOS Safari e ignora Chrome/Firefox no iPhone", () => {
  assert.equal(
    isIosSafariUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    ),
    true,
  );
  assert.equal(
    isIosSafariUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
    ),
    false,
  );
  assert.equal(isIosSafariUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X)", 0), false);
  assert.equal(isIosSafariUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X)", 5), true);
});

test("coach não aparece em standalone, página de dinheiro ou após dispensar", () => {
  assert.equal(isStandaloneDisplay(true, false), true);
  assert.equal(isStandaloneDisplay(false, true), true);
  assert.equal(isMoneyPagePath("/estoque"), true);
  assert.equal(isMoneyPagePath("/estoque/honda-hr-v"), true);
  assert.equal(isMoneyPagePath("/"), false);
  assert.equal(
    shouldShowInstallCoach({
      dismissed: false,
      standalone: false,
      hideOnMoneyPage: false,
    }),
    true,
  );
  assert.equal(
    shouldShowInstallCoach({
      dismissed: true,
      standalone: false,
      hideOnMoneyPage: false,
    }),
    false,
  );
});
