import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingQualityCard } from "@/components/admin/ListingQualityCard";
import { PublishChecklist } from "@/components/admin/PublishChecklist";
import {
  editListingGapLine,
  editListingGaps,
  formatRelativeUpdatedAt,
  listingGapBadges,
  publishChecklistItems,
  publishChecklistLine,
  publishMissingItems,
  publishMissingLine,
  stockListQuietNote,
} from "./stock-quality";

test("badges de lote apontam cor, fotos e preço sem inventar FIPE", () => {
  assert.deepEqual(
    listingGapBadges({ color: "", photos: [], price: 0 }),
    ["Sem cor", "Sem fotos", "Sem preço"],
  );
  assert.deepEqual(
    listingGapBadges({ color: "Prata", photos: [{ url: "a.webp" }], price: 64900 }),
    [],
  );
  assert.deepEqual(
    listingGapBadges({ color: "  ", photos: [{ url: "a.webp" }], price: 89900 }),
    ["Sem cor"],
  );
  assert.equal(
    listingGapBadges({ color: "Branco", photos: [{ url: "a.webp" }], price: 89900 }).includes(
      "FIPE",
    ),
    false,
  );
});

test("edição lista lacunas sem badge; vendido não lista", () => {
  assert.deepEqual(
    editListingGaps({
      status: "disponivel",
      color: "",
      photoCount: 0,
      price: 0,
      hasVideo: false,
    }),
    ["fotos", "preço", "cor", "vídeo"],
  );
  assert.equal(
    editListingGapLine({
      status: "disponivel",
      color: "Prata",
      photoCount: 4,
      price: 64900,
      hasVideo: false,
    }),
    "Falta no cadastro: vídeo",
  );
  assert.equal(
    editListingGapLine({
      status: "disponivel",
      color: "Prata",
      photoCount: 4,
      price: 89900,
      hasVideo: true,
      version: "EX 1.8 FLEX ONE Automático",
      transmission: "Manual",
    }),
    "Falta no cadastro: câmbio da versão",
  );
  assert.equal(
    editListingGaps({
      status: "vendido",
      color: "",
      photoCount: 0,
      price: 0,
      hasVideo: false,
    }).length,
    0,
  );
  assert.equal(
    editListingGapLine({
      status: "disponivel",
      color: "Prata",
      photoCount: 2,
      price: 50000,
      hasVideo: true,
    }),
    null,
  );
});

test("resumo da lista não cita vídeo", () => {
  assert.equal(
    stockListQuietNote({ withoutPhotos: 0, stale: 0, staleDays: 60 }),
    null,
  );
  assert.equal(
    stockListQuietNote({ withoutPhotos: 1, stale: 0, staleDays: 60 }),
    "1 anúncio sem foto",
  );
  const note = stockListQuietNote({ withoutPhotos: 3, stale: 2, staleDays: 60 });
  assert.equal(note, "3 anúncios sem foto · 2 parados há mais de 60 dias");
  assert.equal(note?.includes("vídeo"), false);
});

test("tempo relativo do lote fala em minutos, horas e dias", () => {
  const now = Date.parse("2026-09-14T20:00:00.000Z");
  assert.equal(formatRelativeUpdatedAt(new Date(now - 30_000), now), "agora");
  assert.equal(formatRelativeUpdatedAt(new Date(now - 12 * 60_000), now), "há 12 min");
  assert.equal(formatRelativeUpdatedAt(new Date(now - 2 * 60 * 60_000), now), "há 2 h");
  assert.equal(formatRelativeUpdatedAt(new Date(now - 26 * 60 * 60_000), now), "há 1 dia");
  assert.equal(formatRelativeUpdatedAt("nao-e-data", now), "");
});

