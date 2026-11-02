import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccessoryChips } from "@/components/site/StockFilterControls";

const OPCOES = Array.from({ length: 12 }, (_, index) => `Item ${index + 1}`);

function renderizarAcessorios() {
  return renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement("p", { id: "rotulo-acessorios" }, "Acessórios"),
      createElement(AccessoryChips, {
        options: OPCOES,
        value: "",
        labelledBy: "rotulo-acessorios",
        onToggle: () => {},
      }),
    ),
  );
}

test("grupo de acessórios leva o nome do rótulo visível", () => {
  const html = renderizarAcessorios();
  assert.match(html, /role="group"/);
  assert.match(html, /aria-labelledby="rotulo-acessorios"/);
});

test("botão Ver mais declara o estado e controla a lista", () => {
  const html = renderizarAcessorios();
  assert.match(html, /aria-expanded="false"/);
  const controlado = html.match(/aria-controls="([^"]+)"/)?.[1];
  assert.ok(controlado, "o botão precisa apontar para a lista");
  assert.ok(html.includes(`id="${controlado}"`), "a lista controlada precisa existir");
});

test("a lista começa recolhida em oito chips e anuncia o resto", () => {
  const html = renderizarAcessorios();
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 8);
  assert.match(html, /Ver mais \(4\)/);
});
