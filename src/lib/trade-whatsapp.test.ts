import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TradeForm } from "@/components/site/TradeForm";
import { VehicleMobileBlocks } from "@/components/site/VehicleMobileDossier";
import { FavoritesProvider } from "@/lib/favorites";
import { trackTradeWhatsAppClick } from "@/lib/funnel-events";
import { site } from "@/lib/site";
import {
  TRADE_ORIGIN_TAG,
  buildTradeWhatsAppMessage,
  buildTradeWhatsAppUrl,
  toTradeInterestVehicle,
  validateTradeForm,
} from "@/lib/trade-whatsapp";
import { DEFAULT_VEHICLE_CONDITIONS } from "@/lib/vehicle-conditions";

const readSrc = (rel: string) =>
  readFileSync(join(process.cwd(), "src", rel), "utf8");

test("buildTradeWhatsAppMessage organiza os dados em linhas e termina com [origem: troca]", () => {
  const message = buildTradeWhatsAppMessage({
    brandModel: "Honda Civic",
    version: "EXL 2.0",
    year: "2020",
    km: "65000",
    transmission: "Automático",
    condition: "ótimo",
    notes: "Único dono\nrevisões em dia",
  });

  const lines = message.split("\n");
  assert.deepEqual(lines, [
    "Oi! Quero avaliar meu veículo para troca na Garagem:",
    "Marca/modelo: Honda Civic",
    "Versão: EXL 2.0",
    "Ano: 2020",
    "Km: 65.000 km",
    "Câmbio: Automático",
    "Estado geral: Ótimo",
    "Observações: Único dono revisões em dia",
    "[origem: troca]",
  ]);
  assert.equal(lines.at(-1), TRADE_ORIGIN_TAG);
  assert.ok(message.endsWith("[origem: troca]"));
});

test("buildTradeWhatsAppMessage omite campos opcionais vazios e aceita estados bom/regular e câmbio manual", () => {
  const bom = buildTradeWhatsAppMessage({
    brandModel: "VW Gol",
    version: "   ",
    year: 2018,
    km: "82.400",
    transmission: "manual",
    condition: "bom",
    notes: "",
  });

  assert.doesNotMatch(bom, /Versão:|Observações:|Carro de interesse:|Link:/);
  assert.match(bom, /^Marca\/modelo: VW Gol$/m);
  assert.match(bom, /^Ano: 2018$/m);
  assert.match(bom, /^Km: 82\.400 km$/m);
  assert.match(bom, /^Câmbio: Manual$/m);
  assert.match(bom, /^Estado geral: Bom$/m);
  assert.ok(bom.endsWith("\n[origem: troca]"));

  const regular = buildTradeWhatsAppMessage({
    brandModel: "Fiat Uno",
    year: "2015/2016",
    km: 120000,
    transmission: "Manual",
    condition: "regular",
    interestText: "Hatch mais novo",
  });
  assert.match(regular, /^Ano: 2015\/2016$/m);
  assert.match(regular, /^Estado geral: Regular$/m);
  assert.match(regular, /^Carro de interesse: Hatch mais novo$/m);
  assert.ok(regular.endsWith("\n[origem: troca]"));
});

test("buildTradeWhatsAppMessage inclui nome, ano e link do carro de interesse vindo da ficha", () => {
  const interest = toTradeInterestVehicle({
    id: "cm0000000000000000000001",
    brand: "Toyota",
    model: "Corolla",
    version: "XEi 2.0",
    yearModel: 2022,
    status: "disponivel",
    photos: [{ url: "/branding/placeholder-car.png" }],
  });

  assert.ok(interest);
  assert.equal(interest.year, 2022);
  assert.match(interest.title, /Toyota Corolla/);
  assert.match(
    interest.url,
    /^https:\/\/www\.suagaragem\.net\/estoque\/toyota-corolla-xei-2-0-2022-cm0000000000000000000001$/,
  );

  const message = buildTradeWhatsAppMessage({
    brandModel: "Chevrolet Onix",
    year: "2019",
    km: "54000",
    transmission: "Automático",
    condition: "ótimo",
    interestVehicle: interest,
  });

  assert.match(
    message,
    /^Carro de interesse: Toyota Corolla XEi 2\.0 \(2022\)$/m,
  );
  assert.match(
    message,
    /^Link: https:\/\/www\.suagaragem\.net\/estoque\/toyota-corolla-xei-2-0-2022-cm0000000000000000000001$/m,
  );
  assert.ok(message.endsWith("\n[origem: troca]"));
});

