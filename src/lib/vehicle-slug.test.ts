import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractVehicleIdFromParam,
  isVehicleCuid,
  vehiclePath,
  vehicleSlug,
} from "@/lib/vehicle-slug";

test("isVehicleCuid: valida o formato CUID do Prisma", () => {
  assert.equal(isVehicleCuid("cmshv22g9000fl204fk6qz9l2"), true);
  assert.equal(isVehicleCuid("c12345678901234567890"), true);
  assert.equal(isVehicleCuid(""), false);
  assert.equal(isVehicleCuid("abc"), false);
  assert.equal(isVehicleCuid("123456789012345678901"), false); // não começa com c
});

test("vehicleSlug: normaliza acentos, dedup de tokens de modelo na versão e monta URL canônica", () => {
  const vehicle = {
    id: "cmshv22g9000fl204fk6qz9l2",
    brand: "Hyundai",
    model: "HB20",
    version: "HB20 1.0 Comfort Plus", // HB20 não deve duplicar no slug
    yearModel: 2022,
  };
  const slug = vehicleSlug(vehicle);
  assert.equal(slug, "hyundai-hb20-1-0-comfort-plus-2022-cmshv22g9000fl204fk6qz9l2");
  assert.equal(vehiclePath(vehicle), `/estoque/${slug}`);
});

test("vehicleSlug: trata acentos e caracteres especiais", () => {
  const vehicle = {
    id: "cmturwtw30000l804s8700mu4",
    brand: "Citroën",
    model: "C3 Aircross",
    version: "1.6 16V Automático",
    yearModel: 2018,
  };
  const slug = vehicleSlug(vehicle);
  assert.equal(slug, "citroen-c3-aircross-1-6-16v-automatico-2018-cmturwtw30000l804s8700mu4");
});

test("extractVehicleIdFromParam: aceita tanto CUID direto quanto slug composto", () => {
  const cuid = "cmshv22g9000fl204fk6qz9l2";
  // CUID puro
  assert.equal(extractVehicleIdFromParam(cuid), cuid);

  // Slug canônico
  const slug = `hyundai-creta-prestige-2022-${cuid}`;
  assert.equal(extractVehicleIdFromParam(slug), cuid);

  // Inválidos
  assert.equal(extractVehicleIdFromParam(""), null);
  assert.equal(extractVehicleIdFromParam("modelo-sem-id"), null);
  assert.equal(extractVehicleIdFromParam("carro-invalido-1234"), null);
});
