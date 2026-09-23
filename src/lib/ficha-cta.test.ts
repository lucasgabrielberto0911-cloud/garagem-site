import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { VehicleMobileBlocks } from "@/components/site/VehicleMobileDossier";
import { FavoritesProvider } from "@/lib/favorites";
import { DEFAULT_GOOGLE_REVIEWS } from "@/lib/google-reviews";
import { DEFAULT_VEHICLE_CONDITIONS } from "@/lib/vehicle-conditions";
import type { VehicleSpecRow } from "@/lib/vehicle-specs";

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
  const bar = readSrc("components/site/VehicleMobileBar.tsx");

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
  assert.doesNotMatch(lightbox, /toque duas vezes para ampliar/);
  assert.doesNotMatch(lightbox, /Deslize ou use as setas/);
  assert.doesNotMatch(dossier, /tone="whatsapp"/);
  assert.doesNotMatch(dossier, /whatsapp-btn/);
  assert.doesNotMatch(bar, /whatsapp-btn/);
  assert.match(bar, /bg-brand/);
  assert.match(dossier, /STORE_INSPECTION_LABEL/);
  assert.match(dossier, /vistoria da loja/i);
  assert.match(filters, /Com vistoria da loja/);
  assert.doesNotMatch(filters, /Com laudo/);
  assert.match(admin, /Baixar JPG em alta qualidade/);
});

test("primeira foto da galeria é a única com prioridade alta", () => {
  const gallery = readSrc("components/site/VehicleGallery.tsx");
  const header = readSrc("components/site/SiteHeader.tsx");
  assert.match(gallery, /priority=\{index === 0\}/);
  assert.match(gallery, /sizes="\(min-width: 1024px\) 60vw, 100vw"/);
  assert.match(gallery, /sizes="96px"/);
  assert.match(header, /headerWordmarkPriority\(pathname\)/);
  assert.doesNotMatch(gallery, /downloadAttachment/);
});

test("dobra da ficha não cresce quando a barra do navegador volta", () => {
  const css = readSrc("app/globals.css");
  const page = readSrc("app/(site)/estoque/[id]/page.tsx");
  const start = css.indexOf(".ficha-mobile-fold {");
  const fold = css.slice(start, start + 500);
  assert.match(fold, /100svh/);
  assert.match(fold, /overflow-anchor:\s*none/);
  assert.doesNotMatch(fold, /100dvh/);
  assert.match(page, /ficha-mobile-fold min-w-0/);
  assert.doesNotMatch(page, /lg:contents/);
});

test("sobre e itens começam abertos; vistoria e ficha ficam fechadas", () => {
  const dossier = readSrc("components/site/VehicleMobileDossier.tsx");
  const conditions = readSrc("lib/vehicle-conditions.ts");
  const blocks = [...dossier.matchAll(/<DossierBlock\b([^>]*)>/g)].map(
    (match) => match[1] ?? "",
  );
  const openBlocks = blocks.filter((attrs) => /\bdefaultOpen\b/.test(attrs));

  assert.equal(openBlocks.length, 2);
  assert.match(openBlocks[0] ?? "", /Sobre o veículo/);
  assert.match(openBlocks[1] ?? "", /Itens e acessórios/);
  assert.match(dossier, /<details\b[^>]*\bopen=\{defaultOpen\}/);
  assert.match(dossier, /publicStoreInspectionText/);
  assert.doesNotMatch(dossier, /Não é documento oficial/);
  assert.doesNotMatch(conditions, /Não é documento oficial/);
  assert.match(conditions, /óleo/);

  const vistoria = blocks.find((attrs) => attrs.includes("STORE_INSPECTION_LABEL"));
  const ficha = blocks.find((attrs) => attrs.includes('"Ficha"'));
  assert.ok(vistoria);
  assert.doesNotMatch(vistoria ?? "", /\bdefaultOpen\b/);
  assert.ok(ficha);
  assert.doesNotMatch(ficha ?? "", /\bdefaultOpen\b/);
});