test("publishMissingLine produz a linha única 'Falta: foto de capa, preço' e some quando completo", () => {
  assert.equal(
    publishMissingLine({ photoCount: 0, price: 0 }),
    "Falta: foto de capa, preço",
  );
  assert.equal(
    publishChecklistLine({ photos: [], price: "" }),
    "Falta: foto de capa, preço",
  );
  assert.equal(
    publishMissingLine({
      status: "disponivel",
      photoCount: 8,
      brand: "Honda",
      model: "Civic",
      version: "EXL",
      year: "2020",
      yearModel: "2021",
      km: "45.000",
      transmission: "Automático",
      fuel: "Flex",
      color: "Prata",
      price: 98900,
      description: "Único dono, revisado.",
      locationCity: "linhares",
    }),
    null,
  );
});

test("publishMissingItems mapeia cada pendência ao campo, seção e etapa corretos", () => {
  const items = publishMissingItems({
    status: "disponivel",
    photoCount: 0,
    brand: " ",
    model: "",
    year: "",
    yearModel: "2021",
    km: "",
    transmission: "",
    fuel: "",
    color: "",
    price: 0,
    locationCity: "",
  });

  assert.deepEqual(
    items.map((item) => ({
      id: item.id,
      label: item.label,
      field: item.field,
      section: item.section,
      step: item.step,
    })),
    [
      { id: "fotos", label: "foto de capa", field: "photos", section: "fotos", step: 1 },
      { id: "marca", label: "marca", field: "brand", section: "identificacao", step: 2 },
      { id: "modelo", label: "modelo", field: "model", section: "identificacao", step: 2 },
      { id: "preco", label: "preço", field: "priceDisplay", section: "essencial", step: 3 },
      { id: "ano", label: "ano", field: "year", section: "ficha", step: 2 },
      { id: "km", label: "km", field: "kmDisplay", section: "ficha", step: 2 },
      { id: "cambio", label: "câmbio", field: "transmission", section: "ficha", step: 2 },
      { id: "combustivel", label: "combustível", field: "fuel", section: "ficha", step: 2 },
      { id: "cor", label: "cor", field: "color", section: "identificacao", step: 2 },
      { id: "cidade", label: "cidade", field: "locationCity", section: "essencial", step: 4 },
    ],
  );
});

test("publishMissingItems respeita km zero, vendido sem preço, câmbio divergente e preço na legenda", () => {
  // Vendido nunca lista pendências nem preço
  assert.deepEqual(
    publishChecklistItems({
      status: "vendido",
      photoCount: 0,
      price: null,
      brand: "",
      model: "",
    }),
    [],
  );
  assert.equal(
    publishMissingLine({ status: "vendido", photoCount: 0, price: null }),
    null,
  );

  // KM 0 é válido (seminovo zero km)
  assert.deepEqual(publishMissingItems({ km: 0 }), []);
  assert.deepEqual(publishMissingItems({ km: "0" }), []);

  // Ano modelo faltando aponta para yearModel
  const missingYearModel = publishMissingItems({ year: 2020, yearModel: "" });
  assert.equal(missingYearModel.length, 1);
  assert.equal(missingYearModel[0]?.field, "yearModel");

  // Conflito entre versão e câmbio e divergência de preço na descrição
  const conflicts = publishMissingItems({
    status: "disponivel",
    version: "EX 1.8 Automático",
    transmission: "Manual",
    price: 59900,
    description: "Oferta por R$ 69.900 à vista.",
  });
  assert.deepEqual(
    conflicts.map((item) => item.label),
    ["câmbio da versão", "preço na legenda"],
  );
});

test("ListingQualityCard usa miniatura da capa e PublishChecklist sem cartão extra", () => {
  const root = new URL("../../", import.meta.url);
  const card = readFileSync(
    new URL("src/components/admin/ListingQualityCard.tsx", root),
    "utf8",
  );
  const checklist = readFileSync(
    new URL("src/components/admin/PublishChecklist.tsx", root),
    "utf8",
  );

  assert.match(card, /coverAssessmentSrc/);
  assert.match(card, /PublishChecklist/);
  assert.match(checklist, /if \(resolved\.length === 0\) return null/);
  assert.match(checklist, /Falta:/);
});

