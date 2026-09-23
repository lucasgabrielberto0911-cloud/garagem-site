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

test("ficha pública não oferece JPG e chama a checagem de vistoria da loja", () => {
  const gallery = readSrc("components/site/VehicleGallery.tsx");
  const lightbox = readSrc("components/site/PhotoLightbox.tsx");
  const page = readSrc("app/(site)/estoque/[id]/page.tsx");
  const dossier = readSrc("components/site/VehicleMobileDossier.tsx");
  const filters = readSrc("components/site/StockFilters.tsx");
  const admin = readSrc("components/admin/VehiclePhotoManager.tsx");

  for (const file of [gallery, lightbox, page, dossier, filters]) {
    assert.doesNotMatch(file, /Baixar JPG/);
    assert.doesNotMatch(file, /publicPhotoJpgPath/);
    assert.doesNotMatch(file, /versão leve/);
    assert.doesNotMatch(file, /salva a versão/);
    assert.doesNotMatch(file, /para Marketplace/);
  }
  assert.doesNotMatch(gallery, /WebP/);
  assert.doesNotMatch(gallery, /clique para ampliar/);
  assert.doesNotMatch(gallery, /Toque na foto para ampliar/);
  assert.doesNotMatch(lightbox, /Baixar esta foto/);
  assert.match(page, /STORE_INSPECTION_LABEL/);
  assert.match(dossier, /STORE_INSPECTION_LABEL/);
  assert.match(dossier, /vistoria da loja/i);
  assert.match(filters, /Com vistoria da loja/);
  assert.doesNotMatch(filters, /Com laudo/);
  assert.match(admin, /Baixar JPG em alta qualidade/);
});

test("chip Ajuda no mobile ganha folga acima da nav fora da ficha", () => {
  const css = readSrc("app/globals.css");
  assert.match(
    css,
    /body:not\(:has\(\[data-ficha-page\]\)\):not\(:has\(\[data-vehicle-mobile-bar\]\)\):not\(:has\(\.site-consent\)\) \.pb-site-nav/,
  );
});
