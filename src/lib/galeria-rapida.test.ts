import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { VehicleGallery } from "@/components/site/VehicleGallery";

test("galeria da ficha carrega 1ª, 2ª e 3ª foto com loading eager (sem lazy) e não baixa todas de uma vez", () => {
  const photos = ["a", "b", "c", "d", "e"].map((id) => ({
    id,
    url: `https://pub-teste.r2.dev/${id}-g800.webp`,
  }));

  const html = renderToStaticMarkup(
    createElement(VehicleGallery, { photos, alt: "Fiat Strada" }),
  );

  const slides = html.match(/<li\b[\s\S]*?<\/li>/g) ?? [];
  assert.equal(slides.length, 5);

  // Slide 0 (capa), 1 (2ª) e 2 (3ª) já vêm montados e com loading="eager".
  for (const idx of [0, 1, 2]) {
    assert.match(slides[idx], /<img\b/, `slide ${idx} deve renderizar <img>`);
    assert.doesNotMatch(slides[idx], /loading="lazy"/, `slide ${idx} não pode ter loading="lazy"`);
    assert.match(slides[idx], /loading="eager"/, `slide ${idx} deve ter loading="eager"`);
  }

  // Slides distantes (3 e 4) ainda não baixam na abertura.
  for (const idx of [3, 4]) {
    assert.doesNotMatch(slides[idx], /<img\b/, `slide ${idx} não deve baixar na abertura`);
    assert.doesNotMatch(slides[idx], /bg-asphalt/, `slide ${idx} não deve usar fundo preto`);
  }

  // Apenas a capa tem alta prioridade; vizinhas baixam sem disputar o LCP.
  assert.match(slides[0], /fetchPriority="high"/);
  assert.doesNotMatch(slides[1], /fetchPriority="high"/);
  assert.doesNotMatch(slides[2], /fetchPriority="high"/);
});
