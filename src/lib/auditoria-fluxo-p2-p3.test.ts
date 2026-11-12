import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("Auditoria Fluxo #14: 'Pular para o conteúdo' vem antes do cabeçalho", () => {
  const layout = read("src/app/(site)/layout.tsx");
  assert.ok(layout.indexOf("Pular para o conteúdo") < layout.indexOf("<SiteHeader />"));
});

test("Auditoria Fluxo #15: texto do banner de cookies é claro para o visitante", () => {
  const cookieBanner = read("src/components/CookieConsent.tsx");
  assert.match(cookieBanner, /Usamos cookies para medir visitas e anúncios/);
  assert.match(cookieBanner, /Privacidade/);
  assert.doesNotMatch(cookieBanner, /Meta\/GA4/);
});

test("Auditoria Fluxo #10: marca/modelo sem estoque mostra Avise-me e alternativas", () => {
  const landing = read("src/components/site/StockLanding.tsx");
  assert.match(landing, /WantedVehicleCta[^>]*initialWanted=\{link\.label\}/);
  assert.match(landing, /getFeaturedVehicles\(3\)/);
});
