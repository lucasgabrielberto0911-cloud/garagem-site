import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TrackedWhatsAppLink } from "@/components/site/TrackedWhatsAppLink";
import { VehicleMobileBar } from "@/components/site/VehicleMobileBar";
import {
  HOT_LEAD_MESSAGE_LIMIT,
  HOT_LEAD_STORAGE_KEY,
  HOT_LEAD_STORAGE_LIMIT,
  applyHotLeadAlsoViewed,
  clearHotLeadViewedCars,
  formatAlsoViewedCarLine,
  getHotLeadCarsSnapshot,
  parseHotLeadViewedCars,
  readHotLeadViewedCars,
  rememberHotLeadViewedCar,
  selectOtherViewedCars,
  withHotLeadAlsoViewed,
  withHotLeadViewedCar,
  type HotLeadCarInput,
  type HotLeadStorageLike,
} from "@/lib/hot-lead";
import { withWhatsAppOrigin } from "@/lib/lead-origin";
import { whatsappUrl } from "@/lib/site";
import {
  buildVehicleShortName,
  buildWhatsAppCarMessage,
} from "@/lib/whatsapp-car-message";
import { pageWhatsAppMessage } from "@/lib/whatsapp-cta";

const makeId = (n: number) => `c${String(n).padStart(24, "0")}`;

function makeMemoryStorage(initial: Record<string, string> = {}): {
  storage: HotLeadStorageLike;
  data: Map<string, string>;
} {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    storage: {
      getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
    },
  };
}

function makeCar(
  n: number,
  overrides: Partial<HotLeadCarInput> = {},
): HotLeadCarInput {
  const id = makeId(n);
  const brands = [
    ["Honda", "Civic", "EXL 2.0", 2020],
    ["Toyota", "Corolla", "XEi 2.0", 2021],
    ["Volkswagen", "Polo", "Highline 200 TSI", 2022],
    ["Hyundai", "Creta", "Prestige 2.0", 2021],
    ["Jeep", "Compass", "Longitude", 2022],
    ["Chevrolet", "Onix", "Premier 1.0 Turbo", 2023],
    ["Fiat", "Pulse", "Audace Turbo", 2023],
  ] as const;
  const [brand, model, version, year] = brands[(n - 1) % brands.length]!;
  const slugBase = `${brand}-${model}-${version}-${year}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const slug = `${slugBase}-${id}`;
  return {
    slug,
    name: `${brand} ${model} ${version}`,
    year,
    link: `https://www.suagaragem.net/estoque/${slug}`,
    ...overrides,
  };
}

test("armazenamento guarda apenas slug, nome, ano e link — até 5, sem duplicar e mais recente primeiro", () => {
  assert.equal(HOT_LEAD_STORAGE_LIMIT, 5);
  assert.equal(HOT_LEAD_MESSAGE_LIMIT, 2);

  const { storage, data } = makeMemoryStorage();

  // Abre 6 fichas em sequência: mantém os 5 mais recentes na ordem inversa de abertura
  for (let i = 1; i <= 6; i += 1) {
    rememberHotLeadViewedCar(makeCar(i), storage);
  }

  const afterSix = readHotLeadViewedCars(storage);
  assert.equal(afterSix.length, 5);
  assert.deepEqual(
    afterSix.map((c) => c.slug),
    [
      makeCar(6).slug,
      makeCar(5).slug,
      makeCar(4).slug,
      makeCar(3).slug,
      makeCar(2).slug,
    ],
  );

  // Reabrir um carro já visto move para o topo sem duplicar
  rememberHotLeadViewedCar(makeCar(3), storage);
  const afterReopen = readHotLeadViewedCars(storage);
  assert.equal(afterReopen.length, 5);
  assert.deepEqual(
    afterReopen.map((c) => c.slug),
    [
      makeCar(3).slug,
      makeCar(6).slug,
      makeCar(5).slug,
      makeCar(4).slug,
      makeCar(2).slug,
    ],
  );

  // Verifica que o JSON salvo contém apenas slug, name, year e link (sem preço nem metadados extras)
  const rawJson = data.get(HOT_LEAD_STORAGE_KEY) ?? "[]";
  assert.doesNotMatch(rawJson, /price|preco|R\$|cpf|phone|placa/i);
  const parsedRaw = JSON.parse(rawJson) as Record<string, unknown>[];
  for (const row of parsedRaw) {
    assert.deepEqual(Object.keys(row), ["slug", "name", "year", "link"]);
  }
});

