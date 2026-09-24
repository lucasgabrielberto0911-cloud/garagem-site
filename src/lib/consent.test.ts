import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  hasMarketingConsent,
  isConsentChoice,
  readStoredConsent,
  shouldLoadMetaPixel,
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

test("pixel sobe no aceite ou no clique de anúncio, e não sobe se recusou", () => {
  assert.equal(shouldLoadMetaPixel("accepted", ""), true);
  assert.equal(shouldLoadMetaPixel("essential", "?fbclid=abc"), false);
  assert.equal(shouldLoadMetaPixel(null, ""), false);
  assert.equal(shouldLoadMetaPixel(null, "?fbclid=IwAR"), true);
  assert.equal(
    shouldLoadMetaPixel(null, "?utm_source=meta&utm_medium=dinamico"),
    true,
  );
  assert.equal(shouldLoadMetaPixel(null, "?utm_source=instagram"), true);
  assert.equal(shouldLoadMetaPixel(null, "?utm_source=google"), false);
});

test("fbevents sobe afterInteractive, não no idle", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../components/MetaPixel.tsx"),
    "utf8",
  );
  assert.match(source, /strategy="afterInteractive"/);
  assert.doesNotMatch(source, /lazyOnload/);
  assert.match(source, /fbq\('track', 'PageView'\)/);
});
