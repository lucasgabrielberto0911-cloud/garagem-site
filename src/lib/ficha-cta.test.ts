import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { VehicleInspectionBadge } from "@/components/site/VehicleInspectionBadge";
import { VehicleMobileBlocks, VehicleMobileSummary } from "@/components/site/VehicleMobileDossier";
import { FavoritesProvider } from "@/lib/favorites";
import { DEFAULT_GOOGLE_REVIEWS } from "@/lib/google-reviews";
import { DEFAULT_VEHICLE_CONDITIONS } from "@/lib/vehicle-conditions";
import type { VehicleSpecRow } from "@/lib/vehicle-specs";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

test("CTAs da ficha passam pelo helper ficha — não reutilizam home", () => {
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  const bar = readSrc("components/site/VehicleMobileBar.tsx");
  const actions = readSrc("components/site/VehicleQuickActions.tsx");

  assert.match(page, /fichaWhatsAppTracking/);
  assert.match(page, /data-ficha-page/);
  assert.doesNotMatch(page, /whatsappUrl\(\)/);
  assert.doesNotMatch(page, /campaign="home"/);

  assert.match(bar, /fichaWhatsAppTracking/);
  assert.match(bar, /Tenho interesse/);
  assert.match(bar, /Mais opções/);
  assert.match(bar, /no WhatsApp/);
  assert.doesNotMatch(bar, /IntersectionObserver/);
  assert.doesNotMatch(bar, /translate-y-full/);
  assert.doesNotMatch(bar, /campaign:\s*"home"/);

  assert.match(actions, /fichaWhatsAppTracking/);
  assert.match(actions, /hidden lg:grid/);
});

test("Ajuda na ficha é in-page, sem sticky no topo e sem FAB duplicado", () => {
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  const css = readSrc("app/globals.css");

  assert.doesNotMatch(page, /sticky[\s\S]{0,200}ChatOpenButton/);
  assert.doesNotMatch(page, /source="ficha-header"/);
  assert.match(page, /source="ficha"/);
  assert.match(page, /variant="outline"/);
  assert.ok(
    page.indexOf("<WhatsAppButton") < page.indexOf("<ChatOpenButton"),
    "WhatsApp precisa vir antes do chat na ficha",
  );

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

  assert.match(header, /usePageWhatsAppTarget/);
  assert.match(float, /usePageWhatsAppTarget/);
  assert.match(footer, /whatsappUrl\(\)/);
  assert.doesNotMatch(footer, /usePageWhatsAppHref/);
});

test("ficha pública não oferece JPG e chama a checagem de vistoria da loja", () => {
  const gallery = readSrc("components/site/VehicleGallery.tsx");
  const lightbox = readSrc("components/site/PhotoLightbox.tsx");
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
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
  assert.match(gallery, /index === active \|\|/);
  assert.match(gallery, /showThumbs/);
  assert.match(gallery, /GALLERY_HERO_SIZES/);
  assert.match(
    readSrc("lib/stock-query.ts"),
    /GALLERY_HERO_SIZES =\s*\n\s*"\(min-width: 1280px\) 710px, \(min-width: 1024px\) calc\(\(100vw - 96px\) \* 0\.6\), \(min-width: 640px\) 100vw, 60vw"/,
  );
  assert.match(gallery, /sizes="96px"/);
  assert.match(header, /headerWordmarkPriority\(pathname\)/);
  assert.doesNotMatch(gallery, /downloadAttachment/);
});

test("dobra da ficha não cresce quando a barra do navegador volta", () => {
  const css = readSrc("app/globals.css");
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  const start = css.indexOf(".ficha-mobile-fold {");
  const fold = css.slice(start, start + 500);
  assert.match(fold, /100svh/);
  assert.match(fold, /--ficha-sticky-bar/);
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
  assert.doesNotMatch(html, /Chave reserva/);
  assert.doesNotMatch(html, /Manual do proprietário/);
  assert.doesNotMatch(html, /Vídeo sob pedido/);
  assert.doesNotMatch(html, /Confirmado neste anúncio/i);
  assert.doesNotMatch(html, /Equipamentos/);
  assert.doesNotMatch(html, /e mais \d/);

  const vistoria = blocks.find((block) => block.title === "Vistoria da loja");
  assert.match(vistoria?.body ?? "", /óleo/i);
  assert.match(vistoria?.body ?? "", /fluidos/i);
  assert.doesNotMatch(vistoria?.body ?? "", /documento oficial/i);
  assert.doesNotMatch(html, /documento oficial/i);
  assert.doesNotMatch(readSrc("components/site/VehicleMobileDossier.tsx"), /gap-px/);
});

