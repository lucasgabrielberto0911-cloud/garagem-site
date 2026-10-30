import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDuplicateDraftPayload,
  DUPLICATE_BACKUP_KEY,
  DUPLICATE_DRAFT_KEY,
  hasDraftContent,
  type DuplicateSourceVehicle,
} from "./admin-duplicate-vehicle";

const mockVehicle: DuplicateSourceVehicle = {
  category: "carro",
  brand: "Toyota",
  model: "Corolla",
  version: "XEi 2.0 Flex",
  year: 2022,
  yearModel: 2023,
  km: 35000,
  price: 135000,
  color: "Prata",
  plate: "ABC1D23",
  plateEnd: "3",
  fuel: "Flex",
  transmission: "Automático",
  engine: "2.0",
  doors: 4,
  description: "Veículo completo, único dono, revisões na concessionária.",
  warranty: "Garantia de fábrica até 2025",
  inspection: "Laudo cautelar 100% aprovado",
  accessories: ["Ar-condicionado", "Direção elétrica", "Bancos de couro"],
  locationCity: "Linhares",
  consigned: false,
  hasSpareKey: true,
  hasManual: true,
  featured: true,
  photos: [
    { url: "https://storage/photo1.webp", thumbnailUrl: "https://storage/photo1-card.webp" },
    { url: "https://storage/photo2.webp", thumbnailUrl: "https://storage/photo2-card.webp" },
  ],
};

test("duplicação copia campos de modelo (marca, modelo, versão, opcionais, legenda)", () => {
  const draft = buildDuplicateDraftPayload(mockVehicle);
  const fields = draft.fields as Record<string, string>;

  assert.equal(draft.brand, "Toyota");
  assert.equal(draft.model, "Corolla");
  assert.equal(draft.version, "XEi 2.0 Flex");
  assert.equal(draft.category, "carro");
  assert.equal(draft.fuel, "Flex");
  assert.equal(draft.transmission, "Automático");
  assert.equal(draft.engine, "2.0");
  assert.equal(draft.description, "Veículo completo, único dono, revisões na concessionária.");
  assert.deepEqual(draft.accessories, ["Ar-condicionado", "Direção elétrica", "Bancos de couro"]);
  assert.equal(fields.doors, "4");
  assert.equal(fields.warranty, "Garantia de fábrica até 2025");
  assert.equal(fields.inspection, "Laudo cautelar 100% aprovado");
  assert.equal(fields.hasSpareKey, "on");
  assert.equal(fields.hasManual, "on");
});

test("duplicação limpa campos individuais do carro (sem fotos, placa, km, preço, cor)", () => {
  const draft = buildDuplicateDraftPayload(mockVehicle);
  const fields = draft.fields as Record<string, string>;

  assert.deepEqual(draft.photos, []);
  assert.equal(draft.color, "");
  assert.equal(draft.plate, "");
  assert.equal(draft.plateEnd, "");
  assert.equal(draft.purchase, "");
  assert.equal(draft.status, "disponivel");

  assert.equal(fields.km, "");
  assert.equal(fields.price, "");
  assert.equal(fields.color, "");
  assert.equal(fields.plate, "");
  assert.equal(fields.plateEnd, "");
  assert.equal(fields.purchasePrice, "");
  assert.equal(fields.featured, "");
});

test("constantes de chaves de rascunho de duplicação", () => {
  assert.equal(DUPLICATE_DRAFT_KEY, "vehicle:new");
  assert.equal(DUPLICATE_BACKUP_KEY, "vehicle:new:backup");
});

test("hasDraftContent identifica rascunho com e sem conteúdo", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  const future = new Date("2026-11-30T12:00:00Z");
  const past = new Date("2026-10-29T12:00:00Z");

  // Nulo ou indefinido
  assert.equal(hasDraftContent(null, now), false);
  assert.equal(hasDraftContent(undefined, now), false);

  // Rascunho expirado é ignorado
  assert.equal(
    hasDraftContent(
      {
        expiresAt: past,
        payload: { brand: "Toyota", model: "Corolla" },
      },
      now,
    ),
    false,
  );

  // Payload vazio ou só com defaults em branco
  assert.equal(
    hasDraftContent(
      {
        expiresAt: future,
        payload: {},
      },
      now,
    ),
    false,
  );
  assert.equal(
    hasDraftContent(
      {
        expiresAt: future,
        payload: {
          step: 1,
          fields: { brand: "", model: "", plate: "   " },
          photos: [],
          accessories: [],
        },
      },
      now,
    ),
    false,
  );

  // Com fotos protegidas na coluna photoUrls
  assert.equal(
    hasDraftContent(
      {
        expiresAt: future,
        photoUrls: ["https://storage/temp.webp"],
        payload: {},
      },
      now,
    ),
    true,
  );

  // Com fotos no payload
  assert.equal(
    hasDraftContent(
      {
        expiresAt: future,
        payload: {
          photos: [{ url: "https://storage/temp.webp" }],
        },
      },
      now,
    ),
    true,
  );

  // Com campos de texto no payload
  assert.equal(
    hasDraftContent(
      {
        expiresAt: future,
        payload: { brand: "Honda" },
      },
      now,
    ),
    true,
  );

  // Com opcionais no payload
  assert.equal(
    hasDraftContent(
      {
        expiresAt: future,
        payload: { accessories: ["Ar-condicionado"] },
      },
      now,
    ),
    true,
  );

  // Com campos preenchidos em fields
  assert.equal(
    hasDraftContent(
      {
        expiresAt: future,
        payload: {
          fields: { model: "Civic" },
        },
      },
      now,
    ),
    true,
  );
});
