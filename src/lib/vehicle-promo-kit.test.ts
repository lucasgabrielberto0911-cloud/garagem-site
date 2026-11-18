import test from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CONSIGNED_PROMO_BLOCKED_MESSAGE,
  PROMO_APPOINTMENT_TEXT,
  PROMO_SERVICE_AREAS_TEXT,
  STORY_CARD_HEIGHT,
  STORY_CARD_WIDTH,
  STORY_PHOTO_BOX,
  buildInstagramPromo,
  buildWhatsAppPromo,
  canUseVehiclePromoKit,
  computeStoryPhotoLayout,
  renderStoryCard,
  resolveStoryPhotoSrc,
  type PromoVehicle,
  type StoryCanvasContext2D,
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
    plate: null,
    photos: [{ url: "https://pub-revisao123.r2.dev/corolla-capa.webp", thumbnailUrl: null }],
    sale: null,
    costsTotal: 0,
    photoCount: 1,
    ...overrides,
  };
}

function createMockCanvasContext() {
  const texts: Array<{ text: string; font: string; y: number }> = [];
  const rects: Array<{ x: number; y: number; w: number; h: number; fill: unknown }> = [];
  const draws: Array<{
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    filter: string;
  }> = [];
  const fontsUsed: string[] = [];
  const filterStack: string[] = [];

  const ctx: StoryCanvasContext2D = {
    fillStyle: "#000000",
    font: "",
    textAlign: "left",
    filter: "none",
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, fill: this.fillStyle });
    },
    fillText(text, _x, y) {
      fontsUsed.push(this.font);
      texts.push({ text, font: this.font, y });
    },
    createLinearGradient() {
      return { addColorStop() {} } as CanvasGradient;
    },
    save() {
      filterStack.push(this.filter ?? "none");
    },
    restore() {
      this.filter = filterStack.pop() ?? "none";
    },
    beginPath() {},
    rect() {},
    clip() {},
    drawImage(_img, dx, dy, dw, dh) {
      draws.push({ dx, dy, dw, dh, filter: this.filter ?? "none" });
    },
  };

  return { ctx, texts, rects, draws, fontsUsed };
}

test("buildWhatsAppPromo: carro disponível inclui preço, câmbio normalizado, WhatsApp da config e regiões atendidas", () => {
  const text = buildWhatsAppPromo({
    ...mockVehicle,
    transmission: "automatico",
  });
  assert.match(text, /🚗 \*Toyota Corolla XEi 2.0\*/);
  assert.match(text, /2021\/2022/);
  assert.match(text, /42\.000 km/);
  assert.match(text, /Câmbio: Automático · Flex/);
  assert.match(text, /Cor: Prata/);
  assert.match(text, /Destaques: Ar-condicionado · Direção elétrica · Câmera de ré/);
  assert.match(text, /R\$\s*119\.900/);
  assert.ok(text.includes(site.whatsappLabel));
  assert.ok(text.includes(PROMO_SERVICE_AREAS_TEXT));
  assert.doesNotMatch(text, /Sua Garagem/);
  assert.doesNotMatch(
    text,
    /loja digital|loja física|pontos de venda|atendimento com hora marcada/i,
  );
});

test("buildWhatsAppPromo: carro vendido NUNCA mostra preço", () => {
  const soldVehicle = { ...mockVehicle, status: "vendido" };
  const text = buildWhatsAppPromo(soldVehicle);
  assert.match(text, /🏷️ Veículo vendido/);
  assert.doesNotMatch(text, /119\.900/);
  assert.doesNotMatch(text, /💰 Valor:/);
});

