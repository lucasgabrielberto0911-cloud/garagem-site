import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MAX_HOME_FEATURED,
  canEnableFeatured,
  featuredCapMessage,
  featuredOrdersFromIds,
  featuredSlotState,
  hasShowcaseCoverPhoto,
  moveFeaturedIds,
  nextFeaturedOrder,
  sortFeaturedForHome,
  sortShowcaseVehicles,
} from "./featured";
import { parseStockFilters, type VehicleCardRecord } from "./stock-query";
import {
  buildStockWhere,
  fetchFeaturedVehicles,
  type FeaturedShowcaseQuery,
} from "./vehicles";

test("home tem teto de 8 destaques e não deixa passar do limite", () => {
  assert.equal(MAX_HOME_FEATURED, 8);
  const slots = featuredSlotState(8);
  assert.equal(slots.atCap, true);
  assert.equal(slots.remaining, 0);
  assert.equal(canEnableFeatured(8, false), false);
  assert.equal(canEnableFeatured(8, true), true);
  assert.equal(canEnableFeatured(3, false), true);
  assert.match(featuredCapMessage(), /8 destaques/);
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
      if (args.where.consigned === false && row.consigned === true) return false;
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

  const withPanelOrder = sortShowcaseVehicles([
    {
      id: "segundo-painel",
      yearModel: 2026,
      km: 8000,
      featuredOrder: 2,
      photos: [{ url: "/fotos/b.webp" }],
    },
    {
      id: "primeiro-painel",
      yearModel: 2022,
      km: 30000,
      featuredOrder: 1,
      photos: [{ url: "/fotos/a.webp" }],
    },
  ]);
  assert.deepEqual(
    withPanelOrder.map((item) => item.id),
    ["primeiro-painel", "segundo-painel"],
  );
});

test("vitrine completa 8 veículos próprios (consigned: false) e coloca os mais novos na 1ª linha", async () => {
  const rows: StoredVehicleRow[] = [
    // Destaque antigo cadastrado por último (não pode liderar a 1ª linha)
    makeCard({
      id: "sandero-2009",
      brand: "Renault",
      model: "Sandero",
      yearModel: 2009,
      km: 173500,
      featured: true,
      consigned: false,
      createdAt: "2026-11-17T10:00:00Z",
    }),
    makeCard({
      id: "hb20-2019",
      brand: "Hyundai",
      model: "HB20",
      yearModel: 2019,
      km: 62000,
      featured: true,
      consigned: false,
      createdAt: "2026-11-10T10:00:00Z",
    }),
    // Consignados (mesmo marcados como destaque ou novos) nunca entram na vitrine
    makeCard({
      id: "consignado-destaque-2026",
      yearModel: 2026,
      km: 4000,
      featured: true,
      consigned: true,
    }),
    makeCard({
      id: "consignado-comum-2025",
      yearModel: 2025,
      km: 10000,
      featured: false,
      consigned: true,
    }),
    // Indisponíveis / históricos nunca entram
    makeCard({
      id: "vendido-2026",
      yearModel: 2026,
      status: "vendido",
      featured: true,
      consigned: false,
    }),
    makeCard({
      id: "historico-2025",
      yearModel: 2025,
      historical: true,
      featured: true,
      consigned: false,
    }),
    // Estoque próprio disponível não destacado (2020–2026) que completa os 8 slots
    makeCard({ id: "nivus-2026", yearModel: 2026, km: 9000, featured: false }),
    makeCard({ id: "tracker-2025", yearModel: 2025, km: 15000, featured: false }),
    makeCard({ id: "creta-2024", yearModel: 2024, km: 22000, featured: false }),
    makeCard({ id: "polo-2023", yearModel: 2023, km: 27000, featured: false }),
    makeCard({ id: "kicks-2022", yearModel: 2022, km: 35000, featured: false }),
    makeCard({ id: "onix-2021", yearModel: 2021, km: 41000, featured: false }),
    makeCard({ id: "argo-2020", yearModel: 2020, km: 55000, featured: false }),
    makeCard({
      id: "sem-foto-2026",
      yearModel: 2026,
      km: 1000,
      featured: false,
      photos: [],
    }),
  ];

  const { find, queries } = makeInMemoryFinder(rows);
  const result = await fetchFeaturedVehicles(MAX_HOME_FEATURED, find);

  assert.equal(result.length, 8);
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[0]?.where, {
    status: "disponivel",
    historical: false,
    consigned: false,
    featured: true,
  });
  assert.deepEqual(queries[1]?.where, {
    status: "disponivel",
    historical: false,
    consigned: false,
    featured: false,
  });

  // Nenhum consignado, vendido, histórico ou veículo sem foto (havendo 8 com foto) entra
  const ids = result.map((vehicle) => vehicle.id);
  assert.ok(!ids.includes("consignado-destaque-2026"));
  assert.ok(!ids.includes("consignado-comum-2025"));
  assert.ok(!ids.includes("vendido-2026"));
  assert.ok(!ids.includes("historico-2025"));
  assert.ok(!ids.includes("sem-foto-2026"));

  // Os 4 primeiros slots (1ª linha da Home) têm os modelos 2023–2026 mais novos com foto
  assert.deepEqual(ids.slice(0, 4), [
    "nivus-2026",
    "tracker-2025",
    "creta-2024",
    "polo-2023",
  ]);
  // Os destaques próprios antigos permanecem nos 8 slots, mas no fim da grade
  assert.deepEqual(ids.slice(4), [
    "kicks-2022",
    "onix-2021",
    "hb20-2019",
    "sandero-2009",
  ]);
});

