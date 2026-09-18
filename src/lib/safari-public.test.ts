import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function src(rel: string) {
  return readFileSync(join(process.cwd(), "src", rel), "utf8");
}

test("rede de segurança: input/select/textarea ≥ 16px no WebKit touch", () => {
  const css = src("app/globals.css");
  assert.match(css, /pointer:\s*coarse/);
  assert.match(css, /-webkit-touch-callout:\s*none/);
  assert.match(css, /font-size:\s*16px\s*!important/);
  assert.match(css, /input:-webkit-autofill/);
});

test("máscaras e altura de aba usam prefixo WebKit / dvh", () => {
  const css = src("app/globals.css");
  assert.match(css, /-webkit-mask-image/);
  assert.match(css, /\.min-h-app-screen/);
  assert.match(css, /min-height:\s*100dvh/);
  assert.match(css, /\.gallery-strip/);
  assert.match(css, /overscroll-behavior:\s*contain/);
});

test("chat no iPad não ignora o teclado por breakpoint de 1024px", () => {
  const chat = src("components/site/SiteChat.tsx");
  assert.match(chat, /chatKeyboardShellStyle/);
  assert.doesNotMatch(
    chat,
    /if \(window\.matchMedia\("\(min-width: 1024px\)"\)\.matches\) \{\s*document\.body\.removeAttribute\("data-chat-keyboard"\)/,
  );
  const css = src("app/globals.css");
  assert.match(
    css,
    /body\[data-chat-keyboard\] \.site-chat\.is-open \.site-chat-panel/,
  );
});

test("layout público e filtros do estoque não dependem de 100vh", () => {
  const layout = src("app/(site)/layout.tsx");
  const filters = src("components/site/StockFilters.tsx");
  const offline = src("app/offline/page.tsx");
  assert.match(layout, /min-h-app-screen/);
  assert.doesNotMatch(layout, /min-h-screen/);
  assert.match(filters, /100dvh/);
  assert.doesNotMatch(filters, /100vh/);
  assert.match(offline, /min-h-app-screen/);
});

test("lightbox da ficha não usa scrollIntoView (empurra a aba no iOS)", () => {
  const lightbox = src("components/site/PhotoLightbox.tsx");
  assert.doesNotMatch(lightbox, /scrollIntoView\s*\(/);
  assert.match(lightbox, /strip\.scrollTo/);
  assert.match(lightbox, /pt-safe/);
});

test("galeria da ficha contém overscroll e faixa horizontal", () => {
  const gallery = src("components/site/VehicleGallery.tsx");
  assert.match(gallery, /gallery-strip/);
  assert.match(gallery, /safe-area-inset-left/);
  assert.match(gallery, /active:border-brand/);
});
