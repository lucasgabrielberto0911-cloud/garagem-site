import { site } from "@/lib/site";
import { visibleDescriptionSegments } from "@/components/site/VehicleDescription";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { VehicleInspectionBadge } from "@/components/site/VehicleInspectionBadge";
import { VehicleMobileBlocks, VehicleMobileSummary } from "@/components/site/VehicleMobileDossier";
import { VehicleTrustNotes } from "@/components/site/VehicleTrustNotes";
import { VehicleConditions } from "@/components/site/VehicleConditions";
import { VehicleVerifiedList } from "@/components/site/VehicleVerifiedInfo";
import { FavoritesProvider } from "@/lib/favorites";
import { DEFAULT_GOOGLE_REVIEWS } from "@/lib/google-reviews";
import { DEFAULT_VEHICLE_CONDITIONS } from "@/lib/vehicle-conditions";
import { buildVehiclePublicSpecs, vehicleColorFact, vehicleKeyFacts, type VehicleSpecRow } from "@/lib/vehicle-specs";
import { focusFichaSection } from "@/lib/ficha-sections";

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
  assert.match(bar, /Chamar no WhatsApp/);
  assert.doesNotMatch(bar, /Agendar visita|Financiamento, troca ou vídeo|formatCurrencyBRL/);
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
    /GALLERY_HERO_SIZES =\s*\n\s*"\(min-width: 1440px\) 704px, \(min-width: 1024px\) calc\(\(100vw - 96px\) \* 0\.524\), 100vw"/,
  );
  assert.match(gallery, /sizes="96px"/);
  assert.match(header, /headerWordmarkPriority\(pathname\)/);
  assert.doesNotMatch(gallery, /downloadAttachment/);
});

test("dobra da ficha tem foto 4:3 fixa e não cresce quando a barra do navegador volta", () => {
  const css = readSrc("app/globals.css");
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  const gallery = readSrc("components/site/VehicleGallery.tsx");
  const start = css.indexOf(".ficha-mobile-fold {");
  const fold = css.slice(start, css.indexOf("}", start));
  assert.match(fold, /overflow-anchor:\s*none/);
  assert.doesNotMatch(fold, /min-height|100dvh/);
  assert.match(page, /ficha-mobile-fold min-w-0/);
  assert.match(page, /lg:grid-cols-\[1\.1fr_1fr\]/);
  assert.doesNotMatch(page, /lg:contents/);
  assert.match(gallery, /gallery-frame relative aspect-\[4\/3\]/);
  assert.doesNotMatch(gallery, /aspect-\[16\/10\]/);
  // Faixa de miniaturas com altura reservada antes do JS; botão claro para abrir as fotos.
  assert.match(gallery, /hidden h-\[4\.25rem\] lg:block/);
  assert.match(gallery, /Ver as \$\{total\} fotos/);
});