test("buildInstagramPromo: gera legenda com WhatsApp da config, regiões atendidas, hashtags regionais e respeita vendido", () => {
  const text = buildInstagramPromo({
    ...mockVehicle,
    version: "EX 1.5 Manual",
    transmission: "Automático",
  });
  assert.match(text, /Toyota Corolla EX 1\.5 Manual — 2021\/2022/);
  assert.match(text, /🏷️ R\$\s*119\.900/);
  assert.match(text, /• Câmbio Manual/);
  assert.ok(text.includes(site.whatsappLabel));
  assert.ok(text.includes(PROMO_SERVICE_AREAS_TEXT));
  assert.ok(text.includes(PROMO_APPOINTMENT_TEXT));
  assert.match(text, /#linhares #aracruz #grandevitoria/);
  assert.match(text, /#toyota #corolla/);
  assert.match(text, /Garagem/);
  assert.doesNotMatch(text, /Sua Garagem/);
  assert.doesNotMatch(
    text,
    /loja digital|loja física|pontos de venda|atendimento com hora marcada/i,
  );

  const soldText = buildInstagramPromo({ ...mockVehicle, status: "vendido" });
  assert.match(soldText, /🏷️ Vendido/);
  assert.doesNotMatch(soldText, /119\.900/);
});

test("vehicle-promo-kit: bloqueia veículos consignados em todas as funções da lib", () => {
  assert.equal(canUseVehiclePromoKit(mockVehicle), true);
  assert.equal(canUseVehiclePromoKit({ consigned: false }), true);
  assert.equal(canUseVehiclePromoKit({ consigned: undefined }), true);
  assert.equal(canUseVehiclePromoKit({ consigned: true }), false);
  assert.equal(canUseVehiclePromoKit(null), false);

  const consignedVehicle: PromoVehicle = { ...mockVehicle, consigned: true };
  assert.throws(
    () => buildWhatsAppPromo(consignedVehicle),
    new RegExp(CONSIGNED_PROMO_BLOCKED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.throws(
    () => buildInstagramPromo(consignedVehicle),
    new RegExp(CONSIGNED_PROMO_BLOCKED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.equal(resolveStoryPhotoSrc(consignedVehicle), "");

  const { ctx } = createMockCanvasContext();
  assert.throws(
    () => renderStoryCard(ctx, consignedVehicle),
    new RegExp(CONSIGNED_PROMO_BLOCKED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});

test("resolveStoryPhotoSrc: converte URLs externas de foto para rota local same-origin /api/fotos/...", () => {
  const r2Src = resolveStoryPhotoSrc(mockVehicle);
  assert.match(r2Src, /^\/api\/fotos\/story\//);
  assert.ok(r2Src.includes(encodeURIComponent(mockVehicle.id)));

  const localSrc = resolveStoryPhotoSrc({
    ...mockVehicle,
    photos: [{ url: "/branding/placeholder-car.png" }],
  });
  assert.equal(localSrc, "/branding/placeholder-car.png");

  const emptySrc = resolveStoryPhotoSrc({ ...mockVehicle, photos: [] });
  assert.equal(emptySrc, "");
});

test("computeStoryPhotoLayout e renderStoryCard: quadro 4:3 (960x720) com fundo desfocado, fonte Sora, câmbio normalizado e rodapé regional", () => {
  assert.equal(STORY_CARD_WIDTH, 1080);
  assert.equal(STORY_CARD_HEIGHT, 1920);
  assert.equal(STORY_PHOTO_BOX.width, 960);
  assert.equal(STORY_PHOTO_BOX.height, 720);
  assert.equal(STORY_PHOTO_BOX.width / STORY_PHOTO_BOX.height, 4 / 3);

  // Imagem vertical (9:16) exige fundo desfocado cobrindo 960x720 e frente contain sem cortar
  const portrait = computeStoryPhotoLayout(720, 1280);
  assert.equal(portrait.needsBlurredBackdrop, true);
  assert.ok(portrait.backdrop.width >= 960);
  assert.ok(portrait.backdrop.height >= 720);
  assert.equal(Math.round(portrait.foreground.height), 720);
  assert.equal(Math.round(portrait.foreground.width), 405);

  // Imagem já 4:3 (1200x900) não precisa de camada extra desfocada
  const exact4x3 = computeStoryPhotoLayout(1200, 900);
  assert.equal(exact4x3.needsBlurredBackdrop, false);
  assert.equal(Math.round(exact4x3.foreground.width), 960);
  assert.equal(Math.round(exact4x3.foreground.height), 720);

  // Renderização completa no canvas com foto fora de proporção e câmbio a normalizar
  const { ctx, texts, rects, draws, fontsUsed } = createMockCanvasContext();
  renderStoryCard(
    ctx,
    {
      ...mockVehicle,
      version: "LX 1.5 Manual",
      transmission: "Automático",
    },
    {
      photoImg: { complete: true, naturalWidth: 720, naturalHeight: 1280 },
    },
  );

  // Base 4:3 960x720 (e nunca mais 960x880)
  assert.ok(
    rects.some(
      (r) =>
        r.x === STORY_PHOTO_BOX.x &&
        r.y === STORY_PHOTO_BOX.y &&
        r.w === 960 &&
        r.h === 720,
    ),
  );
  assert.equal(rects.some((r) => r.w === 960 && r.h === 880), false);

  // Duas camadas de imagem: 1ª desfocada cobrindo tudo, 2ª nítida inteira
  assert.equal(draws.length, 2);
  assert.match(draws[0].filter, /blur\(/);
  assert.equal(draws[1].filter, "none");

  // Todas as fontes do card usam Sora
  assert.ok(fontsUsed.length > 0);
  for (const font of fontsUsed) {
    assert.match(font, /Sora/);
  }

  // Câmbio normalizado via resolveTransmission + WhatsApp da config + regiões atendidas
  const renderedText = texts.map((item) => item.text).join("\n");
  assert.match(renderedText, /Manual/);
  assert.doesNotMatch(renderedText, /Automático/);
  assert.ok(renderedText.includes(`WhatsApp ${site.whatsappLabel}`));
  assert.ok(renderedText.includes(PROMO_SERVICE_AREAS_TEXT));
  assert.ok(renderedText.includes(PROMO_APPOINTMENT_TEXT));

  // Carro vendido no card nunca desenha o preço
  const soldCanvas = createMockCanvasContext();
  renderStoryCard(soldCanvas.ctx, { ...mockVehicle, status: "vendido" });
  const soldRendered = soldCanvas.texts.map((item) => item.text).join("\n");
  assert.match(soldRendered, /VENDIDO/);
  assert.doesNotMatch(soldRendered, /119\.900/);
});

test("VehiclePromoKitModal: botão fechar tem alvo >= 44x44px, sem crossOrigin externo, aguarda Sora e bloqueia consignado com mensagem clara", () => {
  const htmlOwn = renderToStaticMarkup(
    createElement(VehiclePromoKitModal, {
      vehicle: mockVehicle,
      open: true,
      onClose: () => {},
    }),
  );
  assert.match(htmlOwn, /<button\b[^>]*aria-label="Fechar"/);
  assert.match(
    htmlOwn,
    /class="[^"]*\bh-11\b[^"]*\bw-11\b[^"]*"[^>]*aria-label="Fechar"/,
  );
  assert.match(htmlOwn, /Copiar texto do WhatsApp/);

  const htmlConsigned = renderToStaticMarkup(
    createElement(VehiclePromoKitModal, {
      vehicle: { ...mockVehicle, consigned: true },
      open: true,
      onClose: () => {},
    }),
  );
  assert.match(htmlConsigned, /data-testid="consigned-promo-modal-blocked"/);
  assert.ok(htmlConsigned.includes(CONSIGNED_PROMO_BLOCKED_MESSAGE));
  assert.doesNotMatch(htmlConsigned, /Copiar texto do WhatsApp/);
  assert.doesNotMatch(htmlConsigned, /Baixar card para Status\/Stories/);

  const modalSource = readFileSync(
    new URL("../components/admin/VehiclePromoKitModal.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(modalSource, /crossOrigin\s*=\s*["']anonymous["']/);
  assert.match(modalSource, /document\.fonts\?\.ready/);
});

test("SheetActions e VehicleActionsMenu: ocultam Kit de divulgação e mostram aviso claro quando vehicle.consigned === true", () => {
  const noop = () => {};
  const ownHtml = renderToStaticMarkup(
    createElement(SheetActions, {
      vehicle: makeMockVehicleRow({ consigned: false }),
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
  assert.match(ownHtml, /Kit de divulgação/);
  assert.doesNotMatch(ownHtml, /data-testid="consigned-promo-blocked"/);

  const consignedHtml = renderToStaticMarkup(
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
  assert.doesNotMatch(consignedHtml, />Kit de divulgação</);
  assert.match(consignedHtml, /data-testid="consigned-promo-blocked"/);
  assert.ok(consignedHtml.includes(CONSIGNED_PROMO_BLOCKED_MESSAGE));

  const actionsMenuSource = readFileSync(
    new URL(
      "../components/admin/vehicle-form/VehicleActionsMenu.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(actionsMenuSource, /canUseVehiclePromoKit/);
  assert.match(actionsMenuSource, /CONSIGNED_PROMO_BLOCKED_MESSAGE/);
  assert.match(actionsMenuSource, /data-testid="consigned-promo-blocked"/);
});

test("GET /api/fotos/story/[vehicleId]: exige sessão admin, bloqueia consignado (403), rejeita URL externa arbitrária (400) e entrega imagem inline same-origin (200)", async () => {
  let sessionActive = true;
  let dbVehicle: { consigned: boolean; photos: Array<{ url: string }> } | null = {
    consigned: false,
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

  // 2. Consignado -> 403 com mensagem clara
  sessionActive = true;
  dbVehicle = {
    consigned: true,
    photos: [{ url: "https://pub-revisao123.r2.dev/corolla-capa.webp" }],
  };
  const consignedRes = await GET(
    new Request(`https://site.test/api/fotos/story/${mockVehicle.id}`),
    { params },
  );
  assert.equal(consignedRes.status, 403);
  assert.deepEqual(await consignedRes.json(), {
    error: CONSIGNED_PROMO_BLOCKED_MESSAGE,
  });

  // 3. URL externa arbitrária fora do acervo -> 400 (anti-SSRF)
  dbVehicle = {
    consigned: false,
    photos: [{ url: "https://pub-revisao123.r2.dev/corolla-capa.webp" }],
  };
  const ssrfRes = await GET(
    new Request(
      `https://site.test/api/fotos/story/${mockVehicle.id}?url=${encodeURIComponent("https://evil.example.com/x.jpg")}`,
    ),
    { params },
  );
  assert.equal(ssrfRes.status, 400);

  // 4. Estoque próprio válido -> 200 inline same-origin
  const okRes = await GET(
    new Request(`https://site.test/api/fotos/story/${mockVehicle.id}`),
    { params },
  );
  assert.equal(okRes.status, 200);
  assert.equal(okRes.headers.get("content-type"), "image/png");
  assert.equal(okRes.headers.get("content-disposition"), "inline");
  assert.equal((await okRes.arrayBuffer()).byteLength, 4);
});
