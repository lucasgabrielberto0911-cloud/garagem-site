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
  TRADE_FIELD_ERRORS,
  TRADE_ORIGIN_TAG,
  TRADE_STEP_COUNT,
  buildTradeWhatsAppMessage,
  buildTradeWhatsAppUrl,
  stepForTradeFieldError,
  toTradeInterestVehicle,
  validateTradeForm,
  validateTradeStep,
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

test("validateTradeForm e validateTradeStep explicam erros em português simples passo a passo", () => {
  assert.equal(TRADE_STEP_COUNT, 5);

  const step1Fail = validateTradeStep(1, { brandModel: " " });
  assert.equal(step1Fail.ok, false);
  if (!step1Fail.ok) {
    assert.equal(step1Fail.errors.brandModel, TRADE_FIELD_ERRORS.brandModel);
    assert.match(step1Fail.errors.brandModel ?? "", /qual é o seu carro/i);
    assert.equal(step1Fail.errors.year, undefined);
  }
  assert.equal(validateTradeStep(1, { brandModel: "Onix" }).ok, true);

  const step2Fail = validateTradeStep(2, { year: "20", km: "" });
  assert.equal(step2Fail.ok, false);
  if (!step2Fail.ok) {
    assert.match(step2Fail.errors.year ?? "", /4 números/);
    assert.match(step2Fail.errors.km ?? "", /quantos km/i);
  }
  assert.equal(
    validateTradeStep(2, { year: "2019/2020", km: "65.000" }).ok,
    true,
  );

  const step3Fail = validateTradeStep(3, { transmission: "" });
  assert.equal(step3Fail.ok, false);
  if (!step3Fail.ok) {
    assert.match(step3Fail.errors.transmission ?? "", /Manual ou Automático/);
  }
  assert.equal(validateTradeStep(3, { transmission: "Automático" }).ok, true);

  const step4Fail = validateTradeStep(4, { condition: "" });
  assert.equal(step4Fail.ok, false);
  if (!step4Fail.ok) {
    assert.match(step4Fail.errors.condition ?? "", /como está o carro hoje/);
  }
  assert.equal(validateTradeStep(4, { condition: "bom" }).ok, true);

  assert.equal(stepForTradeFieldError("brandModel"), 1);
  assert.equal(stepForTradeFieldError("year"), 2);
  assert.equal(stepForTradeFieldError("km"), 2);
  assert.equal(stepForTradeFieldError("transmission"), 3);
  assert.equal(stepForTradeFieldError("condition"), 4);

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

test("TradeForm mostra um passo por vez com linguagem simples, opções grandes e botão Mandar pelo WhatsApp", () => {
  const step1Html = renderToStaticMarkup(createElement(TradeForm));
  assert.match(step1Html, /Passo 1 de 5/);
  assert.match(step1Html, /Qual é o seu carro\?/);
  assert.match(step1Html, /Continuar/);
  assert.doesNotMatch(step1Html, /Marca \/ modelo/);
  assert.doesNotMatch(
    step1Html,
    /De que ano é o carro\?|Como é o câmbio do seu carro\?|Como está o seu carro hoje\?|Mandar pelo WhatsApp/,
  );

  const step2Html = renderToStaticMarkup(
    createElement(TradeForm, { initialStep: 2 }),
  );
  assert.match(step2Html, /Passo 2 de 5/);
  assert.match(step2Html, /De que ano é o carro\?/);
  assert.match(step2Html, /Quantos km ele já rodou\?/);
  assert.match(step2Html, /inputMode="numeric"/);
  assert.match(step2Html, /Voltar/);
  assert.match(step2Html, /Continuar/);

  const step3Html = renderToStaticMarkup(
    createElement(TradeForm, { initialStep: 3 }),
  );
  assert.match(step3Html, /Passo 3 de 5/);
  assert.match(step3Html, /Como é o câmbio do seu carro\?/);
  assert.match(step3Html, /type="radio"/);
  assert.match(step3Html, /min-h-\[76px\]/);
  assert.match(step3Html, /Manual/);
  assert.match(step3Html, /Automático/);
  assert.doesNotMatch(step3Html, /<select/);

  const step4Html = renderToStaticMarkup(
    createElement(TradeForm, { initialStep: 4 }),
  );
  assert.match(step4Html, /Passo 4 de 5/);
  assert.match(step4Html, /Como está o seu carro hoje\?/);
  assert.match(step4Html, /type="radio"/);
  assert.match(step4Html, /min-h-\[78px\]/);
  assert.match(step4Html, /Ótimo/);
  assert.match(step4Html, /Bom/);
  assert.match(step4Html, /Regular/);
  assert.doesNotMatch(step4Html, /<select/);

  const step5Html = renderToStaticMarkup(
    createElement(TradeForm, { initialStep: 5 }),
  );
  assert.match(step5Html, /Passo 5 de 5/);
  assert.match(step5Html, /Confira e mande pelo WhatsApp/);
  assert.match(step5Html, /Mandar pelo WhatsApp/);
  assert.match(step5Html, /min-h-\[58px\]/);
  assert.match(step5Html, /Gostou de algum carro nosso\?/);
  assert.match(step5Html, /Quer contar mais algum detalhe\?/);
  assert.match(step5Html, /Mudar/);

  for (const html of [step1Html, step2Html, step3Html, step4Html, step5Html]) {
    assert.doesNotMatch(
      html,
      /type="file"|name="name"|name="phone"|name="cpf"|name="plate"|parcela|simul/i,
    );
  }

  const withCarHtml = renderToStaticMarkup(
    createElement(TradeForm, {
      initialStep: 5,
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
  assert.doesNotMatch(withCarHtml, /Gostou de algum carro nosso\?/);
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

test("página /troca garante texto >= 16px, alvos >= 44px e segue todas as regras do site", () => {
  const page = readSrc("app/(site)/troca/page.tsx");
  const form = readSrc("components/site/TradeForm.tsx");
  const lib = readSrc("lib/trade-whatsapp.ts");
  const sitemap = readSrc("app/sitemap.ts");
  const ficha = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  const home = readSrc("app/(catalog)/page.tsx");

  assert.match(page, /export const revalidate = 3600;/);
  assert.match(page, /buildPageMetadata/);
  assert.match(page, /path:\s*"\/troca"/);
  assert.match(page, /data-clear-fab=""/);
  assert.match(page, /clear-fab-screen/);
  assert.match(page, /Atendemos Linhares, Aracruz e Grande Vitória/);
  assert.match(page, /Combinamos o atendimento pelo WhatsApp/);
  assert.match(sitemap, /path:\s*"\/troca"/);

  for (const source of [page, form]) {
    assert.doesNotMatch(
      source,
      /\btext-(?:xs|sm)\b|text-\[(?:1[0-5]|[0-9])px\]/,
    );
    assert.doesNotMatch(
      source,
      /loja digital|loja física|pontos de venda|atendimento com hora marcada|Sua Garagem|parcela|simul|consignado|marchas|\b\d+\s*cv\b|gold|yellow|brand-gradient|#ffc72c|#ffd700/i,
    );
    assert.doesNotMatch(source, /createSellLead|prisma\.|enqueueIntent|\/api\//);
  }

  assert.doesNotMatch(
    lib,
    /loja digital|loja física|pontos de venda|atendimento com hora marcada|Sua Garagem|parcela|simul|consignado|marchas/i,
  );

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
