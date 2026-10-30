import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import Module from "node:module";
import { createRequire } from "node:module";

type DraftRecord = {
  adminId: string;
  key: string;
  payload: unknown;
  photoUrls: string[];
  expiresAt: Date;
  updatedAt: Date;
};

type State = {
  drafts: DraftRecord[];
  vehicles: Array<{
    id: string;
    brand: string;
    model: string;
    version: string;
    year: number;
    yearModel: number;
    category: string;
    fuel: string;
    transmission: string;
    engine: string;
    doors: number;
    description: string;
    accessories: string[];
    plate: string;
    km: number;
    price: number;
  }>;
  cache: unknown[];
};

let state: State;

function fixture(): State {
  return {
    drafts: [],
    vehicles: [
      {
        id: "v-1",
        brand: "Honda",
        model: "Civic",
        version: "Touring 1.5 Turbo",
        year: 2021,
        yearModel: 2022,
        category: "carro",
        fuel: "Gasolina",
        transmission: "Automático",
        engine: "1.5 Turbo",
        doors: 4,
        description: "Revisado na concessionária.",
        accessories: ["Teto solar", "Bancos de couro"],
        plate: "ABC1D23",
        km: 30000,
        price: 130000,
      },
    ],
    cache: [],
  };
}

const client = {
  vehicle: {
    findUnique: async ({ where }: { where: { id: string } }) =>
      state.vehicles.find((v) => v.id === where.id) ?? null,
  },
  adminDraft: {
    findUnique: async ({
      where,
    }: {
      where: { adminId_key: { adminId: string; key: string } };
    }) =>
      state.drafts.find(
        (d) =>
          d.adminId === where.adminId_key.adminId &&
          d.key === where.adminId_key.key,
      ) ?? null,
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { adminId_key: { adminId: string; key: string } };
      create: {
        adminId: string;
        key: string;
        payload: unknown;
        photoUrls: string[];
        expiresAt: Date;
      };
      update: {
        payload: unknown;
        photoUrls: string[];
        expiresAt: Date;
        updatedAt?: Date;
      };
    }) => {
      const idx = state.drafts.findIndex(
        (d) =>
          d.adminId === where.adminId_key.adminId &&
          d.key === where.adminId_key.key,
      );
      if (idx >= 0) {
        state.drafts[idx] = {
          ...state.drafts[idx],
          payload: update.payload,
          photoUrls: update.photoUrls,
          expiresAt: update.expiresAt,
          updatedAt: update.updatedAt ?? new Date(),
        };
        return state.drafts[idx];
      }
      const record: DraftRecord = {
        adminId: create.adminId,
        key: create.key,
        payload: create.payload,
        photoUrls: create.photoUrls,
        expiresAt: create.expiresAt,
        updatedAt: new Date(),
      };
      state.drafts.push(record);
      return record;
    },
  },
};

const require = createRequire(import.meta.url);
const loader = Module as unknown as {
  _load: (id: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = loader._load;
loader._load = function (id, parent, isMain) {
  if (id === "@/lib/auth")
    return {
      getSession: async () => ({ adminId: "admin-1", email: "admin@test.com" }),
    };
  if (id === "@/lib/prisma") return { prisma: client };
  if (id === "next/cache")
    return {
      revalidatePath: (...args: unknown[]) => state.cache.push(args),
      revalidateTag: (...args: unknown[]) => state.cache.push(args),
      updateTag: (...args: unknown[]) => state.cache.push(args),
      unstable_cache: (fn: unknown) => fn,
    };
  return originalLoad.call(this, id, parent, isMain);
};

let duplicateVehicle: typeof import("../app/admin/veiculos/actions").duplicateVehicle;
try {
  const actions = require("../app/admin/veiculos/actions.ts");
  duplicateVehicle = actions.duplicateVehicle;
} finally {
  loader._load = originalLoad;
}

beforeEach(() => {
  state = fixture();
});

test("duplicateVehicle retorna erro quando o veículo não existe", async () => {
  const result = await duplicateVehicle("nao-existe");
  assert.equal(result.ok, false);
  assert.equal(result.message, "Veículo não encontrado.");
});

test("duplicateVehicle cria rascunho vehicle:new quando não há rascunho anterior", async () => {
  const result = await duplicateVehicle("v-1");
  assert.equal(result.ok, true);
  assert.equal(result.redirectUrl, "/admin/veiculos/novo");
  assert.equal(result.message, "Rascunho criado a partir do anúncio.");

  const draft = state.drafts.find((d) => d.key === "vehicle:new");
  assert.ok(draft);
  assert.equal(draft.adminId, "admin-1");
  const payload = draft.payload as Record<string, unknown>;
  assert.equal(payload.brand, "Honda");
  assert.equal(payload.model, "Civic");
  assert.equal(payload.plate, "");
  assert.deepEqual(payload.photos, []);
});

test("duplicateVehicle impede sobrescrever rascunho com conteúdo sem replaceDraft", async () => {
  // Simula rascunho existente com dados
  state.drafts.push({
    adminId: "admin-1",
    key: "vehicle:new",
    payload: { brand: "Toyota", model: "Corolla", fields: { brand: "Toyota" } },
    photoUrls: [],
    expiresAt: new Date(Date.now() + 86400000),
    updatedAt: new Date(),
  });

  const result = await duplicateVehicle("v-1");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.hasExistingDraft, true);
    assert.match(result.message, /rascunho de novo veículo em andamento/);
  }

  // Confere que o rascunho original não foi alterado
  const draft = state.drafts.find((d) => d.key === "vehicle:new");
  assert.equal((draft?.payload as Record<string, unknown>).brand, "Toyota");
  // E nenhum backup foi criado
  assert.equal(state.drafts.some((d) => d.key === "vehicle:new:backup"), false);
});

test("duplicateVehicle com replaceDraft preserva rascunho anterior em backup e substitui vehicle:new", async () => {
  // Simula rascunho existente com dados
  state.drafts.push({
    adminId: "admin-1",
    key: "vehicle:new",
    payload: { brand: "Toyota", model: "Corolla", fields: { brand: "Toyota" } },
    photoUrls: ["https://storage/old-photo.webp"],
    expiresAt: new Date(Date.now() + 86400000),
    updatedAt: new Date(),
  });

  const result = await duplicateVehicle("v-1", { replaceDraft: true });
  assert.equal(result.ok, true);
  assert.equal(result.redirectUrl, "/admin/veiculos/novo");

  // Rascunho anterior foi preservado em vehicle:new:backup
  const backup = state.drafts.find((d) => d.key === "vehicle:new:backup");
  assert.ok(backup, "backup deve existir");
  assert.equal((backup.payload as Record<string, unknown>).brand, "Toyota");
  assert.deepEqual(backup.photoUrls, ["https://storage/old-photo.webp"]);

  // Novo rascunho foi salvo em vehicle:new
  const current = state.drafts.find((d) => d.key === "vehicle:new");
  assert.ok(current);
  assert.equal((current.payload as Record<string, unknown>).brand, "Honda");
  assert.equal((current.payload as Record<string, unknown>).model, "Civic");
});
