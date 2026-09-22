import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INSTALL_COOLDOWN_MS,
  INSTALL_DISMISS_KEY,
  PWA_START_URL,
  installCaptureScript,
  isIosSafariUserAgent,
  isMoneyPagePath,
  isStandaloneDisplay,
  shouldAutoShowInstallCoach,
  shouldForceDocumentNavigation,
  shouldOfferInstallControl,
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

test("banner automático não volta em toda visita nem no desktop", () => {
  const base = {
    dismissed: false,
    standalone: false,
    hideOnMoneyPage: false,
    mobileSurface: true,
    seenAt: null as number | null,
    now: 1_000_000,
  };
  assert.equal(shouldAutoShowInstallCoach(base), true);
  assert.equal(shouldAutoShowInstallCoach({ ...base, mobileSurface: false }), false);
  assert.equal(shouldAutoShowInstallCoach({ ...base, hideOnMoneyPage: true }), false);
  assert.equal(
    shouldAutoShowInstallCoach({ ...base, seenAt: base.now - 60_000 }),
    false,
  );
  assert.equal(
    shouldAutoShowInstallCoach({
      ...base,
      seenAt: base.now - INSTALL_COOLDOWN_MS - 1,
    }),
    true,
  );
});

test("controle de instalar continua depois de dispensar o banner", () => {
  assert.equal(
    shouldOfferInstallControl({ standalone: false, canPrompt: true, iosSafari: false }),
    true,
  );
  assert.equal(
    shouldOfferInstallControl({ standalone: true, canPrompt: true, iosSafari: true }),
    false,
  );
  assert.equal(
    shouldOfferInstallControl({ standalone: false, canPrompt: false, iosSafari: true }),
    true,
  );
  assert.equal(
    shouldOfferInstallControl({ standalone: false, canPrompt: false, iosSafari: false }),
    false,
  );
});

test("offline força documento; 4G no desktop não", () => {
  assert.equal(
    shouldForceDocumentNavigation({ online: false, pathname: "/estoque/hb20" }),
    true,
  );
  assert.equal(
    shouldForceDocumentNavigation({ online: true, pathname: "/estoque" }),
    false,
  );
  assert.equal(
    shouldForceDocumentNavigation({
      online: true,
      effectiveType: "2g",
      pathname: "/estoque",
    }),
    true,
  );
  assert.equal(
    shouldForceDocumentNavigation({
      online: true,
      effectiveType: "2g",
      pathname: "/estoque/hb20",
    }),
    false,
  );
  assert.equal(
    shouldForceDocumentNavigation({ online: false, pathname: "/admin/veiculos" }),
    false,
  );
  assert.equal(PWA_START_URL.includes("utm_source=pwa"), true);
  assert.match(installCaptureScript(), new RegExp(INSTALL_DISMISS_KEY));
  assert.match(installCaptureScript(), /beforeinstallprompt/);
});