test("PublishChecklist e ListingQualityCard renderizam apenas o essencial (regra de tela limpa)", () => {
  // Quando nada falta, PublishChecklist some (retorna null)
  assert.equal(
    renderToStaticMarkup(createElement(PublishChecklist, { items: [] })),
    "",
  );

  // Quando faltam foto de capa e preço, renderiza uma única linha clicável
  const checklistHtml = renderToStaticMarkup(
    createElement(PublishChecklist, {
      draft: { photoCount: 0, price: 0 },
    }),
  );
  assert.match(checklistHtml, /data-testid="publish-checklist"/);
  assert.match(checklistHtml, /Falta:/);
  assert.match(checklistHtml, /<button[^>]*>foto de capa<\/button>/);
  assert.match(checklistHtml, /<button[^>]*>preço<\/button>/);

  const completeDraft = {
    brand: "Honda",
    model: "Civic",
    version: "EXL 2.0",
    year: "2020",
    yearModel: "2021",
    km: "45.000",
    transmission: "Automático",
    fuel: "Flex",
    color: "Prata",
    price: 98900,
    description:
      "Único dono, revisões em dia na concessionária autorizada até os 40 mil km, quatro pneus novos, manual, chave reserva e laudo cautelar aprovado sem retoque.",
    accessories: [
      "Ar-condicionado",
      "Direção elétrica",
      "Central multimídia",
      "Sensor de estacionamento",
    ],
    photoCount: 10,
    status: "disponivel",
    category: "carro",
  };

  // Completo e sem nota ainda: não ocupa espaço nenhum na tela
  assert.equal(
    renderToStaticMarkup(
      createElement(ListingQualityCard, {
        draft: completeDraft,
        coverUrl: "/branding/placeholder-car.png",
        judgment: null,
        scoredAt: null,
        dirty: false,
        saving: false,
        onJump: () => {},
      }),
    ),
    "",
  );

  // Vendido nunca exibe qualidade ou preço
  assert.equal(
    renderToStaticMarkup(
      createElement(ListingQualityCard, {
        draft: { ...completeDraft, status: "vendido", price: null, photoCount: 0 },
        coverUrl: "",
        judgment: {
          captionScore: 3,
          captionConfidence: 0.9,
          thinOptions: 0.1,
          focus: "nada",
        },
        scoredAt: "2026-10-30T12:00:00.000Z",
        dirty: false,
        saving: false,
        onJump: () => {},
      }),
    ),
    "",
  );

  // Completo e com nota do Jev: exibe resumo compacto em uma linha
  const scoredHtml = renderToStaticMarkup(
    createElement(ListingQualityCard, {
      draft: completeDraft,
      coverUrl: "/branding/placeholder-car.png",
      judgment: {
        captionScore: 3,
        captionConfidence: 0.9,
        thinOptions: 0.1,
        focus: "nada",
      },
      scoredAt: "2026-10-30T12:00:00.000Z",
      dirty: false,
      saving: false,
      onJump: () => {},
    }),
  );
  assert.match(scoredHtml, /Nota do anúncio:/);
  assert.match(scoredHtml, /10,0\/10 \(Forte\)/);
  assert.doesNotMatch(scoredHtml, /Falta:/);

  // Com sugestões opcionais (ex.: poucas fotos), fica recolhido em <details>
  const detailsHtml = renderToStaticMarkup(
    createElement(ListingQualityCard, {
      draft: { ...completeDraft, photoCount: 3 },
      coverUrl: "/branding/placeholder-car.png",
      judgment: null,
      scoredAt: null,
      dirty: false,
      saving: false,
      onJump: () => {},
    }),
  );
  assert.match(detailsHtml, /<details/);
  assert.match(detailsHtml, /poucas fotos/i);
});
