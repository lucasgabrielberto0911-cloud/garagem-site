import test from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  COVER_CARD_HEIGHT,
  COVER_CARD_WIDTH,
  COVER_PHOTO_BOX,
  FEED_CARD_HEIGHT,
  FEED_CARD_WIDTH,
  FEED_PHOTO_BOX,
  PROMO_APPOINTMENT_TEXT,
  PROMO_ART_ORDER,
  PROMO_ART_SPECS,
  PROMO_BRAND_RED,
  PROMO_DOMAIN_TEXT,
  PROMO_LOGO_SRC,
  PROMO_SERVICE_AREAS_TEXT,
  PROMO_TRADE_FINANCE_TEXT,
  STORY_CARD_HEIGHT,
  STORY_CARD_WIDTH,
  STORY_PHOTO_BOX,
  buildInstagramPromo,
  buildPromoFileName,
  buildPromoZipFileName,
  buildWhatsAppPromo,
  buildZipArchive,
  canUseVehiclePromoKit,
  computePerfectCircleSeal,
  computePhotoBox4x3Layout,
  computeProportionalPlacement,
  crc32,
  renderPromoArt,
  resolvePromoPhotoSrc,
  resolvePromoTransmission,
  sanitizePromoText,
  type PromoCanvasContext2D,
  type PromoVehicle,
} from "./vehicle-promo-kit";
import { site } from "./site";
import { VehiclePromoKitModal } from "@/components/admin/VehiclePromoKitModal";
import { SheetActions } from "@/components/admin/vehicles-table/SheetActions";
import type { VehicleRow } from "@/components/admin/VehiclesTable";

const mockVehicle: PromoVehicle = {
  id: "cmshv22g9000fl204fk6qz9l2",
  brand: "Toyota",
  model: "Corolla",
  version: "XEi 2.0",
  year: 2021,
  yearModel: 2022,
  km: 42000,
  transmission: "Automático",
  fuel: "Flex",
  color: "Prata",
  price: 119900,
  status: "disponivel",
  consigned: false,
  plate: "RBA1E23",
  chassis: "9BRBL3HE1M0123456",
  renavam: "01234567890",
  accessories: ["Ar-condicionado", "Direção elétrica", "Câmera de ré"],
  photos: [{ url: "https://pub-revisao123.r2.dev/corolla-capa.webp" }],
};

function makeMockVehicleRow(overrides: Partial<VehicleRow> = {}): VehicleRow {
  return {
    id: mockVehicle.id,
    category: "carro",
    brand: mockVehicle.brand,
    model: mockVehicle.model,
    version: mockVehicle.version ?? null,
    year: mockVehicle.year,
    yearModel: mockVehicle.yearModel,
    km: mockVehicle.km,
    price: mockVehicle.price,
    status: mockVehicle.status,
    locationCity: "linhares",
    featured: false,
    inStoreName: false,
    hasSpareKey: true,
    hasManual: true,
    purchasePrice: 100000,
    consigned: false,
    createdAt: new Date("2026-10-01T12:00:00Z"),
    updatedAt: new Date("2026-10-02T12:00:00Z"),
    transmission: mockVehicle.transmission ?? "Automático",
    color: mockVehicle.color ?? null,
    photos: [
      {
        url: "https://pub-revisao123.r2.dev/corolla-capa.webp",
        thumbnailUrl: null,
      },
    ],
    sale: null,
    costsTotal: 0,
    photoCount: 1,
    ...overrides,
  };
}