test("ficha pública não mostra confirmado neste anúncio nem equipamentos", () => {
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  const dossier = readSrc("components/site/VehicleMobileDossier.tsx");
  assert.doesNotMatch(page, /Confirmado neste anúncio/i);
  assert.doesNotMatch(dossier, /Confirmado neste anúncio/i);
  assert.doesNotMatch(page, /VehicleDossierChips/);
  assert.doesNotMatch(dossier, /VehicleDossierChips/);
  assert.doesNotMatch(page, /VehiclePurchaseFacts/);
  assert.doesNotMatch(dossier, /VehiclePurchaseFacts/);
  assert.doesNotMatch(page, /Equipamentos/);
  assert.doesNotMatch(dossier, /Equipamentos/);
  assert.doesNotMatch(page, /e mais \$\{/);
  assert.doesNotMatch(page, /VehicleDocument/);
  assert.doesNotMatch(dossier, /VehicleDocument/);
  assert.doesNotMatch(page, /Consignado/);
  assert.doesNotMatch(dossier, /Consignado/);
  assert.match(page, /VehicleTrustNotes/);
  assert.match(page, /VehicleInspectionBadge/);
  assert.match(page, /Tenho interesse/);
  assert.match(page, /Abre o WhatsApp com este anúncio — modelo, ano e preço\./);
  assert.match(dossier, /VehicleTrustNotes/);

  const trustAt = page.indexOf("<VehicleTrustNotes");
  const interestAt = page.indexOf("Tenho interesse");
  assert.ok(trustAt >= 0 && interestAt > trustAt);

  const html = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleMobileBlocks, {
        fullLabel: "Renault Sandero",
        path: "/estoque/sandero",
        sold: false,
        price: 54900,
        yearModel: 2018,
        make: "Renault",
        model: "Sandero",
        vehicleId: "v1",
        accessories: [
          "Ar-condicionado",
          "Direção hidráulica",
          "Media Nav 7",
          "Bluetooth",
          "USB",
        ],
        specs: [{ label: "Combustível", value: "Flex" }],
        inspection: "Cautelar aprovado",
        conditions: DEFAULT_VEHICLE_CONDITIONS,
        google: DEFAULT_GOOGLE_REVIEWS,
        prompt: "dúvida",
      }),
    ),
  );

  assert.doesNotMatch(html, /Confirmado neste anúncio/i);
  assert.doesNotMatch(html, /Chave reserva/);
  assert.doesNotMatch(html, /Manual do proprietário/);
  assert.doesNotMatch(html, /Vídeo sob pedido/);
  assert.doesNotMatch(html, /Equipamentos/);
  assert.doesNotMatch(html, /e mais \d/);
  assert.match(html, /Garantia de 3 meses/);
  assert.match(html, /Documentação pronta/);
  assert.doesNotMatch(html, /Procedência verificada/);
  assert.match(html, /Atendimento online 8h–23h/);
  assert.match(html, /Cautelar aprovado/);
  assert.doesNotMatch(html, /Consignado/);
  const items = html.match(/<details([^>]*)>([\s\S]*?)<\/details>/g) ?? [];
  const accessories = items.find((block) => block.includes("Itens e acessórios")) ?? "";
  assert.match(accessories, /Ar-condicionado/);
  assert.match(accessories, /Direção hidráulica/);
});

