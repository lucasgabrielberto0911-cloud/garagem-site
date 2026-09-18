import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

test("CTAs da ficha passam pelo helper ficha — não reutilizam home", () => {
  const page = readSrc("app/(site)/estoque/[id]/page.tsx");
  const bar = readSrc("components/site/VehicleMobileBar.tsx");
  const actions = readSrc("components/site/VehicleQuickActions.tsx");

  assert.match(page, /fichaWhatsAppTracking/);
  assert.match(page, /data-ficha-page/);
  assert.doesNotMatch(page, /whatsappUrl\(\)/);
  assert.doesNotMatch(page, /campaign="home"/);

  assert.match(bar, /fichaWhatsAppTracking/);
  assert.match(bar, /Tenho interesse/);
  assert.match(bar, /Mais opções/);
  assert.doesNotMatch(bar, /campaign:\s*"home"/);

  assert.match(actions, /fichaWhatsAppTracking/);
  assert.match(actions, /hidden lg:grid/);
});

test("Ajuda na ficha é in-page, sem sticky no topo e sem FAB duplicado", () => {
  const page = readSrc("app/(site)/estoque/[id]/page.tsx");
  const css = readSrc("app/globals.css");

  assert.doesNotMatch(page, /sticky[\s\S]{0,200}ChatOpenButton/);
  assert.doesNotMatch(page, /source="ficha-header"/);
  assert.match(page, /source="ficha"/);
  assert.match(page, /variant="solid"/);

  assert.match(
    css,
    /body:has\(\[data-ficha-page\]\) \.site-chat:not\(\.is-open\)/,
  );
  assert.match(
    css,
    /body:has\(\[data-vehicle-mobile-bar\]\) \.site-chat:not\(\.is-open\)/,
  );
});

test("header e float na ficha herdam o veículo; o rodapé genérico fica home", () => {
  const header = readSrc("components/site/SiteHeader.tsx");
  const float = readSrc("components/site/WhatsAppFloat.tsx");
  const footer = readSrc("components/site/SiteFooter.tsx");

  assert.match(header, /usePageWhatsAppHref/);
  assert.match(float, /usePageWhatsAppHref/);
  assert.match(footer, /whatsappUrl\(\)/);
  assert.doesNotMatch(footer, /usePageWhatsAppHref/);
});

test("chip Ajuda no mobile ganha folga acima da nav fora da ficha", () => {
  const css = readSrc("app/globals.css");
  assert.match(
    css,
    /body:not\(:has\(\[data-ficha-page\]\)\):not\(:has\(\[data-vehicle-mobile-bar\]\)\):not\(:has\(\.site-consent\)\) \.pb-site-nav/,
  );
});