test("higieniza nome evitando ano duplicado ou preço acidental e rejeita entradas corrompidas", () => {
  const cleaned = withHotLeadViewedCar([], {
    slug: `honda-civic-2020-${makeId(1)}`,
    name: "Honda Civic EXL 2.0 por R$ 109.900 2020",
    year: 2020,
    link: `/estoque/honda-civic-2020-${makeId(1)}`,
  });

  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0]!.name, "Honda Civic EXL 2.0");
  assert.equal(cleaned[0]!.year, 2020);
  assert.equal(
    cleaned[0]!.link,
    `https://www.suagaragem.net/estoque/honda-civic-2020-${makeId(1)}`,
  );
  assert.equal(
    formatAlsoViewedCarLine(cleaned[0]!),
    `Também olhei: Honda Civic EXL 2.0 2020 https://www.suagaragem.net/estoque/honda-civic-2020-${makeId(1)}`,
  );

  assert.deepEqual(parseHotLeadViewedCars(null), []);
  assert.deepEqual(parseHotLeadViewedCars("{json-quebrado"), []);
  assert.deepEqual(parseHotLeadViewedCars('"texto"'), []);
  assert.deepEqual(
    parseHotLeadViewedCars(
      JSON.stringify([
        { slug: "", name: "Sem slug", year: 2020, link: "https://www.suagaragem.net/estoque/x" },
        { slug: "x", name: "Link externo", year: 2020, link: "javascript:alert(1)" },
        { slug: "y", name: "Fora do estoque", year: 2020, link: "https://www.suagaragem.net/contato" },
        { slug: "z", name: "Ano inválido", year: 1850, link: "https://www.suagaragem.net/estoque/z" },
      ]),
    ),
    [],
  );
});

test("não inclui carros vendidos e remove carro salvo anteriormente se a ficha indicar vendido", () => {
  const { storage } = makeMemoryStorage();
  const car1 = makeCar(1);
  const car2 = makeCar(2);

  rememberHotLeadViewedCar(car1, storage);
  rememberHotLeadViewedCar(car2, storage);
  assert.equal(readHotLeadViewedCars(storage).length, 2);

  // Tentar salvar um carro novo já vendido: ignorado
  rememberHotLeadViewedCar(makeCar(3, { sold: true }), storage);
  rememberHotLeadViewedCar(makeCar(4, { status: "vendido" }), storage);
  assert.deepEqual(
    readHotLeadViewedCars(storage).map((c) => c.slug),
    [car2.slug, car1.slug],
  );

  // Reabrir car2 agora marcado como vendido na ficha: remove da lista
  rememberHotLeadViewedCar({ ...car2, sold: true }, storage);
  assert.deepEqual(
    readHotLeadViewedCars(storage).map((c) => c.slug),
    [car1.slug],
  );

  // Se o JSON bruto trouxer item com sold/status=vendido, parseHotLeadViewedCars descarta
  const fromRaw = parseHotLeadViewedCars(
    JSON.stringify([
      { ...car1 },
      { ...car2, sold: true },
      { ...makeCar(3), status: "VENDIDO" },
    ]),
  );
  assert.deepEqual(
    fromRaw.map((c) => c.slug),
    [car1.slug],
  );
});