function createMockCanvasContext() {
  const texts: Array<{
    text: string;
    font: string;
    x: number;
    y: number;
    fill: unknown;
  }> = [];
  const rects: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    fill: unknown;
  }> = [];
  const draws: Array<{
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    filter: string;
  }> = [];
  const arcs: Array<{ x: number; y: number; radius: number }> = [];
  const fillsUsed: string[] = [];
  const fontsUsed: string[] = [];
  const filterStack: string[] = [];

  const ctx: PromoCanvasContext2D = {
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    filter: "none",
    fillRect(x, y, w, h) {
      if (typeof this.fillStyle === "string") fillsUsed.push(this.fillStyle);
      rects.push({ x, y, w, h, fill: this.fillStyle });
    },
    strokeRect() {},
    fillText(text, x, y) {
      if (typeof this.fillStyle === "string") fillsUsed.push(this.fillStyle);
      fontsUsed.push(this.font);
      texts.push({ text, font: this.font, x, y, fill: this.fillStyle });
    },
    measureText(text) {
      const sizeMatch = /(\d+)px/.exec(this.font);
      const px = sizeMatch ? Number(sizeMatch[1]) : 24;
      const factor = this.font.includes("Barlow Condensed") ? 0.46 : 0.58;
      return { width: text.length * px * factor };
    },
    save() {
      filterStack.push(this.filter ?? "none");
    },
    restore() {
      this.filter = filterStack.pop() ?? "none";
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {
      if (typeof this.fillStyle === "string") fillsUsed.push(this.fillStyle);
    },
    stroke() {},
    rect() {},
    clip() {},
    arc(x, y, radius) {
      arcs.push({ x, y, radius });
    },
    drawImage(_img, dx, dy, dw, dh) {
      draws.push({ dx, dy, dw, dh, filter: this.filter ?? "none" });
    },
  };

  return { ctx, texts, rects, draws, arcs, fillsUsed, fontsUsed };
}

test("resolvePromoTransmission e sanitizePromoText: câmbio só Manual ou Automático e bloqueio total de placa, chassi, RENAVAM, cv/marchas e consignado", () => {
  assert.equal(resolvePromoTransmission("XEi 2.0", "CVT"), "Automático");
  assert.equal(resolvePromoTransmission("1.8 Dualogic", "Automatizado"), "Automático");
  assert.equal(resolvePromoTransmission("1.0 Semi-automático", ""), "Automático");
  assert.equal(resolvePromoTransmission("EX 1.5 Manual", "Automático"), "Manual");
  assert.equal(resolvePromoTransmission("1.0", "Mecânico"), "Manual");
  assert.equal(resolvePromoTransmission("", ""), "");

  const dirty =
    "XEi 2.0 177cv 7 marchas Consignado Placa RBA1E23 ABC-1234 Chassi 9BRBL3HE1M0123456 Renavam 01234567890";
  const cleaned = sanitizePromoText(dirty);
  assert.equal(cleaned, "XEi 2.0");
  assert.doesNotMatch(cleaned, /RBA1E23|ABC-1234|9BRBL3HE1M0123456|01234567890/);
  assert.doesNotMatch(cleaned, /cv\b|marchas?|consignad/i);
});

