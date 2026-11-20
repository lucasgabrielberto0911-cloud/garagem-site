import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MAX_FEATURED_PINS,
  MAX_HOME_FEATURED,
  canEnableFeatured,
  featuredCapMessage,
  featuredOrdersFromIds,
  featuredRotationPeriod,
  featuredSlotState,
  hasShowcaseCoverPhoto,
  moveFeaturedIds,
  nextFeaturedOrder,
  shuffleForFeaturedPeriod,
  sortFeaturedForHome,
  sortShowcaseVehicles,
} from "./featured";
import { parseStockFilters, type VehicleCardRecord } from "./stock-query";
import {
  buildStockWhere,
  featuredCacheKey,
  fetchFeaturedVehicles,
  type FeaturedShowcaseQuery,
} from "./vehicles";

test("grade da home mantém teto de 8 e teto de fixados (pins) é 4", () => {
  assert.equal(MAX_HOME_FEATURED, 8);
  assert.equal(MAX_FEATURED_PINS, 4);

  const atThree = featuredSlotState(3);
  assert.equal(atThree.max, 4);
  assert.equal(atThree.atCap, false);
  assert.equal(atThree.remaining, 1);

  const atFour = featuredSlotState(4);
  assert.equal(atFour.max, 4);
  assert.equal(atFour.atCap, true);
  assert.equal(atFour.remaining, 0);

  // Recusa o 5º pin, mas permite quem já está marcado permanecer
  assert.equal(canEnableFeatured(3, false), true);
  assert.equal(canEnableFeatured(4, false), false);
  assert.equal(canEnableFeatured(5, false), false);
  assert.equal(canEnableFeatured(4, true), true);
  assert.equal(canEnableFeatured(6, true), true);
  assert.match(featuredCapMessage(), /4 destaques/);
});

test("period usa blocos de 2 dias corridos no fuso America/Sao_Paulo", () => {
  // 1970-01-01 e 1970-01-02 em São Paulo -> dias 0 e 1 -> period 0
  assert.equal(featuredRotationPeriod(new Date("1970-01-01T12:00:00-03:00")), 0);
  assert.equal(featuredRotationPeriod(new Date("1970-01-02T23:59:59-03:00")), 0);
  // 1970-01-03 02:59:59Z ainda é 1970-01-02 23:59:59 em São Paulo -> period 0
  assert.equal(featuredRotationPeriod(new Date("1970-01-03T02:59:59Z")), 0);
  // Virada da meia-noite em São Paulo (03:00 UTC) -> dia 2 -> period 1
  assert.equal(featuredRotationPeriod(new Date("1970-01-03T03:00:00Z")), 1);
  assert.equal(featuredRotationPeriod(new Date("1970-01-04T23:59:59-03:00")), 1);
  assert.equal(featuredRotationPeriod(new Date("1970-01-05T00:00:00-03:00")), 2);

  // Mesmo dia em São Paulo (manhã vs 23:30 SP = 02:30Z do dia seguinte em UTC) -> mesmo period
  const morningSp = new Date("2026-11-20T09:00:00-03:00");
  const lateNightSp = new Date("2026-11-21T02:30:00Z"); // 2026-11-20 23:30 SP
  assert.equal(
    featuredRotationPeriod(morningSp),
    featuredRotationPeriod(lateNightSp),
  );
});

test("shuffleForFeaturedPeriod é determinístico, estável por id e muda na virada do período", () => {
  const pool = Array.from({ length: 12 }, (_, idx) => ({
    id: `veiculo-${String(idx + 1).padStart(2, "0")}`,
  }));
  const reversed = [...pool].reverse();

  const p100a = shuffleForFeaturedPeriod(pool, 100).map((v) => v.id);
  const p100b = shuffleForFeaturedPeriod(reversed, 100).map((v) => v.id);
  const p101 = shuffleForFeaturedPeriod(pool, 101).map((v) => v.id);

  assert.deepEqual(p100a, p100b);
  assert.notDeepEqual(p100a, p101);
  assert.deepEqual([...p100a].sort(), pool.map((v) => v.id).sort());
});

test("chave de cache inclui period e muda quando o bloco de 2 dias vira", () => {
  const keyA = featuredCacheKey(MAX_HOME_FEATURED, 10380);
  const keyB = featuredCacheKey(MAX_HOME_FEATURED, 10381);
  assert.match(keyA, /:8:10380$/);
  assert.match(keyB, /:8:10381$/);
  assert.notEqual(keyA, keyB);
});

