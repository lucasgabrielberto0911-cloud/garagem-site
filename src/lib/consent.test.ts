import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasMarketingConsent,
  isConsentChoice,
  readStoredConsent,
} from "./consent";

test("consentimento de marketing só vale com accepted", () => {
  assert.equal(isConsentChoice("accepted"), true);
  assert.equal(isConsentChoice("essential"), true);
  assert.equal(isConsentChoice("all"), false);
  assert.equal(hasMarketingConsent("accepted"), true);
  assert.equal(hasMarketingConsent("essential"), false);
  assert.equal(hasMarketingConsent(null), false);
});

test("sem window não lê consentimento", () => {
  assert.equal(readStoredConsent(), null);
});