test("blocos da ficha mobile ficam sempre abertos; só o saiba mais de vistoria e garantia fecha", () => {
  const dossier = readSrc("components/site/VehicleMobileDossier.tsx");
  const conditions = readSrc("lib/vehicle-conditions.ts");

  // Sem acordeão nos blocos principais; verificado vem antes de sobre.
  assert.doesNotMatch(dossier, /defaultOpen/);
  assert.doesNotMatch(dossier, /<details\b[^>]*\bopen=\{/);
  assert.match(dossier, /verified\.length > 0 \?\s*\(\s*<DossierBlock/);
  assert.ok(dossier.indexOf("verifiedHeading ??") < dossier.indexOf('title="Sobre o veículo"'));
  assert.match(dossier, /publicStoreInspectionText/);
  assert.match(dossier, /<VehicleTrustNotes warranty=\{warranty\} compact/);
  assert.doesNotMatch(dossier, /Não é documento oficial/);
  assert.doesNotMatch(conditions, /Não é documento oficial/);
  assert.match(conditions, /óleo/);
});

test("html mobile deixa sobre e acessórios visíveis, com cidade na ficha", () => {
  const specs: VehicleSpecRow[] = [
    { label: "Ano", value: "2014/2015" },
    { label: "km", value: "106.000" },
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
      createElement(VehicleMobileBlocks as unknown as React.ComponentType<Record<string, unknown>>, {
        address: site.address,
        hours: site.hours,
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
        quickActions: {
          contentPath: "/estoque/hrv",
          video: "video",
          finance: "finance",
          trade: "trade",
        },
      }),
    ),
  );
  const titles = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((match) => match[1]);
  assert.deepEqual(titles, [
    "Sobre o veículo",
    "Itens e acessórios",
    "Ficha técnica",
    "Próximos passos",
    "Onde estamos",
  ]);
  assert.match(html, /Linhares\/ES/);
  const details = [...html.matchAll(/<details([^>]*)>/g)];
  assert.equal(details.length, 1);
  assert.doesNotMatch(details[0]?.[1] ?? "", /\sopen=""/);

  const section = (title: string) => {
    const at = html.indexOf(`>${title}</h2>`);
    const next = html.indexOf("</section>", at);
    return html.slice(at, next);
  };
  const accessories = section("Itens e acessórios");
  assert.match(accessories, /Ar-condicionado/);
  assert.match(accessories, /Direção elétrica/);
  assert.match(html, /id="opcionais"/);

  const about = section("Sobre o veículo");
  assert.match(about, /NOVIDADE NO ESTOQUE DA GARAGEM/);
  assert.match(about, /Sedã médio automático/);
  // Specs ficam só na ficha técnica; emoji de enfeite sai.
  assert.doesNotMatch(about, /Quilometragem/);
  assert.doesNotMatch(about, /🔥|📊/);

  const fichaBody = section("Ficha técnica");
  assert.match(fichaBody, /Portas/);
  assert.match(fichaBody, /Cidade/);
  assert.match(fichaBody, /Linhares/);
  assert.ok(
    fichaBody.indexOf("Portas") < fichaBody.indexOf("Cidade"),
    "Cidade precisa vir depois de Portas na grade",
  );
  // Ficha técnica completa: ano, km, câmbio e cor ficam aqui (cor/ano/KM também no topo).
  assert.match(fichaBody, />Ano</);
  assert.match(fichaBody, />km</);
  assert.match(fichaBody, />Câmbio</);
  assert.match(fichaBody, />Combustível</);
  assert.match(fichaBody, />Cor</);

  // Nada de parcela nem simulador.
  const steps = section("Próximos passos");
  assert.match(steps, /Financiamento/);
  assert.match(steps, /Troca/);
  assert.match(steps, /Pedir vídeo/);
  assert.doesNotMatch(html, /parcela|simulador|simular/i);
  assert.doesNotMatch(html, /Chave reserva/);
  assert.doesNotMatch(html, /Manual do proprietário/);
  assert.doesNotMatch(html, /Vídeo sob pedido/);
  assert.doesNotMatch(html, /Confirmado neste anúncio/i);
  assert.doesNotMatch(html, /Equipamentos/);
  assert.doesNotMatch(html, /e mais \d/);

  const vistoria = details[0] ? html.slice(html.indexOf("<details"), html.indexOf("</details>")) : "";
  assert.match(vistoria, /óleo/i);
  assert.match(vistoria, /fluidos/i);
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
  assert.match(page, /Falar no WhatsApp/);
  assert.match(page, /Abre o WhatsApp com este anúncio — modelo, ano e preço\./);
  assert.match(dossier, /VehicleTrustNotes/);

  // Hierarquia de anúncio: o WhatsApp principal vem antes da faixa de confiança.
  const trustAt = page.indexOf("<VehicleTrustNotes");
  const interestAt = page.indexOf("Falar no WhatsApp");
  assert.ok(trustAt >= 0 && interestAt >= 0 && interestAt < trustAt);

  const html = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleMobileBlocks as unknown as React.ComponentType<Record<string, unknown>>, {
        address: site.address,
        hours: site.hours,
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
  assert.doesNotMatch(html, /Procedência verificada/);
  assert.match(html, /8h às 23h/);
  assert.match(html, /Cautelar aprovado/);
  assert.doesNotMatch(html, /Consignado/);
  const accessories = html.slice(html.indexOf(">Itens e acessórios</h2>"));
  assert.match(accessories, /Ar-condicionado/);
  assert.match(accessories, /Direção hidráulica/);
});

test("dobra do celular mostra ano, KM, câmbio, combustível e cor; final da placa vai para a ficha técnica", () => {
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  assert.match(page, /facts=\{keyFacts\}/);
  assert.match(page, /vehicleKeyFacts\(specs\)/);

  const specsFor = (plateEnd: string | null, color: string | null) =>
    buildVehiclePublicSpecs({
      category: "carro",
      year: 2012,
      yearModel: 2013,
      km: 98000,
      fuel: "Flex",
      transmission: "Manual",
      color,
      plateEnd,
    });
  const props = { title: "Fiat Uno", price: 29900, sold: false, city: "Serra" };
  const withPlate = specsFor("  7  ", "Branco");
  const summary = renderToStaticMarkup(
    createElement(VehicleMobileSummary, {
      ...props,
      facts: vehicleKeyFacts(withPlate),
      color: vehicleColorFact(withPlate),
    }),
  );
  assert.deepEqual(
    [...summary.matchAll(/<dt[^>]*>([^<]+)<\/dt>/g)].map((match) => match[1]),
    ["Ano", "KM", "Câmbio", "Combustível", "Cor"],
  );
  assert.match(summary, />Branco</);
  assert.match(summary, />2012\/<wbr\/>2013</);
  assert.match(summary, />98\.000</);
  assert.doesNotMatch(summary, /Final da placa|Serra|Cidade/);

  // Sem cor cadastrada, nada de "Não informada" no topo.
  assert.equal(vehicleColorFact(specsFor(null, null)), null);

  const blocks = (specs: VehicleSpecRow[]) =>
    renderToStaticMarkup(
      createElement(
        FavoritesProvider,
        null,
        createElement(VehicleMobileBlocks as unknown as React.ComponentType<Record<string, unknown>>, {
          address: site.address,
          hours: site.hours,
          fullLabel: "Fiat Uno",
          path: "/estoque/uno",
          sold: false,
          price: 29900,
          yearModel: 2013,
          make: "Fiat",
          model: "Uno",
          vehicleId: "v1",
          accessories: [],
          specs,
          conditions: DEFAULT_VEHICLE_CONDITIONS,
        }),
      ),
    );
  const plated = blocks(withPlate);
  assert.match(plated, /Final placa/);
  assert.match(plated, />7</);
  assert.doesNotMatch(blocks(specsFor("   ", "Branco")), /Final placa/);
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
    facts: [
      { label: "Cor", value: "Prata" },
      { label: "Ano", value: "2014/2015" },
      { label: "KM", value: "106.000" },
    ],
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
  assert.ok(specsAt > priceAt, "cor, ano e KM ficam logo abaixo do preço");
  assert.ok(badgeAt > specsAt, "o selo vem depois dos quadradinhos");
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

test("garantia compacta do desktop segue título, edição e itens ocultos do painel", () => {
  const render = (conditions: typeof DEFAULT_VEHICLE_CONDITIONS, warranty?: string) =>
    renderToStaticMarkup(
      createElement(VehicleConditions, { conditions, vehicleWarranty: warranty ?? null }),
    );

  const edited = render({
    title: "Garantia editada",
    intro: "",
    items: [
      { label: "Garantia", text: "Texto do painel" },
      { label: "Entrega", text: "   " },
      { label: "Documentação e transferência", text: "[PREENCHER]" },
    ],
  });
  assert.match(edited, /Garantia editada/);
  assert.match(edited, /Texto do painel/);
  assert.doesNotMatch(edited, /Entrega|Documentação|Motor e câmbio por 3 meses/);

  assert.match(
    render(DEFAULT_VEHICLE_CONDITIONS, "12 meses neste carro"),
    /12 meses neste carro/,
  );
  assert.equal(render({ title: "x", intro: "", items: [] }), "");
});

test("PR-5 ficha: lista verificada tem dica sutil de vídeo e dossiê mobile evita repetição de condições", () => {
  const verifiedMarkup = renderToStaticMarkup(
    createElement(VehicleVerifiedList, {
      items: [
        {
          key: "manutencao",
          label: "Revisões e manutenção",
          text: "Revisão na concessionária aos 40.000 km",
          photos: [],
        },
      ],
      alt: "Onix 2022",
    }),
  );
  assert.match(verifiedMarkup, /Revisão na concessionária/);
  assert.match(verifiedMarkup, /Quer ver algum detalhe específico\? Peça um vídeo pelo WhatsApp\./);

  const dossierSrc = readSrc("components/site/VehicleMobileDossier.tsx");
  assert.match(dossierSrc, /DEFAULT_VEHICLE_CONDITIONS\.intro/);

  const mobileMarkup = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleMobileBlocks as unknown as React.ComponentType<Record<string, unknown>>, {
        address: site.address,
        hours: site.hours,
        fullLabel: "Chevrolet Onix Premier",
        path: "/estoque/onix",
        sold: false,
        price: 79900,
        yearModel: 2022,
        make: "Chevrolet",
        model: "Onix",
        vehicleId: "v-onix",
        accessories: [],
        specs: [],
        conditions: DEFAULT_VEHICLE_CONDITIONS,
        warranty: "Garantia estendida de 1 ano",
      }),
    ),
  );
  assert.match(mobileMarkup, /Garantia estendida de 1 ano/);
  // Não duplica a introdução longa quando os itens de condições já estão presentes
  assert.doesNotMatch(mobileMarkup, /Todo seminovo passa por checagem na loja antes do anúncio/);
});


test("descrição no celular só tira linhas idênticas à ficha técnica", () => {
  const segments = visibleDescriptionSegments(
    ["✅ Cor: Prata", "✅ Histórico: único dono", "✅ Revisões: todas na concessionária"].join("\n"),
    undefined,
    [{ label: "Cor", value: "Prata" }],
  );
  const lines = segments.flatMap((segment) => (segment.kind === "facts" ? segment.lines.map((line) => line.text) : []));
  assert.deepEqual(lines, ["Histórico: único dono", "Revisões: todas na concessionária"]);
});

test("descrição tira a mini-grade repetida (Cor, Câmbio, Combustível, Motor) e mantém detalhe extra", () => {
  const specs = [
    { label: "Cor", value: "Prata" },
    { label: "Câmbio", value: "Automático" },
    { label: "Combustível", value: "Flex" },
    { label: "Motor", value: "1.5 16V" },
  ];
  const segments = visibleDescriptionSegments(
    [
      "🎨 Cor: Prata",
      "⚙️ Câmbio: Automático",
      "⛽ Combustível: Flex",
      "🛠️ Motor: 1.5",
      "✅ Histórico: único dono",
    ].join("\n"),
    undefined,
    specs,
  );
  const lines = segments.flatMap((segment) => (segment.kind === "facts" ? segment.lines.map((line) => line.text) : []));
  assert.deepEqual(lines, ["Histórico: único dono"]);
  const extra = visibleDescriptionSegments("⚙️ Câmbio: Automático CVT", undefined, specs);
  assert.equal(extra.length, 1);
});

test("parecidos na ficha não têm Tenho interesse, mas o estoque tem", () => {
  assert.match(readSrc("components/site/SimilarVehicles.tsx"), /<VehicleGrid[^>]*hideInterest/);
  assert.match(readSrc("components/site/VehicleCard.tsx"), /hideInterest \? null/);
  assert.doesNotMatch(readSrc("components/site/VehicleGrid.tsx"), /hideInterest = true/);
});

test("desktop: card da direita enxuto, ficha técnica e opcionais na coluna principal", () => {
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  const asideAt = page.indexOf('<aside className="ficha-aside');
  const asideEnd = page.indexOf("</aside>");
  const aside = page.slice(asideAt, asideEnd);
  const main = page.slice(0, asideAt);

  // Ficha técnica saiu do card sticky e fica sempre aberta ao lado da descrição.
  assert.doesNotMatch(aside, /specs\.map/);
  assert.doesNotMatch(aside, /data-ficha-section="especificacoes"/);
  assert.match(main, /data-ficha-section="especificacoes"/);
  // Ficha técnica completa na coluna principal (inclui ano, km, câmbio e cor).
  assert.match(main, /\{specs\.map\(\(spec\)/);
  assert.doesNotMatch(main, /<details/);
  const specsAt = main.indexOf('data-ficha-section="especificacoes"');
  const aboutAt = main.indexOf("Sobre o veículo");
  const itemsAt = main.indexOf("Itens e acessórios");
  assert.ok(specsAt > 0 && specsAt < aboutAt && aboutAt < itemsAt);

  // Opcionais: lista na coluna principal; o selo "N opcionais" do card é a âncora (sem linha extra).
  assert.match(main, /id="opcionais-desktop"/);
  assert.match(aside, /optionalsHref="#opcionais-desktop"/);
  assert.doesNotMatch(aside, /Ver os \$\{accessories\.length\} opcionais/);
  assert.doesNotMatch(page.slice(page.indexOf("<VehicleMobileBlocks")), /opcionais-desktop/);

  // Topo do card: nome, preço com destaque e os quadradinhos de cor/ano/KM.
  assert.match(aside, /text-brand-light/);
  assert.match(aside, /className="ficha-price"/);
  assert.match(aside, /<VehicleKeyFacts facts=\{keyFacts\}/);
  assert.ok(aside.indexOf("ficha-price") < aside.indexOf("<VehicleKeyFacts"));
  assert.ok(aside.indexOf("<VehicleKeyFacts") < aside.indexOf("Falar no WhatsApp"));

  // Um botão principal de WhatsApp; financiamento/troca/vídeo/visita recolhidos.
  assert.equal((aside.match(/<WhatsAppButton/g) ?? []).length, 2); // vendido + à venda
  assert.match(aside, /<details data-ficha-more-actions/);
  assert.match(aside, /variant="secondary"/);
  assert.match(aside, /variant="ghost"/);
  assert.match(aside, /variant="compact"/);
  assert.match(aside, /<VehicleTrustNotes/);

  // Sem parcela, simulador ou valor de financiamento no card.
  assert.doesNotMatch(aside, /calcula a parcela|parcela estimada|simul/i);
  assert.doesNotMatch(aside, /R\$\s*\d/);
});

test("faixa de confiança do desktop: garantia, vistoria da loja e Linhares/ES", () => {
  const html = renderToStaticMarkup(
    createElement(VehicleTrustNotes, { warranty: null }),
  );
  assert.match(html, /Garantia de 3 meses/);
  assert.match(html, /Vistoria da loja/);
  assert.match(html, /Linhares\/ES/);
  assert.doesNotMatch(html, /parcela/i);
});

test("garantia usa o dado do veículo nas duas telas e fala veículo, não carro", () => {
  const props = { title: "Honda CG", price: 15900, sold: false, facts: [] };
  const render = (warranty: string | null, sold = false) =>
    renderToStaticMarkup(createElement(VehicleMobileSummary, { ...props, sold, warranty }));

  const own = render("6 meses de motor");
  assert.match(own, /Garantia deste veículo: 6 meses de motor/);
  assert.doesNotMatch(own, /Garantia de 3 meses|deste carro/);
  assert.match(own, /Vistoria da loja/);
  assert.match(render(null), /Garantia de 3 meses/);
  assert.match(render("   "), /Garantia de 3 meses/);
  assert.doesNotMatch(render("6 meses de motor", true), /Garantia|Vistoria da loja/);

  const desktop = renderToStaticMarkup(
    createElement(VehicleTrustNotes, { warranty: "6 meses de motor" }),
  );
  assert.match(desktop, /Garantia deste veículo: 6 meses de motor/);
  assert.doesNotMatch(desktop, /Garantia de 3 meses/);
});

test("desktop rola junto: aba e card do anúncio sem sticky e sem coluna com scroll próprio", () => {
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  const css = readSrc("app/globals.css");
  const nav = readSrc("components/site/FichaSectionNav.tsx");
  const asideTag = page.slice(page.indexOf("<aside"), page.indexOf(">", page.indexOf("<aside")));
  assert.doesNotMatch(asideTag, /sticky/);
  assert.doesNotMatch(page, /overflow-y-(auto|scroll)/);
  const navRule = css.slice(css.indexOf(".ficha-section-nav {"), css.indexOf("}", css.indexOf(".ficha-section-nav {")));
  assert.doesNotMatch(navRule, /sticky/);
  assert.doesNotMatch(css, /\.ficha-aside\s*\{/);
  assert.doesNotMatch(nav, /className="[^"]*\bsticky\b/);
  // A barra de WhatsApp do celular continua.
  assert.match(page, /<VehicleMobileBar/);
});

test("preço da ficha em vermelho com reflexo e glow, desligados sem movimento", () => {
  const css = readSrc("app/globals.css");
  const dossier = readSrc("components/site/VehicleMobileDossier.tsx");
  assert.match(dossier, /className="ficha-price"/);
  const at = css.indexOf(".ficha-price {");
  const block = css.slice(at, css.indexOf("/* O teclado usa", at));
  assert.match(block, /animation: assistantSheen/);
  assert.match(block, /animation: assistantGlow/);
  assert.match(block, /prefers-reduced-motion: reduce[\s\S]*animation: none/);
  assert.doesNotMatch(block, /gold|#ffc72c|#ffd700/i);
});

test("foto grande encaixa inteira (contain); miniaturas continuam cover", () => {
  const gallery = readSrc("components/site/VehicleGallery.tsx");
  assert.match(gallery, /className="object-contain \[-webkit-touch-callout:none\]"/);
  assert.doesNotMatch(gallery, /className="object-cover \[-webkit-touch-callout:none\]"/);
  assert.match(gallery, /snap-always bg-asphalt/);
});

test("Sobre o veículo fica com o gancho; cor, ano e km saem mesmo escritos de outro jeito", () => {
  const specs = [
    { label: "Ano", value: "2012/2013" },
    { label: "km", value: "98.000" },
    { label: "Câmbio", value: "Manual" },
    { label: "Cor", value: "Branco" },
  ];
  const text = [
    "Hatch econômico, esperto na cidade.",
    "",
    "🛣️ Quilometragem: 98 mil km",
    "🎨 Cor: Branco perolizado",
    "📅 Ano/Modelo: 2013",
    "✅ Histórico: único dono",
    "",
    "Km: 98.000",
    "2012/2013",
    "Branco",
    "Pneus novos e revisão feita.",
  ].join("\n");
  const segments = visibleDescriptionSegments(text, undefined, specs);
  const flat = segments
    .map((segment) => (segment.kind === "prose" ? segment.text : segment.lines.map((line) => line.text).join("\n")))
    .join("\n");
  assert.match(flat, /Hatch econômico, esperto na cidade\./);
  assert.match(flat, /Histórico: único dono/);
  assert.match(flat, /Pneus novos e revisão feita\./);
  assert.doesNotMatch(flat, /Quilometragem|98 mil|98\.000|Cor:|perolizado|Ano\/Modelo|2012\/2013|^Branco$/m);

  // Sem cor cadastrada, a linha do anúncio é a única fonte e fica.
  const noColor = visibleDescriptionSegments("🎨 Cor: Vermelho", undefined, [
    { label: "Cor", value: "Não informada", empty: true },
  ]);
  assert.equal(noColor.length, 1);
  // Frase normal que cita km continua.
  const prose = visibleDescriptionSegments("Rodou 98 mil km só na cidade, sempre na concessionária.", undefined, specs);
  assert.equal(prose.length, 1);
});

test("foco provisório da seção sai no blur (clique num opcional não sobe a página)", () => {
  const attrs = new Map<string, string>();
  let onBlur: (() => void) | undefined;
  const target = {
    hasAttribute: (name: string) => attrs.has(name),
    setAttribute: (name: string, value: string) => void attrs.set(name, value),
    removeAttribute: (name: string) => void attrs.delete(name),
    addEventListener: (_type: "blur", listener: () => void) => {
      onBlur = listener;
    },
    focus: () => {},
  };
  focusFichaSection(target);
  assert.equal(attrs.get("tabindex"), "-1");
  onBlur?.();
  assert.equal(attrs.has("tabindex"), false);
});
