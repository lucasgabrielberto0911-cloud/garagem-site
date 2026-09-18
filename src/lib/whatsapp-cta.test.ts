import assert from "node:assert/strict";
import { test } from "node:test";
import { WHATSAPP_MESSAGES } from "./site";
import { pageWhatsAppHref, pageWhatsAppMessage } from "./whatsapp-cta";

const civic = {
  id: "cuidCivic",
  label: "Honda Civic",
  brand: "Honda",
  model: "Civic",
  version: "EXL",
  year: 2020,
  price: 89900,
  path: "/estoque/honda-civic-exl-2020-abc",
  category: "carro" as const,
};

test("mensagem do chrome na ficha fala do carro, não o recado genérico", () => {
  const text = pageWhatsAppMessage(civic);
  assert.match(text, /Honda Civic EXL 2020/);
  assert.match(text, /quero saber mais/);
  assert.doesNotMatch(text, /gostaria de mais informações/);
  assert.equal(pageWhatsAppMessage(null), WHATSAPP_MESSAGES.general);
  assert.equal(
    pageWhatsAppMessage({ ...civic, sold: true }),
    WHATSAPP_MESSAGES.general,
  );
});

test("href do chrome na ficha leva campaign ficha e utm_content do slug", () => {
  const href = pageWhatsAppHref({
    pathname: "/estoque/honda-civic-exl-2020-abc",
    vehicle: civic,
  });
  assert.match(href, /utm_campaign=ficha/);
  assert.match(href, /utm_content=honda-civic-exl-2020-abc/);
  assert.match(decodeURIComponent(href), /Honda Civic EXL 2020/);

  const beforeHydrate = pageWhatsAppHref({
    pathname: "/estoque/honda-civic-exl-2020-abc",
  });
  assert.match(beforeHydrate, /utm_campaign=ficha/);
  assert.match(beforeHydrate, /utm_content=honda-civic-exl-2020-abc/);
  assert.match(
    decodeURIComponent(beforeHydrate),
    /gostaria de mais informações/,
  );

  const home = pageWhatsAppHref({ pathname: "/" });
  assert.match(home, /utm_campaign=home/);
  assert.doesNotMatch(home, /utm_content=/);

  const leaked = pageWhatsAppHref({
    pathname: "/",
    vehicle: civic,
  });
  assert.match(leaked, /utm_campaign=home/);
  assert.doesNotMatch(leaked, /utm_content=/);
  assert.match(decodeURIComponent(leaked), /gostaria de mais informações/);
});
