import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CookieConsent } from "@/components/CookieConsent";
import { consentBootstrapScript } from "./consent";
test("aviso já existe no HTML inicial, antes da hidratação", () => {
  assert.match(renderToStaticMarkup(createElement(CookieConsent)), /Consentimento de cookies/);
});
test("primeiro render é igual mesmo com aceite salvo no navegador", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const server = renderToStaticMarkup(createElement(CookieConsent));
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: { getItem: () => "accepted" } },
    });
    assert.equal(renderToStaticMarkup(createElement(CookieConsent)), server);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
test("escolha válida é reconhecida antes da pintura e armazenamento bloqueado não libera consentimento", () => {
  for (const saved of ["accepted", "essential", "invalid", null]) {
    const dataset: Record<string,string> = {};
    runInNewContext(consentBootstrapScript(), {localStorage:{getItem:()=>saved},document:{documentElement:{dataset}}});
    assert.equal(dataset.consent, saved === "accepted" || saved === "essential" ? saved : undefined);
  }
  const dataset = {};
  assert.doesNotThrow(()=>runInNewContext(consentBootstrapScript(), {localStorage:{getItem:()=>{throw Error("Bloqueado")}},document:{documentElement:{dataset}}}));
  assert.deepEqual(dataset, {});
});