test("toTradeInterestVehicle ignora veículo vendido e não expõe preço", () => {
  const sold = toTradeInterestVehicle({
    id: "cm0000000000000000000002",
    brand: "Honda",
    model: "HR-V",
    yearModel: 2021,
    status: "vendido",
  });
  assert.equal(sold, null);
});

test("buildTradeWhatsAppUrl abre o número oficial da Garagem sem UTM mutável e preserva [origem: troca]", () => {
  const href = buildTradeWhatsAppUrl({
    brandModel: "Hyundai HB20",
    year: "2021",
    km: "38000",
    transmission: "Manual",
    condition: "bom",
  });

  const parsed = new URL(href);
  assert.equal(parsed.hostname, "wa.me");
  assert.equal(parsed.pathname, `/${site.whatsappNumber}`);
  assert.equal(parsed.searchParams.has("utm_source"), false);

  const text = parsed.searchParams.get("text") ?? "";
  assert.ok(text.endsWith("[origem: troca]"));
});

test("validateTradeForm exige os campos obrigatórios e aceita ano simples ou ano/modelo", () => {
  const invalid = validateTradeForm({
    brandModel: "",
    year: "20",
    km: "",
    transmission: "",
    condition: "",
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.ok(invalid.errors.brandModel);
    assert.ok(invalid.errors.year);
    assert.ok(invalid.errors.km);
    assert.ok(invalid.errors.transmission);
    assert.ok(invalid.errors.condition);
  }

  const valid = validateTradeForm({
    brandModel: "Nissan Kicks",
    version: "Advance",
    year: "2021/2022",
    km: "41.500",
    transmission: "Automático",
    condition: "ótimo",
    notes: "IPVA pago",
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.data.year, "2021/2022");
    assert.equal(valid.data.km, "41.500 km");
    assert.equal(valid.data.transmission, "Automático");
    assert.equal(valid.data.condition, "Ótimo");
  }
});

test("TradeForm renderiza sem dados pessoais, sem foto/parcela/simulador e mostra carro 4:3 com fundo desfocado", () => {
  const emptyHtml = renderToStaticMarkup(createElement(TradeForm));
  assert.match(emptyHtml, /Enviar pelo WhatsApp/);
  assert.match(emptyHtml, /Marca \/ modelo/);
  assert.match(emptyHtml, /Versão/);
  assert.match(emptyHtml, /Quilometragem \(km\)/);
  assert.match(emptyHtml, /Câmbio/);
  assert.match(emptyHtml, /Manual/);
  assert.match(emptyHtml, /Automático/);
  assert.match(emptyHtml, /Estado geral/);
  assert.match(emptyHtml, /Ótimo/);
  assert.match(emptyHtml, /Bom/);
  assert.match(emptyHtml, /Regular/);
  assert.match(emptyHtml, /Observações curtas/);
  assert.match(emptyHtml, /Carro de interesse/);
  assert.doesNotMatch(
    emptyHtml,
    /type="file"|name="name"|name="phone"|name="cpf"|name="plate"|parcela|simul/i,
  );

  const withCarHtml = renderToStaticMarkup(
    createElement(TradeForm, {
      interestVehicle: {
        id: "cm0000000000000000000003",
        slug: "jeep-compass-longitude-2022-cm0000000000000000000003",
        title: "Jeep Compass Longitude",
        year: 2022,
        path: "/estoque/jeep-compass-longitude-2022-cm0000000000000000000003",
        url: "https://www.suagaragem.net/estoque/jeep-compass-longitude-2022-cm0000000000000000000003",
        photoUrl: "/branding/placeholder-car.png",
      },
    }),
  );
  assert.match(withCarHtml, /Jeep Compass Longitude · 2022/);
  assert.match(
    withCarHtml,
    /href="\/estoque\/jeep-compass-longitude-2022-cm0000000000000000000003"/,
  );
  assert.match(withCarHtml, /aspect-\[4\/3\]/);
  assert.match(withCarHtml, /blur-2xl/);
  assert.match(withCarHtml, /object-contain/);
});

test("trackTradeWhatsAppClick dispara só evento genérico sem dados de formulário nem escrita em banco", () => {
  const prevWindow = (globalThis as { window?: unknown }).window;
  const fbqCalls: unknown[][] = [];
  const gtagCalls: unknown[][] = [];
  const fbqStub = Object.assign(
    (...args: unknown[]) => {
      fbqCalls.push(args);
    },
    { queue: [] as unknown[], push: (() => {}) as never },
  );

  (globalThis as { window?: unknown }).window = {
    fbq: fbqStub,
    gtag: (...args: unknown[]) => {
      gtagCalls.push(args);
    },
  };

  try {
    trackTradeWhatsAppClick();
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  }

  assert.deepEqual(fbqCalls, [["trackCustom", "WhatsAppClick", { label: "troca" }]]);
  assert.deepEqual(gtagCalls, [
    ["event", "whatsapp_click", { event_category: "engagement", event_label: "troca" }],
  ]);
});

test("página /troca, sitemap e links discretos na ficha e na home seguem as regras do site", () => {
  const page = readSrc("app/(site)/troca/page.tsx");
  const form = readSrc("components/site/TradeForm.tsx");
  const sitemap = readSrc("app/sitemap.ts");
  const ficha = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  const home = readSrc("app/(catalog)/page.tsx");

  assert.match(page, /export const revalidate = 3600;/);
  assert.match(page, /buildPageMetadata/);
  assert.match(page, /path:\s*"\/troca"/);
  assert.match(page, /Atendemos Linhares, Aracruz e Grande Vitória/);
  assert.match(page, /Combinamos o atendimento pelo WhatsApp/);
  assert.match(sitemap, /path:\s*"\/troca"/);

  for (const source of [page, form]) {
    assert.doesNotMatch(
      source,
      /loja digital|loja física|pontos de venda|atendimento com hora marcada|Sua Garagem|parcela|simul|gold|#ffc72c|#ffd700/i,
    );
    assert.doesNotMatch(source, /createSellLead|prisma\.|enqueueIntent|\/api\//);
  }

  assert.match(ficha, /Tem carro pra dar na troca\?/);
  assert.match(ficha, /\/troca\?carro=\$\{encodeURIComponent\(canonicalSlug\)\}/);
  assert.match(home, /Tem carro pra dar na troca\?/);
  assert.match(home, /href="\/troca"/);

  const mobileAvailable = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(
        VehicleMobileBlocks as unknown as React.ComponentType<Record<string, unknown>>,
        {
          hours: site.hours,
          fullLabel: "Honda Civic EXL",
          path: "/estoque/honda-civic-exl-2021-cm0000000000000000000009",
          sold: false,
          price: 115900,
          yearModel: 2021,
          make: "Honda",
          model: "Civic",
          vehicleId: "cm0000000000000000000009",
          accessories: [],
          specs: [],
          conditions: DEFAULT_VEHICLE_CONDITIONS,
        },
      ),
    ),
  );
  assert.match(mobileAvailable, /Tem carro pra dar na troca\?/);
  assert.match(
    mobileAvailable,
    /href="\/troca\?carro=honda-civic-exl-2021-cm0000000000000000000009"/,
  );

  const mobileSold = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(
        VehicleMobileBlocks as unknown as React.ComponentType<Record<string, unknown>>,
        {
          hours: site.hours,
          fullLabel: "Honda Civic EXL",
          path: "/estoque/honda-civic-exl-2021-cm0000000000000000000009",
          sold: true,
          price: 0,
          yearModel: 2021,
          make: "Honda",
          model: "Civic",
          vehicleId: "cm0000000000000000000009",
          accessories: [],
          specs: [],
          conditions: DEFAULT_VEHICLE_CONDITIONS,
        },
      ),
    ),
  );
  assert.doesNotMatch(mobileSold, /Tem carro pra dar na troca\?/);
});