test("buildInstagramPromo: gera legenda pronta com #garagem #<modelo> #linhares #vitoria #aracruz, sem parcela, sem dados sensíveis e sem preço quando vendido", () => {
  const text = buildInstagramPromo({
    ...mockVehicle,
    model: "HR-V",
    version: "EXL 1.8 140cv 7 marchas CVT",
    transmission: "CVT",
    consigned: true,
    accessories: ["Bancos em couro", "Placa RBA1E23", "Multimídia"],
  });

  assert.match(text, /Toyota HR-V EXL 1\.8 — 2021\/2022/);
  assert.match(text, /💰 R\$\s*119\.900 à vista/);
  assert.match(text, /• Ano: 2021\/2022/);
  assert.match(text, /• KM: 42\.000 km/);
  assert.match(text, /• Câmbio: Automático/);
  assert.match(text, /Aceitamos troca e financiamos em até 60x\./);
  assert.ok(text.includes(PROMO_SERVICE_AREAS_TEXT));
  assert.ok(text.includes(PROMO_APPOINTMENT_TEXT));
  assert.ok(text.includes(PROMO_DOMAIN_TEXT));
  assert.match(text, /#garagem #hrv #linhares #vitoria #aracruz/);

  // Regras proibidas
  assert.doesNotMatch(text, /RBA1E23|9BRBL3HE1M0123456|01234567890/);
  assert.doesNotMatch(text, /140cv|7 marchas|consignad/i);
  assert.doesNotMatch(text, /parcela|entrada\s*\+/i);
  assert.doesNotMatch(text, /Sua Garagem/);
  assert.doesNotMatch(
    text,
    /loja digital|loja física|pontos de venda|atendimento com hora marcada/i,
  );

  // Carro vendido nunca exibe valor
  const soldText = buildInstagramPromo({ ...mockVehicle, status: "vendido" });
  assert.match(soldText, /Veículo vendido/);
  assert.doesNotMatch(soldText, /119\.900/);
});

test("buildWhatsAppPromo: inclui link canônico da ficha, câmbio Manual/Automático, atendimento regional e respeita vendido e consignado", () => {
  const text = buildWhatsAppPromo({
    ...mockVehicle,
    consigned: true,
    transmission: "cvt",
  });

  assert.match(text, /🚗 \*Toyota Corolla XEi 2\.0\*/);
  assert.match(text, /📅 Ano: 2021\/2022/);
  assert.match(text, /🛣️ KM: 42\.000 km/);
  assert.match(text, /⚙️ Câmbio: Automático/);
  assert.match(text, /💰 À vista: \*R\$\s*119\.900\*/);
  assert.match(text, /Aceitamos troca · Financiamos em até 60x/);
  assert.ok(text.includes(PROMO_SERVICE_AREAS_TEXT));
  assert.ok(text.includes(PROMO_APPOINTMENT_TEXT));
  assert.match(
    text,
    /https:\/\/www\.suagaragem\.net\/estoque\/toyota-corolla-xei-2-0-2022-cmshv22g9000fl204fk6qz9l2/,
  );
  assert.doesNotMatch(text, /RBA1E23|9BRBL3HE1M0123456|01234567890|consignad/i);
  assert.doesNotMatch(
    text,
    /loja digital|loja física|pontos de venda|atendimento com hora marcada|Sua Garagem/i,
  );

  const soldText = buildWhatsAppPromo({ ...mockVehicle, status: "vendido" });
  assert.match(soldText, /Veículo vendido/);
  assert.doesNotMatch(soldText, /119\.900/);
});

test("layout e geometria das 3 artes: FEED 1080x1350, STORY 1080x1920 e CAPA 1080x1080 com quadros 4:3, fundo desfocado sem barras pretas e safe zones", () => {
  assert.equal(FEED_CARD_WIDTH, 1080);
  assert.equal(FEED_CARD_HEIGHT, 1350);
  assert.equal(STORY_CARD_WIDTH, 1080);
  assert.equal(STORY_CARD_HEIGHT, 1920);
  assert.equal(COVER_CARD_WIDTH, 1080);
  assert.equal(COVER_CARD_HEIGHT, 1080);

  // Quadro da foto é estritamente 4:3 nas três artes
  assert.equal(FEED_PHOTO_BOX.width / FEED_PHOTO_BOX.height, 4 / 3);
  assert.equal(STORY_PHOTO_BOX.width / STORY_PHOTO_BOX.height, 4 / 3);
  assert.equal(COVER_PHOTO_BOX.width / COVER_PHOTO_BOX.height, 4 / 3);

  // Enquadramento 4:3 com foto vertical 9:16: fundo desfocado cobrindo 100% + frente contain sem filtro
  const portrait = computePhotoBox4x3Layout(720, 1280, FEED_PHOTO_BOX);
  assert.equal(portrait.needsBlurredBackdrop, true);
  assert.ok(portrait.backdrop.width >= FEED_PHOTO_BOX.width);
  assert.ok(portrait.backdrop.height >= FEED_PHOTO_BOX.height);
  assert.equal(Math.round(portrait.foreground.height), 720);
  assert.equal(Math.round(portrait.foreground.width), 405);

  // Foto nativa 4:3 (1440x1080): sem camada extra de blur
  const native4x3 = computePhotoBox4x3Layout(1440, 1080, COVER_PHOTO_BOX);
  assert.equal(native4x3.needsBlurredBackdrop, false);
  assert.equal(Math.round(native4x3.foreground.width), 760);
  assert.equal(Math.round(native4x3.foreground.height), 570);

  // Logo proporcional nunca distorce o aspect ratio real (887x160)
  const logoPlaced = computeProportionalPlacement(887, 160, {
    x: 60,
    y: 30,
    width: 330,
    height: 64,
  });
  assert.ok(Math.abs(logoPlaced.width / logoPlaced.height - 887 / 160) < 0.001);

  // Selo circular é sempre um círculo perfeito (width === height, radius === diameter / 2)
  const seal = computePerfectCircleSeal(540, 280, 120);
  assert.equal(seal.width, 120);
  assert.equal(seal.height, 120);
  assert.equal(seal.radius, 60);
  assert.equal(seal.innerBox.width, seal.innerBox.height);
});

test("renderPromoArt: desenha Feed, Story e Capa com Barlow Condensed itálica, Sora/Inter, vermelho do logo (nunca dourado), foto sem alterar cor e suporte a consignado e vendido", () => {
  const root = process.cwd();
  assert.equal(
    existsSync(join(root, "public/fonts/BarlowCondensed-ExtraBoldItalic.ttf")),
    true,
  );
  assert.equal(
    existsSync(join(root, "public/fonts/BarlowCondensed-OFL.txt")),
    true,
  );
  assert.equal(existsSync(join(root, "public", PROMO_LOGO_SRC)), true);

  for (const kind of PROMO_ART_ORDER) {
    const spec = PROMO_ART_SPECS[kind];
    const mock = createMockCanvasContext();

    renderPromoArt(
      mock.ctx,
      {
        ...mockVehicle,
        consigned: true,
        version: "XEi 2.0 177cv CVT",
        transmission: "CVT",
      },
      kind,
      {
        photoImg: { complete: true, naturalWidth: 720, naturalHeight: 1280 },
        logoImg: { complete: true, naturalWidth: 887, naturalHeight: 160 },
      },
    );

    // Fundo da dimensão exata da arte
    assert.ok(
      mock.rects.some(
        (r) => r.x === 0 && r.y === 0 && r.w === spec.width && r.h === spec.height,
      ),
    );

    // 1 drawImage para o logo + 2 drawImages para a foto (fundo blur + frente sem filtro)
    assert.equal(mock.draws.length, 3);
    assert.equal(mock.draws[0].filter, "none"); // logo real sem filtro
    assert.match(mock.draws[1].filter, /blur\(/); // fundo 4:3 desfocado
    assert.equal(mock.draws[2].filter, "none"); // foto principal sem alterar cor!

    // Vermelho do logo usado como destaque principal e ZERO dourado/amarelo
    assert.ok(mock.fillsUsed.includes(PROMO_BRAND_RED));
    for (const color of mock.fillsUsed) {
      assert.doesNotMatch(color, /#FFC72C|#FFD700|#FF8A00|gold/i);
    }

    // Fontes: Barlow Condensed itálica nos títulos + Sora + Inter de apoio
    assert.ok(
      mock.fontsUsed.some((f) => /italic\s+800\s+\d+px\s+"Barlow Condensed"/.test(f)),
    );
    assert.ok(mock.fontsUsed.some((f) => f.includes('"Sora"')));
    assert.ok(mock.fontsUsed.some((f) => f.includes('"Inter"')));

    // Textos obrigatórios e segurança de dados
    const allText = mock.texts.map((t) => t.text).join("\n");
    assert.match(allText, /TOYOTA/);
    assert.match(allText, /COROLLA/);
    assert.match(allText, /2021\/2022/);
    assert.match(allText, /42\.000 km/);
    assert.match(allText, /Automático/);
    assert.doesNotMatch(allText, /\bCVT\b|\b177cv\b|RBA1E23|9BRBL3HE1M0123456|consignad/i);
    assert.match(allText, /R\$\s*119\.900/);
    assert.ok(allText.includes(PROMO_TRADE_FINANCE_TEXT));
    assert.ok(allText.includes(PROMO_SERVICE_AREAS_TEXT));
    assert.ok(allText.includes(PROMO_DOMAIN_TEXT));
    assert.ok(allText.includes(site.whatsappLabel));

    // Safe zone vertical estrita no Story (240..1660)
    if (kind === "story") {
      for (const item of mock.texts) {
        assert.ok(
          item.y >= spec.safeArea.top && item.y <= spec.safeArea.bottom,
          `Texto "${item.text}" fora da zona segura do Story (y=${item.y})`,
        );
      }
    }

    // Carro vendido na arte nunca desenha preço
    const soldMock = createMockCanvasContext();
    renderPromoArt(soldMock.ctx, { ...mockVehicle, status: "vendido" }, kind);
    const soldText = soldMock.texts.map((t) => t.text).join("\n");
    assert.match(soldText, /VENDIDO/);
    assert.doesNotMatch(soldText, /119\.900|PREÇO À VISTA/);
  }

  // Se o logo for quadrado 1:1 num box quadrado, usa selo circular perfeito (arc)
  const sealMock = createMockCanvasContext();
  const squareLogo = { complete: true, naturalWidth: 1024, naturalHeight: 1024 };
  renderPromoArt(sealMock.ctx, mockVehicle, "feed", { logoImg: squareLogo });
  assert.equal(sealMock.draws[0].filter, "none");
});

test("buildZipArchive e nomes de arquivo: gera pacote ZIP válido com CRC-32 exato e os 3 arquivos PNG", () => {
  assert.equal(canUseVehiclePromoKit(mockVehicle), true);
  assert.equal(canUseVehiclePromoKit({ ...mockVehicle, consigned: true }), true);
  assert.equal(canUseVehiclePromoKit(null), false);

  const feedName = buildPromoFileName(mockVehicle, "feed");
  const storyName = buildPromoFileName(mockVehicle, "story");
  const coverName = buildPromoFileName(mockVehicle, "cover");
  const zipName = buildPromoZipFileName(mockVehicle);

  assert.match(feedName, /-feed-1080x1350\.png$/);
  assert.match(storyName, /-story-1080x1920\.png$/);
  assert.match(coverName, /-capa-1080x1080\.png$/);
  assert.match(zipName, /^kit-divulgacao-.*\.zip$/);

  const samplePng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);

  const zipBytes = buildZipArchive([
    { name: feedName, data: samplePng },
    { name: storyName, data: samplePng },
    { name: coverName, data: samplePng },
  ]);

  const view = new DataView(zipBytes.buffer);
  // Assinatura Local File Header (PK\x03\x04)
  assert.equal(view.getUint32(0, true), 0x04034b50);
  // Assinatura End of Central Directory nos últimos 22 bytes (PK\x05\x06)
  const eocdOffset = zipBytes.length - 22;
  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);
  assert.equal(view.getUint16(eocdOffset + 8, true), 3); // 3 arquivos no ZIP

  const zipAscii = new TextDecoder().decode(zipBytes);
  assert.ok(zipAscii.includes(feedName));
  assert.ok(zipAscii.includes(storyName));
  assert.ok(zipAscii.includes(coverName));
});

test("resolvePromoPhotoSrc, modal e menus: funciona para consignados, alvos >= 44px, fonte >= 16px e sem crossOrigin externo", () => {
  const consignedVehicle: PromoVehicle = { ...mockVehicle, consigned: true };

  const r2Src = resolvePromoPhotoSrc(consignedVehicle);
  assert.match(r2Src, /^\/api\/fotos\/story\//);
  assert.ok(r2Src.includes(encodeURIComponent(mockVehicle.id)));

  const localSrc = resolvePromoPhotoSrc({
    ...consignedVehicle,
    photos: [{ url: "/branding/placeholder-car.png" }],
  });
  assert.equal(localSrc, "/branding/placeholder-car.png");

  const htmlConsignedModal = renderToStaticMarkup(
    createElement(VehiclePromoKitModal, {
      vehicle: consignedVehicle,
      open: true,
      onClose: () => {},
    }),
  );
  assert.match(htmlConsignedModal, /Baixar tudo \(ZIP\)/);
  assert.match(htmlConsignedModal, /Baixar Feed/);
  assert.match(htmlConsignedModal, /Baixar Story/);
  assert.match(htmlConsignedModal, /Baixar Capa/);
  assert.match(htmlConsignedModal, /Copiar legenda do Instagram/);
  assert.match(htmlConsignedModal, /Copiar texto do WhatsApp/);
  assert.doesNotMatch(htmlConsignedModal, /consigned-promo-modal-blocked/);
  assert.doesNotMatch(htmlConsignedModal, /\btext-xs\b|\btext-sm\b/);
  assert.doesNotMatch(htmlConsignedModal, /bg-brand-gradient/);

  const modalSource = readFileSync(
    new URL("../components/admin/VehiclePromoKitModal.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(modalSource, /crossOrigin\s*=\s*["']anonymous["']/);
  assert.match(modalSource, /document\.fonts\?\.ready/);

  // SheetActions e VehicleActionsMenu liberam Kit de divulgação também em consignado
  const noop = () => {};
  const consignedSheetHtml = renderToStaticMarkup(
    createElement(SheetActions, {
      vehicle: makeMockVehicleRow({ consigned: true }),
      busy: false,
      close: noop,
      onStatus: noop,
      onFeatured: noop,
      onDuplicate: noop,
      onMarkSold: noop,
      onMarkSoldSimple: noop,
      onDelete: noop,
      onPromo: noop,
    }),
  );
  assert.match(consignedSheetHtml, /Kit de divulgação/);
  assert.doesNotMatch(consignedSheetHtml, /consigned-promo-blocked/);

  const actionsMenuSource = readFileSync(
    new URL(
      "../components/admin/vehicle-form/VehicleActionsMenu.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(actionsMenuSource, /consigned-promo-blocked/);
  assert.match(actionsMenuSource, /Kit de divulgação/);
});

test("GET /api/fotos/story/[vehicleId]: exige sessão admin (401), bloqueia SSRF (400) e serve foto same-origin para estoque próprio e consignado (200)", async () => {
  let sessionActive = true;
  const dbVehicle: { photos: Array<{ url: string }> } | null = {
    photos: [{ url: "https://pub-revisao123.r2.dev/corolla-capa.webp" }],
  };

  const require = createRequire(import.meta.url);
  const loader = Module as unknown as {
    _load: (id: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = loader._load;
  loader._load = function (id, parent, isMain) {
    if (id === "@/lib/auth") {
      return {
        getSession: async () => (sessionActive ? { adminId: "admin-1" } : null),
      };
    }
    if (id === "@/lib/prisma") {
      return {
        prisma: {
          vehicle: {
            findFirst: async () => dbVehicle,
          },
        },
      };
    }
    if (id === "@/lib/photo-archive-download") {
      return {
        vehiclePhotoStoragePath: (url: string) =>
          url.includes("pub-revisao123.r2.dev/") ? "corolla-capa.webp" : null,
        loadArchiveOriginal: async () => ({
          bytes: new Uint8Array([137, 80, 78, 71]),
          contentType: "image/png",
        }),
      };
    }
    return originalLoad.call(this, id, parent, isMain);
  };

  let GET: typeof import("../app/api/fotos/story/[vehicleId]/route").GET;
  try {
    ({ GET } = require("../app/api/fotos/story/[vehicleId]/route.ts"));
  } finally {
    loader._load = originalLoad;
  }

  const params = Promise.resolve({ vehicleId: mockVehicle.id });

  // 1. Sem sessão -> 401
  sessionActive = false;
  const unauthRes = await GET(
    new Request(`https://site.test/api/fotos/story/${mockVehicle.id}`),
    { params },
  );
  assert.equal(unauthRes.status, 401);

  // 2. URL externa arbitrária fora do acervo -> 400 (anti-SSRF)
  sessionActive = true;
  const ssrfRes = await GET(
    new Request(
      `https://site.test/api/fotos/story/${mockVehicle.id}?url=${encodeURIComponent("https://evil.example.com/x.jpg")}`,
    ),
    { params },
  );
  assert.equal(ssrfRes.status, 400);

  // 3. Próprio ou consignado válido -> 200 inline same-origin
  const okRes = await GET(
    new Request(`https://site.test/api/fotos/story/${mockVehicle.id}`),
    { params },
  );
  assert.equal(okRes.status, 200);
  assert.equal(okRes.headers.get("content-type"), "image/png");
  assert.equal(okRes.headers.get("content-disposition"), "inline");
  assert.equal((await okRes.arrayBuffer()).byteLength, 4);
});