test("html mobile deixa sobre e acessórios visíveis, com cidade na ficha", () => {
  const specs: VehicleSpecRow[] = [
    { label: "Ano", value: "2014/2015" },
    { label: "KM", value: "106.000" },
    { label: "Câmbio", value: "Automático" },
    { label: "Tipo", value: "Carro" },
    { label: "Combustível", value: "Flex" },
    { label: "Cor", value: "Prata" },
    { label: "Motor", value: "2.0 FlexOne I-VTEC" },
    { label: "Portas", value: "4" },
    { label: "Cidade", value: "Linhares" },
  ];
  const html = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleMobileBlocks, {
        fullLabel: "Honda HR-V",
        path: "/estoque/hrv",
        sold: false,
        price: 84900,
        yearModel: 2016,
        make: "Honda",
        model: "HR-V",
        vehicleId: "v1",
        description: [
          "🔥 NOVIDADE NO ESTOQUE DA GARAGEM!",
          "",
          "Sedã médio automático, motor 2.0 e acabamento LXR.",
          "",
          "📊 Quilometragem: 106.000 km",
        ].join("\n"),
        accessories: ["Ar-condicionado", "Direção elétrica"],
        specs,
        inspection: "Não é documento oficial de inspeção.",
        conditions: {
          ...DEFAULT_VEHICLE_CONDITIONS,
          items: DEFAULT_VEHICLE_CONDITIONS.items.map((item) =>
            item.label === "Vistoria da loja"
              ? {
                  ...item,
                  text: "Antes de entrar no estoque, o seminovo passa pela vistoria da loja: checagem interna de procedência e condição geral. Não é documento oficial de inspeção.",
                }
              : item,
          ),
        },
        google: DEFAULT_GOOGLE_REVIEWS,
        prompt: "dúvida",
        quickActions: {
          contentPath: "/estoque/hrv",
          video: "video",
          finance: "finance",
          trade: "trade",
        },
      }),
    ),
  );
  const blocks = [...html.matchAll(/<details([^>]*)>([\s\S]*?)<\/details>/g)].map(
    (match) => ({
      open: /\sopen=""/.test(match[1] ?? ""),
      title: match[2]?.match(/<span>([^<]+)<\/span>/)?.[1] ?? "",
      body: match[2] ?? "",
    }),
  );

  assert.deepEqual(
    blocks.map((block) => [block.title, block.open]),
    [
      ["Vistoria da loja", false],
      ["Ficha", false],
      ["Sobre o veículo", true],
      ["Itens e acessórios", true],
      ["Garantia e condições", false],
      ["Vídeo e propostas", false],
      ["Atendimento", false],
    ],
  );
  const accessories = blocks.find((block) => block.title === "Itens e acessórios");
  assert.match(accessories?.body ?? "", /Ar-condicionado/);
  assert.match(accessories?.body ?? "", /Direção elétrica/);

  const about = blocks.find((block) => block.title === "Sobre o veículo");
  assert.match(about?.body ?? "", /NOVIDADE NO ESTOQUE DA GARAGEM/);
  assert.match(about?.body ?? "", /106\.000 km/);
  assert.match(about?.body ?? "", /Sedã médio automático/);
  assert.match(about?.body ?? "", /<ul/);

  const ficha = blocks.find((block) => block.title === "Ficha");
  const fichaBody = ficha?.body ?? "";
  assert.match(fichaBody, /Portas/);
  assert.match(fichaBody, /Cidade/);
  assert.match(fichaBody, /Linhares/);
  assert.ok(
    fichaBody.indexOf("Portas") < fichaBody.indexOf("Cidade"),
    "Cidade precisa vir depois de Portas na grade",
  );
  assert.doesNotMatch(fichaBody, />Ano</);
  assert.doesNotMatch(fichaBody, />KM</);

  const vistoria = blocks.find((block) => block.title === "Vistoria da loja");
  assert.match(vistoria?.body ?? "", /óleo/i);
  assert.match(vistoria?.body ?? "", /fluidos/i);
  assert.doesNotMatch(vistoria?.body ?? "", /documento oficial/i);
  assert.doesNotMatch(html, /documento oficial/i);
  assert.doesNotMatch(readSrc("components/site/VehicleMobileDossier.tsx"), /gap-px/);
});

test("ficha desktop não soma padding grande sob o header", () => {
  const page = readSrc("app/(site)/estoque/[id]/page.tsx");
  const css = readSrc("app/globals.css");
  const wrapper = page.slice(
    page.indexOf("data-ficha-page"),
    page.indexOf("data-ficha-page") + 180,
  );
  assert.doesNotMatch(wrapper, /lg:py-/);
  assert.match(
    css,
    /body:has\(\[data-ficha-page\]\) \.pt-site-header \{\s*padding-top: calc\(4\.75rem \+ 1px \+ 0\.75rem\);/,
  );
  assert.match(css, /\.ficha-spec-grid > :last-child:nth-child\(odd\)/);
  const back = readSrc("components/site/StockBackLink.tsx");
  const textLink = back.slice(back.indexOf('variant === "overlay"'), back.indexOf("Voltar ao estoque"));
  assert.doesNotMatch(textLink, /min-h-\[44px\]/);
});

test("chip Ajuda no mobile ganha folga acima da nav fora da ficha", () => {
  const css = readSrc("app/globals.css");
  assert.match(
    css,
    /body:not\(:has\(\[data-ficha-page\]\)\):not\(:has\(\[data-vehicle-mobile-bar\]\)\):not\(:has\(\.site-consent\)\) \.pb-site-nav/,
  );
});