test("final da placa só aparece na dobra quando o anúncio tem", () => {
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  const dossier = readSrc("components/site/VehicleMobileDossier.tsx");
  assert.match(page, /plateEnd=\{vehicle\.plateEnd\}/);
  assert.match(dossier, /Final da placa/);

  const props = {
    title: "Civic",
    price: 89900,
    sold: false,
    year: 2020,
    yearModel: 2021,
    km: 42000,
    transmission: "Automático",
    city: "Serra",
  };
  const withPlate = renderToStaticMarkup(
    createElement(VehicleMobileSummary, { ...props, plateEnd: "  7  " }),
  );
  assert.match(withPlate, /Final da placa/);
  assert.match(withPlate, />7</);
  assert.doesNotMatch(withPlate, /Não informad/);

  const without = renderToStaticMarkup(
    createElement(VehicleMobileSummary, { ...props, plateEnd: "   " }),
  );
  assert.doesNotMatch(without, /Final da placa/);
  assert.doesNotMatch(without, /Serra|Cidade/);
});

test("selo da vistoria aparece perto do preço e some sem texto", () => {
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  const summary = readSrc("components/site/VehicleMobileDossier.tsx");
  assert.match(page, /VehicleInspectionBadge/);
  assert.match(page, /inspection=\{vehicle\.inspection\}/);
  assert.match(page, /inspection=\{sold \? null : vehicle\.inspection\}/);
  assert.match(summary, /VehicleInspectionBadge/);
  assert.doesNotMatch(page, /Consignado/);
  assert.doesNotMatch(summary, /Consignado/);

  const props = {
    title: "Honda Civic LXR 2.0",
    price: 89900,
    sold: false,
    year: 2014,
    yearModel: 2015,
    km: 106000,
    transmission: "Automático",
    city: "Linhares",
  };
  const withBadge = renderToStaticMarkup(
    createElement(VehicleMobileSummary, {
      ...props,
      inspection: "Cautelar aprovado",
    }),
  );
  const badgeAt = withBadge.indexOf("data-inspection-badge");
  const priceAt = withBadge.indexOf("R$");
  const specsAt = withBadge.indexOf(">Ano<");
  assert.ok(badgeAt > priceAt, "o selo fica depois do preço");
  assert.ok(badgeAt < specsAt, "o selo fica antes da grade de ano e km");
  assert.match(withBadge, /Cautelar aprovado/);
  assert.doesNotMatch(withBadge, /Consignado/);

  const empty = renderToStaticMarkup(
    createElement(VehicleMobileSummary, { ...props, inspection: "   " }),
  );
  assert.doesNotMatch(empty, /data-inspection-badge/);
  assert.doesNotMatch(empty, /Cautelar aprovado/);
  assert.doesNotMatch(empty, /Checagem interna/);

  const missing = renderToStaticMarkup(
    createElement(VehicleMobileSummary, props),
  );
  assert.doesNotMatch(missing, /data-inspection-badge/);

  const sold = renderToStaticMarkup(
    createElement(VehicleMobileSummary, {
      ...props,
      sold: true,
      inspection: "Cautelar aprovado",
    }),
  );
  assert.doesNotMatch(sold, /data-inspection-badge/);

  const desktop = renderToStaticMarkup(
    createElement(VehicleInspectionBadge, { inspection: "Cautelar aprovado" }),
  );
  assert.match(desktop, /data-inspection-badge/);
  assert.match(desktop, /Cautelar aprovado/);
  assert.equal(
    renderToStaticMarkup(
      createElement(VehicleInspectionBadge, { inspection: null }),
    ),
    "",
  );
  assert.equal(
    renderToStaticMarkup(
      createElement(VehicleInspectionBadge, { inspection: "" }),
    ),
    "",
  );
});

test("ficha desktop não soma padding grande sob o header", () => {
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
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

test("chip Ajuda no mobile ganha folga acima da nav e do próprio chip", () => {
  const css = readSrc("app/globals.css");
  assert.match(css, /--help-bubble-h:\s*2\.75rem/);
  assert.match(css, /--help-bubble-clear:\s*1\.25rem/);
  assert.match(
    css,
    /body:not\(:has\(\[data-ficha-page\]\)\):not\(:has\(\[data-vehicle-mobile-bar\]\)\):not\(:has\(\.site-consent\)\) \.pb-site-nav/,
  );
  assert.match(
    css,
    /padding-bottom:\s*calc\(\s*var\(--site-bottom-nav\)\s*\+\s*var\(--help-bubble-gap\)\s*\+\s*var\(--help-bubble-h\)\s*\+\s*var\(--help-bubble-clear\)/,
  );
  assert.doesNotMatch(css, /4\.5rem \+ 4\.25rem/);
});
