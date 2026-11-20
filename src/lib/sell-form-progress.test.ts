import assert from "node:assert/strict";
import { test } from "node:test";
import { getSellFormProgress, validateSellYear } from "./sell-form-progress";

test("validateSellYear aceita anos válidos e devolve mensagem simples para entradas inválidas", () => {
  assert.equal(validateSellYear("2021", 2027), null);
  assert.equal(validateSellYear("1950", 2027), null);
  assert.equal(validateSellYear("2027", 2027), null);

  assert.equal(
    validateSellYear("21", 2027),
    "Digite o ano com 4 números, como 2021.",
  );
  assert.equal(
    validateSellYear("", 2027),
    "Digite o ano com 4 números, como 2021.",
  );
  assert.equal(
    validateSellYear("1949", 2027),
    "Informe um ano entre 1950 e 2027.",
  );
  assert.equal(
    validateSellYear("2028", 2027),
    "Informe um ano entre 1950 e 2027.",
  );
});

test("getSellFormProgress calcula progresso inicial, parcial, completo e extras opcionais", () => {
  const empty = getSellFormProgress(
    { name: "", phone: "", brand: "", model: "", year: "" },
    2027,
  );
  assert.equal(empty.essentialFilled, 0);
  assert.equal(empty.percent, 0);
  assert.equal(empty.contactDone, false);
  assert.equal(empty.vehicleDone, false);
  assert.equal(empty.readyToSend, false);
  assert.equal(empty.optionalCount, 0);
  assert.match(empty.statusText, /5 campos rápidos/);

  const partial = getSellFormProgress(
    {
      name: "Maria Silva",
      phone: "(27) 99999-0000",
      brand: "Honda",
      model: "Civic",
      year: "20",
    },
    2027,
  );
  assert.equal(partial.contactDone, true);
  assert.equal(partial.vehicleDone, false);
  assert.equal(partial.essentialFilled, 4);
  assert.equal(partial.percent, 80);
  assert.equal(partial.statusText, "Falta só 1 campo essencial");

  const complete = getSellFormProgress(
    {
      name: "Maria Silva",
      phone: "(27) 99999-0000",
      brand: "Honda",
      model: "Civic",
      year: "2020",
      plate: "ABC1D23",
      km: "45.000",
      notes: "Unico dono",
      photoCount: 2,
    },
    2027,
  );
  assert.equal(complete.contactDone, true);
  assert.equal(complete.vehicleDone, true);
  assert.equal(complete.essentialFilled, 5);
  assert.equal(complete.percent, 100);
  assert.equal(complete.readyToSend, true);
  assert.equal(complete.optionalCount, 4);
  assert.equal(complete.statusText, "Tudo pronto para solicitar sua avaliação");
});
