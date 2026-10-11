import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { isMissingTableError } from "./prisma-errors";
import {
  VERIFIED_PHOTOS_PER_TOPIC,
  VERIFIED_TEXT_MAX,
  parseVerifiedItems,
  publicVerifiedItems,
  sanitizeVerifiedDrafts,
  verifiedTopicLabel,
} from "./vehicle-verified";

test("parse descarta lixo, chave repetida e item sem texto", () => {
  assert.deepEqual(parseVerifiedItems(null), []);
  assert.deepEqual(parseVerifiedItems("x"), []);
  const items = parseVerifiedItems([
    { key: "pneus", text: "  Pneus   novos ", photoIds: ["a", "a", "b", "c"] },
    { key: "pneus", text: "repetido", photoIds: [] },
    { key: "inventado", text: "não existe", photoIds: [] },
    { key: "interior", text: "   ", photoIds: ["a"] },
    { key: "manutencao", text: "Revisão em dia", photoIds: "a" },
    null,
    7,
  ]);
  assert.deepEqual(items, [
    { key: "manutencao", text: "Revisão em dia", photoIds: [] },
    { key: "pneus", text: "Pneus novos", photoIds: ["a", "b"] },
  ]);
  assert.equal(items[1].photoIds.length <= VERIFIED_PHOTOS_PER_TOPIC, true);
});

test("sem nada preenchido não sobra item (nada de texto automático)", () => {
  const result = sanitizeVerifiedDrafts(
    [
      { key: "manutencao", text: "", photoIds: [] },
      { key: "pneus", text: "  ", photoIds: [] },
    ],
    new Set(["a"]),
  );
  assert.deepEqual(result, { ok: true, items: [] });
  assert.deepEqual(publicVerifiedItems([], []), []);
});

test("sanitize mantém só o preenchido e na ordem dos pontos", () => {
  const result = sanitizeVerifiedDrafts(
    [
      { key: "documentacao", text: "IPVA pago", photoIds: [] },
      { key: "pneus", text: "Novos", photoIds: ["f1"] },
    ],
    new Set(["f1", "f2"]),
  );
  assert.deepEqual(result, {
    ok: true,
    items: [
      { key: "pneus", text: "Novos", photoIds: ["f1"] },
      { key: "documentacao", text: "IPVA pago", photoIds: [] },
    ],
  });
});

test("sanitize recusa foto sem texto, foto de outro veículo e texto longo", () => {
  const photos = new Set(["f1"]);
  const orphan = sanitizeVerifiedDrafts(
    [{ key: "pneus", text: "", photoIds: ["f1"] }],
    photos,
  );
  assert.equal(orphan.ok, false);
  const foreign = sanitizeVerifiedDrafts(
    [{ key: "pneus", text: "Novos", photoIds: ["x"] }],
    photos,
  );
  assert.equal(foreign.ok, false);
  const long = sanitizeVerifiedDrafts(
    [{ key: "pneus", text: "a".repeat(VERIFIED_TEXT_MAX + 1), photoIds: [] }],
    photos,
  );
  assert.equal(long.ok, false);
  const unknown = sanitizeVerifiedDrafts(
    [{ key: "preco", text: "R$ 1", photoIds: [] }],
    photos,
  );
  assert.equal(unknown.ok, false);
});

test("ficha pública resolve fotos e ignora as que sumiram", () => {
  const view = publicVerifiedItems(
    [
      { key: "pneus", text: "Novos", photoIds: ["gone", "f2"] },
      { key: "lataria", text: "Sem retoques", photoIds: [] },
    ],
    [
      { id: "f1", url: "u1" },
      { id: "f2", url: "u2", thumbnailUrl: "t2" },
    ],
  );
  assert.equal(view.length, 2);
  assert.deepEqual(view[0].photos, [{ id: "f2", url: "u2", thumbnailUrl: "t2" }]);
  assert.deepEqual(view[1].photos, []);
});

test("rótulos de moto trocam só interior e lataria", () => {
  assert.equal(verifiedTopicLabel("interior"), "Interior");
  assert.equal(verifiedTopicLabel("interior", true), "Banco e acabamento");
  assert.equal(verifiedTopicLabel("lataria", true), "Carenagem e pintura");
  assert.equal(verifiedTopicLabel("pneus", true), "Pneus");
});

test("tabela ausente (P2021) é reconhecida", () => {
  assert.equal(isMissingTableError({ code: "P2021", meta: { table: "public.VehicleVerifiedInfo" } }, "VehicleVerifiedInfo"), true);
  assert.equal(isMissingTableError({ code: "P2021" }), true);
  assert.equal(isMissingTableError({ code: "P2022" }), false);
  assert.equal(isMissingTableError(new Error("x")), false);
});

function readSrc(path: string) {
  return readFileSync(join(process.cwd(), "src", path), "utf8");
}

test("barra do celular: Agendar visita usa a mensagem visit, com pixel, só em carro à venda", () => {
  const bar = readSrc("components/site/VehicleMobileBar.tsx");
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  assert.match(page, /visitMessage=\{whatsapp\.visit\}/);
  assert.match(page, /intent: "visit"/);
  assert.match(bar, /Agendar visita/);
  assert.match(bar, /"ficha-visit"/);
  assert.match(bar, /Tenho interesse/);
  // Ação dentro do ramo "não vendido" e envolta no Lead/AddToCart do veículo.
  const soldBranch = bar.indexOf("{sold ? (");
  const visitStart = bar.indexOf("{visitHref ? (");
  const visitEnd = bar.indexOf("Agendar visita\n", visitStart);
  assert.ok(soldBranch > 0 && visitStart > soldBranch && visitEnd > visitStart);
  const visitBlock = bar.slice(visitStart, visitEnd);
  assert.match(visitBlock, /<VehicleLeadHit/);
  assert.match(visitBlock, /openWhatsApp\(/);
  // O texto não promete loja nem endereço.
  assert.doesNotMatch(visitBlock, /loja|endere[cç]o|venha/i);
});

test("ficha: seção verificada some em carro vendido e não usa cidade nem preço", () => {
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  assert.match(page, /sold \? Promise\.resolve\(\[\]\) : getVehicleVerifiedItems/);
  for (const file of [
    "lib/vehicle-verified.ts",
    "lib/vehicle-verified-data.ts",
    "components/site/VehicleVerifiedInfo.tsx",
  ]) {
    const source = readSrc(file);
    assert.doesNotMatch(source, /locationCity|vehicleLocationLabel|formatCurrencyBRL|price/);
  }
  const data = readSrc("lib/vehicle-verified-data.ts");
  assert.doesNotMatch(data, /force-dynamic|revalidatePath\(/);
});

test("salvar usa só a revalidação da ficha daquele veículo", () => {
  const action = readSrc("app/admin/veiculos/verified-actions.ts");
  assert.match(action, /revalidatePublicStock\(vehicleId\)/);
  assert.doesNotMatch(action, /\[id\]/);
  assert.doesNotMatch(action, /tx\.vehicle\.(update|create)/);
});
