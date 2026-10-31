import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchFipe, fipePath, parseFipeOptions, parseFipeQuery, parseFipeVehicle } from "./fipe";

const response = {
  Valor: "R$ 84.753,00", Marca: "VW - VolksWagen",
  Modelo: "AMAROK High.CD 2.0 16V TDI 4x4 Dies. Aut",
  AnoModelo: 2014, Combustivel: "Diesel", CodigoFipe: "005340-6", MesReferencia: "outubro de 2026 ",
};

test("FIPE aceita apenas a hierarquia de códigos e nunca placa ou URL externa", () => {
  for (const query of ["category=caminhao", "category=carro&model=1", "category=carro&brand=../foo", "category=carro&brand=1&year=2020-1", "category=carro&brand=1&model=1&year=32000-1", "category=carro&plate=ABC1234", "category=carro&url=https://externo", "category=carro&category=moto"]) {
    assert.equal(parseFipeQuery(new URLSearchParams(query)), null, query);
  }
  const query = parseFipeQuery(new URLSearchParams("category=moto&brand=80&model=1&year=2020-1"));
  assert.ok(query);
  assert.equal(fipePath(query), "motos/marcas/80/modelos/1/anos/2020-1");
});

test("normaliza preço, marca, versão e ano modelo sem inventar ano de fabricação", () => {
  const vehicle = parseFipeVehicle(response);
  assert.deepEqual(vehicle, {
    price: 84753, brand: "Volkswagen", model: "AMAROK High.CD", version: "2.0 16V TDI 4x4 Dies. Aut",
    yearModel: 2014, fuel: "Diesel", code: "005340-6", reference: "outubro de 2026",
  });
  assert.equal("year" in vehicle, false);
  assert.equal(parseFipeVehicle({ ...response, Modelo: "Onix 1.0 Flex", Marca: "GM - Chevrolet" }).fuel, "Flex");
  assert.equal(parseFipeVehicle({ ...response, Combustivel: "Álcool" }).fuel, "Etanol");
  assert.equal(parseFipeVehicle({ ...response, Modelo: "CB 500F" }).model, "CB 500F");
});

test("recusa respostas incompletas, preço inválido e ano zero km", () => {
  for (const data of [null, {}, { ...response, Valor: "gratuito" }, { ...response, Valor: "R$ 0,00" }, { ...response, AnoModelo: 32000 }, { ...response, Marca: "" }]) assert.throws(() => parseFipeVehicle(data));
  assert.deepEqual(parseFipeOptions([{ codigo: 1, nome: "Honda" }, { codigo: "32000-1", nome: "Zero km" }]), [{ codigo: "1", nome: "Honda" }]);
  assert.throws(() => parseFipeOptions({ erro: "fora do ar" }));
});

test("consulta simulada usa URL fixa, cache e timeout; interpreta modelos e preço", async () => {
  const queries = [
    { category: "carro" as const, brand: "59" },
    { category: "carro" as const, brand: "59", model: "5940", year: "2014-3" },
  ];
  for (const query of queries) {
    const result = await fetchFipe(query, (async (url, options) => {
      assert.equal(String(url), `https://parallelum.com.br/fipe/api/v1/${fipePath(query)}`);
      assert.equal((options as RequestInit & { next: { revalidate: number } }).next.revalidate, 3600);
      assert.ok(options?.signal);
      return Response.json(query.year ? response : { modelos: [{ codigo: 5940, nome: "AMAROK" }] });
    }) as typeof fetch);
    assert.deepEqual(result, query.year ? parseFipeVehicle(response) : [{ codigo: "5940", nome: "AMAROK" }]);
  }
  await assert.rejects(fetchFipe(queries[0], (async () => new Response(null, { status: 429 })) as typeof fetch), /Limite/);
  await assert.rejects(fetchFipe(queries[0], (async () => new Response(null, { status: 503 })) as typeof fetch), /indisponível/);
});