test("vitrine não cai em estado vazio quando há 0 destaques marcados mas existe estoque próprio", async () => {
  const rows: StoredVehicleRow[] = [
    makeCard({ id: "consignado-unico-destaque", featured: true, consigned: true }),
    makeCard({ id: "proprio-2022", yearModel: 2022, featured: false, consigned: false }),
    makeCard({ id: "proprio-2025", yearModel: 2025, featured: false, consigned: false }),
  ];

  const { find } = makeInMemoryFinder(rows);
  const result = await fetchFeaturedVehicles(MAX_HOME_FEATURED, find);
  assert.deepEqual(
    result.map((vehicle) => vehicle.id),
    ["proprio-2025", "proprio-2022"],
  );
});

test("vitrine faz apenas 1 consulta quando já existem 8 destaques próprios disponíveis", async () => {
  const rows = Array.from({ length: 9 }, (_, index) =>
    makeCard({
      id: `destaque-${2018 + index}`,
      yearModel: 2018 + index,
      featured: true,
      consigned: false,
    }),
  );
  const { find, queries } = makeInMemoryFinder(rows);
  const result = await fetchFeaturedVehicles(MAX_HOME_FEATURED, find);

  assert.equal(queries.length, 1);
  assert.equal(result.length, 8);
  assert.equal(result[0]?.yearModel, 2026);
  assert.equal(result[7]?.yearModel, 2019);
});

test("vitrine tolera coluna ausente P2022 sem esconder erro real e mantém consignado no /estoque", async () => {
  const missing = (column: string) =>
    Object.assign(new Error("P2022"), { code: "P2022", meta: { column } });

  const seenWhere: FeaturedShowcaseQuery["where"][] = [];
  const recovered = await fetchFeaturedVehicles(2, async (args) => {
    seenWhere.push(args.where);
    if ("historical" in args.where) throw missing("Vehicle.historical");
    if ("consigned" in args.where) throw missing("Vehicle.consigned");
    return args.where.featured
      ? [makeCard({ id: "unico-2024", yearModel: 2024, featured: true })]
      : [makeCard({ id: "extra-2025", yearModel: 2025, featured: false })];
  });
  assert.deepEqual(
    recovered.map((vehicle) => vehicle.id),
    ["extra-2025", "unico-2024"],
  );
  assert.equal(seenWhere[0]?.consigned, false);

  await assert.rejects(
    fetchFeaturedVehicles(2, async () => {
      throw new Error("banco indisponivel");
    }),
    /banco indisponivel/,
  );

  // Consignado continua permitido em /estoque; a regra é exclusiva da vitrine (Home e /seminovos)
  const stockWhere = buildStockWhere(parseStockFilters({}));
  assert.equal("consigned" in stockWhere, false);

  const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const homePage = readFileSync(join(srcRoot, "app/(catalog)/page.tsx"), "utf8");
  const seminovosPage = readFileSync(join(srcRoot, "app/(site)/seminovos/page.tsx"), "utf8");
  assert.match(homePage, /getFeaturedVehicles\(MAX_HOME_FEATURED\)/);
  assert.match(seminovosPage, /getFeaturedVehicles\(MAX_HOME_FEATURED\)/);
});
