import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import type { ListingDraft, ListingJudgment } from "./listing-present";
import {
  listingDraftFromVehicle,
  listingInputHash,
  parseStoredListingScore,
  refreshListingScoreOnSave,
  scorable,
  shouldScoreOnSave,
  type ListingScoreDeps,
} from "./listing-score";

const vehicle = {
  brand: "Honda",
  model: "Civic",
  version: "EXL",
  year: 2020,
  yearModel: 2021,
  km: 45000,
  transmission: "Automático",
  fuel: "Flex",
  color: "Prata",
  price: 98900,
  description: "Único dono, revisões feitas.",
  accessories: ["Ar-condicionado", "Multimídia"],
  status: "disponivel",
  category: "carro",
};
const base = listingDraftFromVehicle(vehicle, 8);
const judgment: ListingJudgment = {
  captionScore: 2,
  captionConfidence: 0.8,
  thinOptions: 0.2,
  focus: "nada",
};
const quiet = { info() {}, warn() {} };

function fakeDeps(over: Partial<ListingScoreDeps> & { stored?: string | null } = {}) {
  const calls = { judge: 0, save: 0, load: 0, saved: null as null | { hash: string } };
  const deps: ListingScoreDeps = {
    log: quiet,
    load: async () => {
      calls.load += 1;
      return over.stored ? { inputHash: over.stored } : null;
    },
    save: async (_id, _judgment, hash) => {
      calls.save += 1;
      calls.saved = { hash };
    },
    judge: async () => {
      calls.judge += 1;
      return judgment;
    },
    ...over,
  };
  return { deps, calls };
}

test("salvar sem nenhuma mudança não chama o Jev nem o banco", async () => {
  const { deps, calls } = fakeDeps();
  const outcome = await refreshListingScoreOnSave(
    { vehicleId: "v1", before: base, after: { ...base } },
    deps,
  );
  assert.equal(outcome, "sem-mudanca");
  assert.equal(calls.judge, 0);
  assert.equal(calls.load, 0);
  assert.equal(calls.save, 0);
});

test("mudança em campo que afeta a nota chama o Jev uma vez e grava", async () => {
  const { deps, calls } = fakeDeps();
  const after = { ...base, description: "Único dono, pneus novos, revisão na concessionária." };
  const outcome = await refreshListingScoreOnSave(
    { vehicleId: "v1", before: base, after },
    deps,
  );
  assert.equal(outcome, "calculada");
  assert.equal(calls.judge, 1);
  assert.equal(calls.save, 1);
  assert.equal(calls.saved?.hash, listingInputHash(after));
});

test("preço, km e opcionais contam como mudança", () => {
  for (const after of [
    { ...base, price: 95900 },
    { ...base, km: "50000" },
    { ...base, accessories: [...base.accessories, "Teto solar"] },
  ]) {
    assert.equal(shouldScoreOnSave({ before: base, after, storedHash: null }), true);
  }
});

test("campo que o Jev não lê (placa, cidade, custo) não chama", async () => {
  // listingDraftFromVehicle ignora esses campos: o rascunho fica idêntico.
  const before = listingDraftFromVehicle({ ...vehicle, plate: "ABC1D23" } as typeof vehicle, 8);
  const after = listingDraftFromVehicle({ ...vehicle, plate: "XYZ9Z99" } as typeof vehicle, 8);
  const { deps, calls } = fakeDeps();
  assert.equal(
    await refreshListingScoreOnSave({ vehicleId: "v1", before, after }, deps),
    "sem-mudanca",
  );
  assert.equal(calls.judge, 0);
  // Fotos entram na nota pelo cálculo local (sem rede), não pelo Jev.
  assert.equal(
    shouldScoreOnSave({ before: base, after: { ...base, photoCount: 12 }, storedHash: null }),
    false,
  );
});

test("texto já avaliado (nota gravada com o mesmo hash) não chama de novo", async () => {
  const after = { ...base, color: "Preto" };
  const { deps, calls } = fakeDeps({ stored: listingInputHash(after) });
  assert.equal(
    await refreshListingScoreOnSave({ vehicleId: "v1", before: base, after }, deps),
    "sem-mudanca",
  );
  assert.equal(calls.judge, 0);
});

test("anúncio novo conta como alteração", async () => {
  const { deps, calls } = fakeDeps();
  assert.equal(
    await refreshListingScoreOnSave({ vehicleId: "v1", before: null, after: base }, deps),
    "calculada",
  );
  assert.equal(calls.judge, 1);
});

test("Jev falhando não lança e não sobrescreve a nota", async () => {
  const { deps, calls } = fakeDeps({ judge: async () => null });
  const after = { ...base, version: "Touring" };
  assert.equal(
    await refreshListingScoreOnSave({ vehicleId: "v1", before: base, after }, deps),
    "jev-falhou",
  );
  assert.equal(calls.save, 0);
});

test("Jev lançando erro ou banco fora não derrubam o Salvar", async () => {
  const after = { ...base, version: "Touring" };
  const boom = fakeDeps({
    judge: async () => {
      throw new Error("rede");
    },
  });
  assert.equal(
    await refreshListingScoreOnSave({ vehicleId: "v1", before: base, after }, boom.deps),
    "erro",
  );
  const noTable = fakeDeps({
    load: async () => {
      throw Object.assign(new Error("tabela"), { code: "P2021" });
    },
  });
  assert.equal(
    await refreshListingScoreOnSave({ vehicleId: "v1", before: base, after }, noTable.deps),
    "erro",
  );
  assert.equal(noTable.calls.judge, 0);
});

