import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "./prisma";
import { queryPublicVehicleCards } from "./public-vehicle-cards";
import { PUBLIC_VEHICLE_DETAIL_SELECT } from "./vehicles";
import { ADMIN_VEHICLE_LIST_SELECT } from "./admin-vehicles";
import { runChatTurn } from "./chat-turn";

test("API de cards não consulta nem devolve a cidade interna, mesmo em um registro legado", async () => {
  const original = prisma.vehicle.findMany;
  try {
    prisma.vehicle.findMany = (async (args: { select: Record<string, unknown> }) => {
      assert.equal("locationCity" in args.select, false);
      return [{ id: "fixture", brand: "Honda", model: "Civic", locationCity: "serra", photos: [{ url: "https://example.test/photo.webp" }] }];
    }) as typeof original;
    const rows = await queryPublicVehicleCards({ where: { id: "fixture" } });
    assert.equal("locationCity" in rows[0]!, false);
    assert.doesNotMatch(JSON.stringify(rows), /serra|locationCity/);
  } finally {
    prisma.vehicle.findMany = original;
  }
  assert.equal("locationCity" in PUBLIC_VEHICLE_DETAIL_SELECT, false);
  assert.equal(ADMIN_VEHICLE_LIST_SELECT.locationCity, true);
});

test("localização da unidade segue para o consultor sem divulgar cidade", async () => {
  const result = await runChatTurn({ mensagem: "onde está esse carro?", historico: [], stock: [] });
  assert.equal(result.meta?.policy, "vehicle-location-private");
  assert.match(result.reply, /wa.me\/5527996330706/);
  assert.doesNotMatch(result.reply, /Linhares|Serra|Vitória|Aracruz/);
});
