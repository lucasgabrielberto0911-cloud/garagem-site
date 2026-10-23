import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FiltroCidade } from "./FiltroCidade";

test("cidade do link compartilhado fica selecionada nos controles acessíveis", () => {
  const html = renderToStaticMarkup(createElement(FiltroCidade, { value: "vitoria", onChange: () => {} }));
  assert.match(html, /role="group" aria-label="Filtrar por cidade"/);
  assert.match(html, /aria-pressed="true"[^>]*>Vitória<\/button>/);
  assert.match(html, /<option value="vitoria" selected="">Vitória<\/option>/);
  assert.match(html, /<label for="estoque-cidade"/);
});