test("ordem da home usa featuredOrder e cai na data se faltar número", () => {
  const sorted = sortFeaturedForHome([
    { featuredOrder: 2, createdAt: "2026-01-01" },
    { featuredOrder: null, createdAt: "2026-03-01" },
    { featuredOrder: 1, createdAt: "2026-02-01" },
  ]);
  assert.equal(sorted[0]?.featuredOrder, 1);
  assert.equal(sorted[1]?.featuredOrder, 2);
  assert.equal(sorted[2]?.featuredOrder, null);
  assert.equal(nextFeaturedOrder([1, 3, null]), 4);
  assert.equal(nextFeaturedOrder([]), 1);
});

test("setas sobem e descem o id na vitrine", () => {
  const ids = ["a", "b", "c"];
  assert.deepEqual(moveFeaturedIds(ids, 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moveFeaturedIds(ids, 0, 1), ["b", "a", "c"]);
  assert.deepEqual(featuredOrdersFromIds(["c", "a"]), [
    { id: "c", featuredOrder: 1 },
    { id: "a", featuredOrder: 2 },
  ]);
});

type StoredVehicleRow = VehicleCardRecord & {
  consigned?: boolean;
  historical?: boolean;
};

function makeCard(
  overrides: Partial<StoredVehicleRow> & Pick<StoredVehicleRow, "id">,
): StoredVehicleRow {
  return {
    id: overrides.id,
    category: overrides.category ?? "carro",
    brand: overrides.brand ?? "Chevrolet",
    model: overrides.model ?? "Onix",
    version: overrides.version ?? "1.0 Turbo",
    yearModel: overrides.yearModel ?? 2023,
    km: overrides.km ?? 32000,
    price: overrides.price ?? 79900,
    transmission: overrides.transmission ?? "Automático",
    fuel: overrides.fuel ?? "Flex",
    status: overrides.status ?? "disponivel",
    featured: overrides.featured ?? false,
    consigned: overrides.consigned ?? false,
    historical: overrides.historical ?? false,
    createdAt: overrides.createdAt ?? "2026-10-01T12:00:00.000Z",
    photos:
      overrides.photos ?? [{ url: `/fotos/${overrides.id}.webp`, thumbnailUrl: null }],
  };
}

function makeInMemoryFinder(rows: StoredVehicleRow[]) {
  const queries: FeaturedShowcaseQuery[] = [];
  const find = async (args: FeaturedShowcaseQuery): Promise<VehicleCardRecord[]> => {
    queries.push(args);
    const filtered = rows.filter((row) => {
      if (row.status !== args.where.status) return false;
      if (args.where.historical === false && row.historical === true) return false;
      if (row.featured !== args.where.featured) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (a.yearModel !== b.yearModel) return b.yearModel - a.yearModel;
      if (a.km !== b.km) return a.km - b.km;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted.slice(0, args.take).map((row) => {
      const { consigned: _consigned, historical: _historical, ...card } = row;
      void _consigned;
      void _historical;
      return card;
    });
  };
  return { find, queries };
}

test("sortShowcaseVehicles prioriza foto de capa, ordem do painel e ano mais novo", () => {
  assert.equal(hasShowcaseCoverPhoto({ photos: [] }), false);
  assert.equal(hasShowcaseCoverPhoto({ photos: [{ url: "   " }] }), false);
  assert.equal(
    hasShowcaseCoverPhoto({ photos: [{ url: "", thumbnailUrl: "/fotos/capa.webp" }] }),
    true,
  );

  const ordered = sortShowcaseVehicles([
    {
      id: "sandero-2009",
      yearModel: 2009,
      km: 173500,
      featured: true,
      createdAt: "2026-11-15T10:00:00Z",
      photos: [{ url: "/fotos/sandero.webp" }],
    },
    {
      id: "novo-sem-foto-2026",
      yearModel: 2026,
      km: 5000,
      featured: true,
      createdAt: "2026-11-16T10:00:00Z",
      photos: [],
    },
    {
      id: "corolla-2024",
      yearModel: 2024,
      km: 28000,
      featured: false,
      createdAt: "2026-10-10T10:00:00Z",
      photos: [{ url: "/fotos/corolla.webp" }],
    },
    {
      id: "compass-2024-menor-km",
      yearModel: 2024,
      km: 14000,
      featured: false,
      createdAt: "2026-10-05T10:00:00Z",
      photos: [{ url: "/fotos/compass.webp" }],
    },
  ]);

  assert.deepEqual(
    ordered.map((item) => item.id),
    [
      "compass-2024-menor-km",
      "corolla-2024",
      "sandero-2009",
      "novo-sem-foto-2026",
    ],
  );
});

test("pins vêm primeiro (mesmo mais antigos), consignado entra e vendidos/indisponíveis ficam fora", async () => {
  const rows: StoredVehicleRow[] = [
    // 2 pins válidos: 1 próprio (2015) e 1 consignado (2021) -> ambos devem liderar a grade
    makeCard({
      id: "pin-proprio-2015",
      yearModel: 2015,
      km: 98000,
      featured: true,
      consigned: false,
    }),
    makeCard({
      id: "pin-consignado-2021",
      yearModel: 2021,
      km: 42000,
      featured: true,
      consigned: true,
    }),
    // Vendido, reservado e histórico nunca entram (mesmo marcados)
    makeCard({
      id: "vendido-2026",
      yearModel: 2026,
      status: "vendido",
      featured: true,
    }),
    makeCard({
      id: "reservado-2026",
      yearModel: 2026,
      status: "reservado",
      featured: false,
    }),
    makeCard({
      id: "historico-2025",
      yearModel: 2025,
      historical: true,
      featured: true,
    }),
    // Estoque disponível não fixado (próprios + consignado) para o rodízio de 2 dias
    makeCard({ id: "rot-consignado-2025", yearModel: 2025, featured: false, consigned: true }),
    makeCard({ id: "rot-01", yearModel: 2026, featured: false }),
    makeCard({ id: "rot-02", yearModel: 2025, featured: false }),
    makeCard({ id: "rot-03", yearModel: 2024, featured: false }),
    makeCard({ id: "rot-04", yearModel: 2023, featured: false }),
    makeCard({ id: "rot-05", yearModel: 2022, featured: false }),
    makeCard({ id: "rot-06", yearModel: 2021, featured: false }),
    makeCard({ id: "rot-07", yearModel: 2020, featured: false }),
    makeCard({ id: "rot-08", yearModel: 2019, featured: false }),
  ];

  const periodA = featuredRotationPeriod(new Date("2026-11-20T10:00:00-03:00"));
  const sameBlockNight = featuredRotationPeriod(new Date("2026-11-21T02:00:00Z")); // ainda 20/11 em SP
  const nextPeriod = periodA + 1;

  const { find, queries } = makeInMemoryFinder(rows);
  const resA1 = await fetchFeaturedVehicles(MAX_HOME_FEATURED, find, periodA);
  const resA2 = await fetchFeaturedVehicles(MAX_HOME_FEATURED, find, sameBlockNight);
  const resB = await fetchFeaturedVehicles(MAX_HOME_FEATURED, find, nextPeriod);

  assert.equal(resA1.length, 8);
  // Nenhuma query filtra consigned: false
  for (const query of queries) {
    assert.equal("consigned" in query.where, false);
    assert.equal(query.where.status, "disponivel");
    assert.equal(query.where.historical, false);
  }

  // Mesmo período em São Paulo -> exatamente o mesmo conjunto e ordem
  assert.deepEqual(
    resA1.map((v) => v.id),
    resA2.map((v) => v.id),
  );

  // Pins vêm nas 2 primeiras posições (incluindo consignado e modelo 2015 antes dos 2026 do rodízio)
  assert.deepEqual(resA1.slice(0, 2).map((v) => v.id), [
    "pin-consignado-2021",
    "pin-proprio-2015",
  ]);
  assert.deepEqual(resB.slice(0, 2).map((v) => v.id), [
    "pin-consignado-2021",
    "pin-proprio-2015",
  ]);

  // Na virada do bloco de 2 dias, os pins continuam fixos e o preenchimento roda
  assert.notDeepEqual(
    resA1.slice(2).map((v) => v.id),
    resB.slice(2).map((v) => v.id),
  );

  // Vendido, reservado e histórico nunca entram
  for (const list of [resA1, resB]) {
    const ids = list.map((v) => v.id);
    assert.ok(!ids.includes("vendido-2026"));
    assert.ok(!ids.includes("reservado-2026"));
    assert.ok(!ids.includes("historico-2025"));
  }

  // Consignado não fixado também participa do rodízio
  const seenAcrossPeriods = new Set<string>();
  for (let p = periodA; p < periodA + 10; p += 1) {
    const sample = await fetchFeaturedVehicles(MAX_HOME_FEATURED, find, p);
    for (const item of sample.slice(2)) seenAcrossPeriods.add(item.id);
  }
  assert.ok(seenAcrossPeriods.has("rot-consignado-2025"));
});

test("no máximo 4 pins ocupam o topo mesmo se houver mais de 4 legados marcados no banco", async () => {
  const rows: StoredVehicleRow[] = [
    ...Array.from({ length: 6 }, (_, index) =>
      makeCard({
        id: `pin-legado-${2020 + index}`,
        yearModel: 2020 + index,
        featured: true,
      }),
    ),
    ...Array.from({ length: 8 }, (_, index) =>
      makeCard({
        id: `estoque-rot-${index + 1}`,
        yearModel: 2018 + index,
        featured: false,
      }),
    ),
  ];

  const { find } = makeInMemoryFinder(rows);
  const result = await fetchFeaturedVehicles(MAX_HOME_FEATURED, find, 500);

  assert.equal(result.length, 8);
  // Os 4 primeiros são pins; as 4 vagas seguintes vêm do rodízio (featured: false)
  assert.equal(result.slice(0, 4).every((v) => v.featured), true);
  assert.equal(result.slice(4).every((v) => !v.featured), true);
});

test("vitrine evita card sem foto de capa quando há estoque com foto disponível", async () => {
  const rows: StoredVehicleRow[] = [
    makeCard({
      id: "pin-com-foto-2022",
      yearModel: 2022,
      featured: true,
    }),
    makeCard({
      id: "pin-sem-foto-2026",
      yearModel: 2026,
      featured: true,
      photos: [],
    }),
    ...Array.from({ length: 7 }, (_, index) =>
      makeCard({
        id: `rot-com-foto-${index + 1}`,
        yearModel: 2020 + index,
        featured: false,
      }),
    ),
    makeCard({
      id: "rot-sem-foto-2026",
      yearModel: 2026,
      featured: false,
      photos: [],
    }),
  ];

  const { find } = makeInMemoryFinder(rows);
  const result = await fetchFeaturedVehicles(MAX_HOME_FEATURED, find, 42);

  assert.equal(result.length, 8);
  assert.equal(result[0]?.id, "pin-com-foto-2022");
  assert.ok(!result.some((v) => v.id === "pin-sem-foto-2026"));
  assert.ok(!result.some((v) => v.id === "rot-sem-foto-2026"));

  // Quando o estoque inteiro tem menos de `take` com foto, o sem foto entra no fim sem esvaziar
  const smallStock = [
    makeCard({ id: "unico-com-foto-2023", yearModel: 2023, featured: false }),
    makeCard({ id: "unico-sem-foto-2025", yearModel: 2025, featured: true, photos: [] }),
  ];
  const { find: findSmall } = makeInMemoryFinder(smallStock);
  const fallback = await fetchFeaturedVehicles(MAX_HOME_FEATURED, findSmall, 42);
  assert.deepEqual(
    fallback.map((vehicle) => vehicle.id),
    ["unico-com-foto-2023", "unico-sem-foto-2025"],
  );

  // take <= 0 não faz consulta
  const { find: findZero, queries: zeroQueries } = makeInMemoryFinder(rows);
  assert.deepEqual(await fetchFeaturedVehicles(0, findZero, 42), []);
  assert.equal(zeroQueries.length, 0);
});

test("vitrine tolera coluna ausente P2022 em historical sem esconder erro real", async () => {
  const missing = (column: string) =>
    Object.assign(new Error("P2022"), { code: "P2022", meta: { column } });

  const recovered = await fetchFeaturedVehicles(
    2,
    async (args) => {
      if ("historical" in args.where) throw missing("Vehicle.historical");
      return args.where.featured
        ? [makeCard({ id: "pin-2024", yearModel: 2024, featured: true })]
        : [makeCard({ id: "rot-2025", yearModel: 2025, featured: false })];
    },
    77,
  );
  assert.deepEqual(
    recovered.map((vehicle) => vehicle.id),
    ["pin-2024", "rot-2025"],
  );

  await assert.rejects(
    fetchFeaturedVehicles(
      2,
      async () => {
        throw new Error("banco indisponivel");
      },
      77,
    ),
    /banco indisponivel/,
  );

  const stockWhere = buildStockWhere(parseStockFilters({}));
  assert.equal("consigned" in stockWhere, false);

  const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const homePage = readFileSync(join(srcRoot, "app/(catalog)/page.tsx"), "utf8");
  const seminovosPage = readFileSync(join(srcRoot, "app/(site)/seminovos/page.tsx"), "utf8");
  const vehiclesSrc = readFileSync(join(srcRoot, "lib/vehicles.ts"), "utf8");
  const tableSrc = readFileSync(join(srcRoot, "components/admin/VehiclesTable.tsx"), "utf8");
  const sheetSrc = readFileSync(
    join(srcRoot, "components/admin/vehicles-table/SheetActions.tsx"),
    "utf8",
  );
  assert.match(homePage, /getFeaturedVehicles\(MAX_HOME_FEATURED\)/);
  assert.match(seminovosPage, /getFeaturedVehicles\(MAX_HOME_FEATURED\)/);
  assert.match(vehiclesSrc, /featuredCacheKey\(take, period\)/);
  assert.match(tableSrc, /Home · \{featuredCount\}\/\{MAX_FEATURED_PINS\} destaques/);
  assert.match(sheetSrc, /Até \$\{MAX_FEATURED_PINS\} destaques/);
});

test("setVehicleFeatured permite até o 4º pin, recusa o 5º e permite desmarcar", async () => {
  const state = {
    vehicles: [
      { id: "v1", featured: true, status: "disponivel", historical: false, description: "Ok", price: 50000 },
      { id: "v2", featured: true, status: "disponivel", historical: false, description: "Ok", price: 50000 },
      { id: "v3", featured: true, status: "disponivel", historical: false, description: "Ok", price: 50000 },
      { id: "v4", featured: false, status: "disponivel", historical: false, description: "Ok", price: 50000 },
      { id: "v5", featured: false, status: "disponivel", historical: false, description: "Ok", price: 50000 },
    ],
  };

  const fakePrisma = {
    vehicle: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.vehicles.find((v) => v.id === where.id) ?? null,
      count: async () =>
        state.vehicles.filter((v) => v.featured && v.status === "disponivel" && !v.historical)
          .length,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { featured: boolean };
      }) => {
        const target = state.vehicles.find((v) => v.id === where.id);
        if (!target) throw new Error("not found");
        target.featured = data.featured;
        return target;
      },
    },
  };

  const require = createRequire(import.meta.url);
  const loader = Module as unknown as {
    _load: (id: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = loader._load;
  loader._load = function (id, parent, isMain) {
    if (id === "@/lib/auth") {
      return { getSession: async () => ({ adminId: "admin-1", email: "admin@test.com" }) };
    }
    if (id === "@/lib/prisma") {
      return { prisma: fakePrisma };
    }
    if (id === "@/lib/public-stock-revalidate") {
      return {
        revalidatePublicStock: async () => {},
        revalidatePublicStockMany: async () => {},
      };
    }
    if (id === "next/cache") {
      return {
        revalidatePath: () => {},
        revalidateTag: () => {},
        updateTag: () => {},
        unstable_cache: (fn: unknown) => fn,
      };
    }
    return originalLoad.call(this, id, parent, isMain);
  };

  let setVehicleFeatured: typeof import("../app/admin/veiculos/actions").setVehicleFeatured;
  try {
    delete require.cache[require.resolve("../app/admin/veiculos/actions.ts")];
    const actions = require("../app/admin/veiculos/actions.ts");
    setVehicleFeatured = actions.setVehicleFeatured;
  } finally {
    loader._load = originalLoad;
  }

  // 4º pin (com 3 já marcados) -> permitido
  const fourth = await setVehicleFeatured("v4", true);
  assert.equal(fourth.ok, true);
  assert.equal(state.vehicles.find((v) => v.id === "v4")?.featured, true);

  // 5º pin (com 4 já marcados) -> recusado com featuredCapMessage()
  const fifth = await setVehicleFeatured("v5", true);
  assert.equal(fifth.ok, false);
  assert.equal(fifth.message, featuredCapMessage());
  assert.equal(state.vehicles.find((v) => v.id === "v5")?.featured, false);

  // Quem já está marcado pode ser desmarcado normalmente
  const unpin = await setVehicleFeatured("v1", false);
  assert.equal(unpin.ok, true);
  assert.equal(state.vehicles.find((v) => v.id === "v1")?.featured, false);

  // Agora que voltou a ter 3 marcados, v5 pode entrar como 4º
  const fifthAfterUnpin = await setVehicleFeatured("v5", true);
  assert.equal(fifthAfterUnpin.ok, true);
  assert.equal(state.vehicles.find((v) => v.id === "v5")?.featured, true);
});