test("tolera localStorage indisponível ou bloqueado em modo privado sem quebrar", () => {
  assert.doesNotThrow(() => {
    assert.deepEqual(readHotLeadViewedCars(null), []);
    assert.deepEqual(rememberHotLeadViewedCar(makeCar(1), null), []);
    clearHotLeadViewedCars(null);
  });

  const throwingStorage: HotLeadStorageLike = {
    getItem() {
      throw new DOMException("Bloqueado no modo privado", "SecurityError");
    },
    setItem() {
      throw new DOMException("Cota zero no modo privado", "QuotaExceededError");
    },
    removeItem() {
      throw new DOMException("Bloqueado no modo privado", "SecurityError");
    },
  };

  assert.doesNotThrow(() => {
    assert.deepEqual(readHotLeadViewedCars(throwingStorage), []);
    assert.deepEqual(rememberHotLeadViewedCar(makeCar(1), throwingStorage), []);
    clearHotLeadViewedCars(throwingStorage);
  });

  // Simula navegador onde o próprio getter window.localStorage lança SecurityError
  const g = globalThis as unknown as { window?: unknown };
  const prevWindow = g.window;
  try {
    const fakeWindow = {};
    Object.defineProperty(fakeWindow, "localStorage", {
      get() {
        throw new Error("SecurityError: localStorage disabled");
      },
    });
    g.window = fakeWindow;
    assert.doesNotThrow(() => {
      assert.deepEqual(readHotLeadViewedCars(), []);
      assert.deepEqual(rememberHotLeadViewedCar(makeCar(1)), []);
      assert.deepEqual(getHotLeadCarsSnapshot(), []);
    });
  } finally {
    if (prevWindow === undefined) {
      delete g.window;
    } else {
      g.window = prevWindow;
    }
  }
});

test("buildWhatsAppCarMessage inclui até 2 outros carros vistos depois do carro atual, sem vendidos e sem preço dos outros", () => {
  const currentId = makeId(1);
  const currentCar = makeCar(1); // Honda Civic EXL 2.0 2020 (carro atual na ficha)
  const soldViewed = makeCar(2, { status: "vendido" }); // Toyota Corolla (vendido -> deve sair)
  const otherMostRecent = makeCar(3); // Volkswagen Polo Highline 200 TSI 2022
  const otherSecond = makeCar(4); // Hyundai Creta Prestige 2.0 2021
  const otherThird = makeCar(5); // Jeep Compass Longitude 2022 (excede limite de 2)

  const viewedList: HotLeadCarInput[] = [
    currentCar,
    soldViewed,
    otherMostRecent,
    otherSecond,
    otherThird,
  ];

  const selected = selectOtherViewedCars(viewedList, {
    id: currentId,
    slug: currentCar.slug,
  });
  assert.equal(selected.length, 2);
  assert.deepEqual(
    selected.map((c) => c.slug),
    [otherMostRecent.slug, otherSecond.slug],
  );

  const msg = buildWhatsAppCarMessage({
    id: currentId,
    brand: "Honda",
    model: "Civic",
    version: "EXL 2.0 Automático",
    yearModel: 2020,
    price: 109900,
    status: "disponivel",
    path: `/estoque/${currentCar.slug}`,
    pageOrigin: "ficha",
    alsoViewed: viewedList,
  });

  const lines = msg.split("\n");
  assert.equal(lines.length, 5);
  assert.match(lines[0]!, /Honda Civic EXL 2\.0 2020 por R\$\s*109\.900/);
  assert.equal(lines[1], currentCar.link);
  assert.equal(
    lines[2],
    `Também olhei: Volkswagen Polo Highline 200 TSI 2022 ${otherMostRecent.link}`,
  );
  assert.equal(
    lines[3],
    `Também olhei: Hyundai Creta Prestige 2.0 2021 ${otherSecond.link}`,
  );
  assert.equal(lines[4], "[origem: ficha]");

  // Linhas de outros carros não trazem preço nem carros vendidos nem o 3º excedente
  for (const extraLine of [lines[2]!, lines[3]!]) {
    assert.doesNotMatch(extraLine, /R\$|\d+\.\d{3}/);
  }
  assert.doesNotMatch(msg, /Corolla|Compass/);

  // Sem outros carros além do atual, mantém exatamente 3 linhas (sem "Também olhei:")
  const onlyCurrentMsg = buildWhatsAppCarMessage({
    id: currentId,
    brand: "Honda",
    model: "Civic",
    version: "EXL 2.0",
    yearModel: 2020,
    price: 109900,
    path: `/estoque/${currentCar.slug}`,
    pageOrigin: "ficha",
    alsoViewed: [currentCar],
  });
  assert.equal(onlyCurrentMsg.split("\n").length, 3);
  assert.doesNotMatch(onlyCurrentMsg, /Também olhei:/);
});

