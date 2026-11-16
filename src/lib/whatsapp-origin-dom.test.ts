import assert from "node:assert/strict";
import { test } from "node:test";
import { enrichWhatsAppAnchor, enrichWhatsAppAnchors, isSiteWhatsAppHref } from "./whatsapp-origin-dom";

test("identifica apenas links wa.me com utm_source=site", () => {
  assert.equal(
    isSiteWhatsAppHref("https://wa.me/5527996330706?text=Oi&utm_source=site&utm_medium=ficha"),
    true,
  );
  assert.equal(isSiteWhatsAppHref("https://wa.me/5527996330706?text=Oi"), false);
  assert.equal(isSiteWhatsAppHref("https://wa.me/5527996330706?utm_source=sites"), false);
});

test("enriquece links em lote de forma idempotente e remove origem quando consentimento é revogado", () => {
  const ficha = {
    href: "https://wa.me/5527996330706?text=Oi%21%20Vi%20o%20Civic.&utm_source=site&utm_medium=ficha",
  };
  const bare = { href: "https://wa.me/5527996330706?text=Compartilhar" };

  assert.equal(enrichWhatsAppAnchors([ficha, bare], "instagram"), 1);
  assert.match(new URL(ficha.href).searchParams.get("text") ?? "", /Vim pelo Instagram\.$/);
  assert.equal(bare.href, "https://wa.me/5527996330706?text=Compartilhar");

  // Reaplicar com a mesma origem não reescreve o DOM
  assert.equal(enrichWhatsAppAnchor(ficha, "instagram"), false);

  // Revogar consentimento limpa a origem de todos os links já enriquecidos
  assert.equal(enrichWhatsAppAnchors([ficha, bare], null), 1);
  assert.equal(new URL(ficha.href).searchParams.get("text"), "Oi! Vi o Civic.");
});