test("vendido ou sem marca/modelo não chama o Jev", async () => {
  const { deps, calls } = fakeDeps();
  await refreshListingScoreOnSave(
    { vehicleId: "v1", before: base, after: { ...base, status: "vendido" } },
    deps,
  );
  await refreshListingScoreOnSave(
    { vehicleId: "v1", before: null, after: { ...base, brand: " " } as ListingDraft },
    deps,
  );
  assert.equal(calls.judge, 0);
});

test("o admin no navegador não chama o Jev (nem rota de nota)", () => {
  const root = new URL("../../", import.meta.url);
  const card = readFileSync(
    new URL("src/components/admin/ListingQualityCard.tsx", root),
    "utf8",
  );
  assert.doesNotMatch(card, /fetch\(/);
  assert.doesNotMatch(card, /anuncios\/nota/);
  assert.equal(
    existsSync(new URL("src/app/api/admin/anuncios/nota/route.ts", root)),
    false,
  );
  const form = readFileSync(new URL("src/components/admin/VehicleForm.tsx", root), "utf8");
  assert.doesNotMatch(form, /judgeListingQuality|askJev|anuncios\/nota/);
  const page = readFileSync(new URL("src/app/admin/veiculos/[id]/page.tsx", root), "utf8");
  assert.doesNotMatch(page, /judgeListingQuality|askJev|scoreListingAfterSave/);
});

test("scorable: valida critérios mínimos para chamar o Jev", () => {
  assert.equal(scorable(base), true);
  assert.equal(scorable({ ...base, status: "reservado" }), true);
  assert.equal(scorable({ ...base, status: "vendido" }), false);
  assert.equal(scorable({ ...base, brand: "" }), false);
  assert.equal(scorable({ ...base, brand: "   " }), false);
  assert.equal(scorable({ ...base, model: "" }), false);
  assert.equal(scorable({ ...base, model: "   " }), false);
});

test("parseStoredListingScore: converte linha do banco e valida estrutura", () => {
  assert.equal(parseStoredListingScore(null), null);
  assert.equal(
    parseStoredListingScore({
      judgment: null,
      inputHash: "hash123",
      updatedAt: new Date(),
    }),
    null,
  );
  assert.equal(
    parseStoredListingScore({
      judgment: { captionScore: 2 }, // Faltam campos obrigatórios do judgment
      inputHash: "hash123",
      updatedAt: new Date(),
    }),
    null,
  );

  const date = new Date("2026-10-10T15:30:00.000Z");
  const parsed = parseStoredListingScore({
    judgment,
    inputHash: "hash-valido",
    updatedAt: date,
  });
  assert.deepEqual(parsed, {
    judgment,
    inputHash: "hash-valido",
    scoredAt: date.toISOString(),
  });
});

test("refreshListingScoreOnSave: retorno do Jev com formato inválido resulta em jev-falhou sem gravar", async () => {
  const invalidJudgment = { captionScore: "invalido" } as unknown as ListingJudgment;
  const { deps, calls } = fakeDeps({ judge: async () => invalidJudgment });
  const after = { ...base, version: "Touring" };

  const outcome = await refreshListingScoreOnSave(
    { vehicleId: "v1", before: base, after },
    deps,
  );
  assert.equal(outcome, "jev-falhou");
  assert.equal(calls.save, 0);
});

test("refreshListingScoreOnSave: falha ao gravar no banco não derruba o Salvar e retorna erro", async () => {
  const { deps } = fakeDeps({
    save: async () => {
      throw new Error("falha de conexão ao salvar nota");
    },
  });
  const after = { ...base, version: "Touring" };

  const outcome = await refreshListingScoreOnSave(
    { vehicleId: "v1", before: base, after },
    deps,
  );
  assert.equal(outcome, "erro");
});

test("refreshListingScoreOnSave: veículo não avaliável retorna nao-avaliavel diretamente", async () => {
  const { deps, calls } = fakeDeps();
  const outcomeVendido = await refreshListingScoreOnSave(
    { vehicleId: "v1", before: base, after: { ...base, status: "vendido" } },
    deps,
  );
  assert.equal(outcomeVendido, "nao-avaliavel");
  assert.equal(calls.judge, 0);
  assert.equal(calls.load, 0);

  const outcomeSemModelo = await refreshListingScoreOnSave(
    { vehicleId: "v1", before: base, after: { ...base, model: "  " } },
    deps,
  );
  assert.equal(outcomeSemModelo, "nao-avaliavel");
  assert.equal(calls.judge, 0);
  assert.equal(calls.load, 0);
});

test("campos técnicos avaliados pelo Jev disparam recálculo", () => {
  // Combustível
  assert.equal(
    shouldScoreOnSave({ before: base, after: { ...base, fuel: "Diesel" }, storedHash: null }),
    true,
  );
  // Câmbio
  assert.equal(
    shouldScoreOnSave({ before: base, after: { ...base, transmission: "Manual" }, storedHash: null }),
    true,
  );
  // Ano / Modelo
  assert.equal(
    shouldScoreOnSave({ before: base, after: { ...base, yearModel: "2022" }, storedHash: null }),
    true,
  );
  // Categoria
  assert.equal(
    shouldScoreOnSave({ before: base, after: { ...base, category: "moto" }, storedHash: null }),
    true,
  );
  // Versão
  assert.equal(
    shouldScoreOnSave({ before: base, after: { ...base, version: "Touring" }, storedHash: null }),
    true,
  );
});

test("reabrir rascunho sem before mas com hash já gravado no banco não chama o Jev", async () => {
  const hashGravado = listingInputHash(base);
  const { deps, calls } = fakeDeps({ stored: hashGravado });

  const outcome = await refreshListingScoreOnSave(
    { vehicleId: "v1", before: null, after: base },
    deps,
  );
  assert.equal(outcome, "sem-mudanca");
  assert.equal(calls.load, 1);
  assert.equal(calls.judge, 0);
  assert.equal(calls.save, 0);
});