test("applyHotLeadAlsoViewed, withWhatsAppOrigin e pageWhatsAppMessage preservam formato, idempotência e %20", () => {
  const currentId = makeId(1);
  const currentCar = makeCar(1);
  const otherCar = makeCar(2);

  const baseMsg = buildWhatsAppCarMessage({
    id: currentId,
    brand: "Honda",
    model: "Civic",
    version: "EXL 2.0",
    yearModel: 2020,
    price: 109900,
    path: `/estoque/${currentCar.slug}`,
    pageOrigin: "ficha",
  });

  const directWithAlso = buildWhatsAppCarMessage({
    id: currentId,
    brand: "Honda",
    model: "Civic",
    version: "EXL 2.0",
    yearModel: 2020,
    price: 109900,
    path: `/estoque/${currentCar.slug}`,
    pageOrigin: "ficha",
    alsoViewed: [currentCar, otherCar],
  });

  // Enriquecer mensagem pronta gera exatamente o mesmo texto de buildWhatsAppCarMessage
  const enrichedText = withHotLeadAlsoViewed(
    baseMsg,
    [currentCar, otherCar],
    { id: currentId, slug: currentCar.slug },
  );
  assert.equal(enrichedText, directWithAlso);

  // Idempotente e reversível quando lista vazia
  assert.equal(
    withHotLeadAlsoViewed(enrichedText, [currentCar, otherCar], {
      id: currentId,
    }),
    directWithAlso,
  );
  assert.equal(withHotLeadAlsoViewed(enrichedText, [], { id: currentId }), baseMsg);

  // Comutativo com withWhatsAppOrigin (mantém link atual na linha 2 para preview do WhatsApp)
  const originThenHot = withHotLeadAlsoViewed(
    withWhatsAppOrigin(baseMsg, "instagram"),
    [otherCar],
    { id: currentId },
  );
  const hotThenOrigin = withWhatsAppOrigin(enrichedText, "instagram");
  assert.equal(originThenHot, hotThenOrigin);
  const finalLines = hotThenOrigin.split("\n");
  assert.equal(finalLines.length, 4);
  assert.match(finalLines[0]!, /Vim pelo Instagram\.$/);
  assert.equal(finalLines[1], currentCar.link);
  assert.equal(
    finalLines[2],
    `Também olhei: Toyota Corolla XEi 2.0 2021 ${otherCar.link}`,
  );
  assert.equal(finalLines[3], "[origem: ficha]");

  // applyHotLeadAlsoViewed preserva %20 e UTMs na URL wa.me
  const href = whatsappUrl(baseMsg, { campaign: "ficha", content: currentCar.slug });
  const updatedHref = applyHotLeadAlsoViewed(href, [otherCar], {
    id: currentId,
    slug: currentCar.slug,
  });
  assert.doesNotMatch(updatedHref, /\+Tamb%C3%A9m/);
  assert.match(updatedHref, /utm_campaign=ficha/);
  assert.equal(new URL(updatedHref).searchParams.get("text"), directWithAlso);

  // pageWhatsAppMessage (header/float na ficha) também inclui os carros vistos
  const headerMsg = pageWhatsAppMessage(
    {
      id: currentId,
      label: "Honda Civic",
      brand: "Honda",
      model: "Civic",
      version: "EXL 2.0",
      year: 2020,
      price: 109900,
      path: `/estoque/${currentCar.slug}`,
      status: "disponivel",
    },
    `/estoque/${currentCar.slug}`,
    [currentCar, otherCar],
  );
  assert.equal(headerMsg, directWithAlso);
});

