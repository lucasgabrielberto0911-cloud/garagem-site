import assert from "node:assert/strict";
import test from "node:test";
import {
  stepForField,
  validateVehicleForm,
} from "./admin-vehicle-form-validate";

const valid = {
  brand: "Marca teste",
  model: "Modelo teste",
  color: "Prata",
  year: "2020",
  yearModel: "2021",
  kmDisplay: "45.000",
  priceDisplay: "59.900,00",
  fuel: "Flex",
  transmission: "Automático",
  locationCity: "linhares",
  status: "disponivel",
  description: "Veículo de teste.",
  doors: "4",
};
const options = {
  mode: "create" as const,
  status: valid.status,
  fuel: valid.fuel,
  transmission: valid.transmission,
  color: valid.color,
  locationCity: valid.locationCity,
  accessories: [] as string[],
  photoCount: 1,
  photosUploading: false,
};
function data(overrides: Partial<typeof valid> = {}) {
  const form = new FormData();
  for (const [field, value] of Object.entries({ ...valid, ...overrides }))
    form.set(field, value);
  return form;
}

test("aceita cadastro completo sem alterar os dados nem as opções", () => {
  const form = data();
  const before = [...form.entries()];
  assert.deepEqual(validateVehicleForm(form, options), {});
  assert.deepEqual([...form.entries()], before);
  assert.deepEqual(options.accessories, []);
});

test("fotos são obrigatórias e envio pendente prevalece sobre ausência", () => {
  assert.match(
    validateVehicleForm(data(), { ...options, photoCount: 0 }).photos,
    /Adicione/,
  );
  assert.match(
    validateVehicleForm(data(), {
      ...options,
      photoCount: 0,
      photosUploading: true,
    }).photos,
    /Espere/,
  );
});

test("validar uma etapa não antecipa nem apaga erros de outras etapas", () => {
  const form = data({ brand: "", priceDisplay: "", locationCity: "" });
  for (const [onlyStep, fields] of [
    [1, ["photos"]],
    [2, ["brand"]],
    [3, ["price"]],
    [4, ["locationCity"]],
  ] as const) {
    assert.deepEqual(
      Object.keys(
        validateVehicleForm(form, {
          ...options,
          locationCity: "",
          photoCount: 0,
          onlyStep,
        }),
      ),
      fields,
    );
  }
});

test("campos vazios da ficha podem avançar na etapa 2, mas impedem publicar", () => {
  const form = data({
    color: "",
    year: "",
    yearModel: "",
    kmDisplay: "",
    fuel: "",
    transmission: "",
  });
  const empty = { ...options, color: "", fuel: "", transmission: "" };
  assert.deepEqual(validateVehicleForm(form, { ...empty, onlyStep: 2 }), {});
  const all = validateVehicleForm(form, empty);
  for (const field of [
    "color",
    "year",
    "yearModel",
    "km",
    "fuel",
    "transmission",
  ])
    assert.ok(all[field], field);
});

test("dados malformados não são tratados como campos vazios ao avançar", () => {
  const errors = validateVehicleForm(
    data({
      year: "abc",
      kmDisplay: "-10",
      doors: "8",
    }),
    {
      ...options,
      onlyStep: 2,
    },
  );
  for (const field of ["year", "km", "doors"]) assert.ok(errors[field], field);
});

test("preço divergente na legenda bloqueia disponível e preserva a regra na edição", () => {
  const form = data({ description: "Preço R$ 69.900,00." });
  assert.ok(validateVehicleForm(form, { ...options, onlyStep: 3 }).description);
  for (const status of ["reservado", "vendido"]) {
    assert.equal(
      validateVehicleForm(form, { ...options, mode: "edit", status })
        .description,
      undefined,
    );
  }
});

test("criação reservada ou vendida exige cadastrar primeiro; edição continua permitida", () => {
  for (const status of ["reservado", "vendido"]) {
    assert.ok(
      validateVehicleForm(data({ status }), { ...options, status }).status,
    );
    assert.equal(
      validateVehicleForm(data({ status }), {
        ...options,
        status,
        mode: "edit",
      }).status,
      undefined,
    );
  }
});

test("mantém erros nativos reconhecidos sem sobrescrever validação dos dados", () => {
  const invalidFields = {
    model: "Erro nativo",
    price: "Erro nativo de preço",
    unrelated: "Ignorar",
  };
  const errors = validateVehicleForm(data({ priceDisplay: "inválido" }), {
    ...options,
    invalidFields,
  });
  assert.equal(errors.model, "Erro nativo");
  assert.match(errors.price, /Preço: informe/);
  assert.equal(errors.unrelated, undefined);
  assert.deepEqual(invalidFields, {
    model: "Erro nativo",
    price: "Erro nativo de preço",
    unrelated: "Ignorar",
  });
});

test("mapeia fotos, identificação, legenda, preço e opções internas às etapas originais", () => {
  for (const [field, step] of Object.entries({
    photos: 1,
    brand: 2,
    year: 2,
    km: 2,
    description: 3,
    accessories: 3,
    price: 3,
    status: 3,
    locationCity: 4,
    featured: 4,
    purchasePrice: 4,
  })) {
    assert.equal(stepForField(field), step, field);
  }
  assert.equal(stepForField("inexistente"), undefined);
});