test("escopo e privacidade: só grava na ficha /estoque/[slug], SSR seguro e nada vai para servidor, Meta ou GA4", () => {
  assert.equal(
    buildVehicleShortName({
      brand: "Honda",
      model: "Civic",
      version: "EXL 2.0 FlexOne Automático",
    }),
    "Honda Civic EXL 2.0 FlexOne",
  );

  // Renderização SSR de VehicleMobileBar e TrackedWhatsAppLink funciona sem window/localStorage
  const barHtml = renderToStaticMarkup(
    createElement(VehicleMobileBar, {
      vehicleId: makeId(1),
      vehicleSlug: makeCar(1).slug,
      vehiclePath: `/estoque/${makeCar(1).slug}`,
      contentName: "Honda Civic EXL 2.0 2020",
      brand: "Honda",
      model: "Civic",
      version: "EXL 2.0",
      status: "disponivel",
      year: 2020,
      price: 109900,
    }),
  );
  assert.match(barHtml, /Chamar no WhatsApp/);

  const linkHtml = renderToStaticMarkup(
    createElement(
      TrackedWhatsAppLink,
      {
        href: whatsappUrl("Oi", { campaign: "ficha" }),
        trackingLabel: "ficha",
        vehicleId: makeId(1),
        slug: makeCar(1).slug,
        pageOrigin: "ficha",
      },
      "Falar no WhatsApp",
    ),
  );
  assert.match(linkHtml, /Falar no WhatsApp/);

  // Nenhum envio para servidor, Meta ou GA4 nos módulos de lead quente
  const hotLeadSrc = readFileSync(
    join(process.cwd(), "src/lib/hot-lead.ts"),
    "utf8",
  );
  const rememberSrc = readFileSync(
    join(process.cwd(), "src/components/site/RememberHotLeadVehicle.tsx"),
    "utf8",
  );
  for (const src of [hotLeadSrc, rememberSrc]) {
    assert.doesNotMatch(
      src,
      /\bfetch\s*\(|sendBeacon|fbq\b|gtag\b|dataLayer|meta-pixel|funnel-events/,
    );
    assert.doesNotMatch(
      src,
      /loja digital|loja física|pontos de venda|atendimento com hora marcada|Sua Garagem/i,
    );
  }

  // RememberHotLeadVehicle só é montado na ficha (/estoque/[id]/page.tsx), nunca na home ou /estoque
  const fichaPageSrc = readFileSync(
    join(process.cwd(), "src/app/(vehicle)/estoque/[id]/page.tsx"),
    "utf8",
  );
  const homePageSrc = readFileSync(
    join(process.cwd(), "src/app/(catalog)/page.tsx"),
    "utf8",
  );
  const stockPageSrc = readFileSync(
    join(process.cwd(), "src/app/(catalog)/estoque/page.tsx"),
    "utf8",
  );
  assert.match(fichaPageSrc, /<RememberHotLeadVehicle\b/);
  assert.doesNotMatch(homePageSrc, /RememberHotLeadVehicle/);
  assert.doesNotMatch(stockPageSrc, /RememberHotLeadVehicle/);
});

test("snapshot do useSyncExternalStore mantém referência estável e barra fixa mantém [origem: barra fixa] no fim", () => {
  const { storage } = makeMemoryStorage();
  const g = globalThis as unknown as { window?: unknown };
  const prevWindow = g.window;
  try {
    g.window = {
      localStorage: storage,
      dispatchEvent: () => true,
    };

    const snapEmptyA = getHotLeadCarsSnapshot();
    const snapEmptyB = getHotLeadCarsSnapshot();
    assert.equal(snapEmptyA, snapEmptyB);

    rememberHotLeadViewedCar(makeCar(2));
    rememberHotLeadViewedCar(makeCar(1));

    const snapFilledA = getHotLeadCarsSnapshot();
    const snapFilledB = getHotLeadCarsSnapshot();
    assert.equal(snapFilledA, snapFilledB);
    assert.equal(snapFilledA.length, 2);

    const mobileBarMsg = buildWhatsAppCarMessage({
      id: makeId(1),
      brand: "Honda",
      model: "Civic",
      version: "EXL 2.0",
      yearModel: 2020,
      price: 109900,
      path: `/estoque/${makeCar(1).slug}`,
      pageOrigin: "barra fixa",
      alsoViewed: snapFilledA,
    });
    const lines = mobileBarMsg.split("\n");
    assert.equal(lines.length, 4);
    assert.equal(
      lines[2],
      `Também olhei: Toyota Corolla XEi 2.0 2021 ${makeCar(2).link}`,
    );
    assert.equal(lines[3], "[origem: barra fixa]");
  } finally {
    if (prevWindow === undefined) {
      delete g.window;
    } else {
      g.window = prevWindow;
    }
  }
});
