import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isListingJudgment,
  listingGrade,
  listingStateText,
  presentListing,
  type ListingJudgment,
  type ListingReading,
} from "./listing-present";

const strongJudgment: ListingJudgment = {
  captionScore: 3,
  captionConfidence: 0.9,
  thinOptions: 0.1,
  focus: "nada",
};

function draft(overrides: Partial<ListingReading> = {}): ListingReading {
  return {
    brand: "Honda",
    model: "Civic",
    version: "EXL 2.0",
    year: "2020",
    yearModel: "2021",
    km: "45.000",
    transmission: "Automático",
    fuel: "Flex",
    color: "Prata",
    price: 98900,
    description:
      "Único dono, revisões na concessionária até os 40 mil km, pneus novos e sem retoque de funilaria. IPVA 2026 pago.",
    accessories: [
      "Ar-condicionado",
      "Direção elétrica",
      "Central multimídia",
      "Sensor de estacionamento",
    ],
    photoCount: 10,
    coverWarnings: [],
    status: "disponivel",
    category: "carro",
    ...overrides,
  };
}

test("anúncio completo com legenda ótima fica forte", () => {
  const view = presentListing(draft(), strongJudgment);
  assert.equal(view.grade?.score, 10);
  assert.equal(view.grade?.label, "Forte");
  assert.deepEqual(view.advice, []);
  assert.match(view.clearNote ?? "", /Pode publicar/);
});

test("sem versão a nota sai de Forte e aponta o campo", () => {
  const view = presentListing(draft({ version: "  " }), strongJudgment);
  assert.equal(view.grade?.score, 8.4);
  assert.equal(view.grade?.label, "Bom");
  assert.equal(view.advice[0]?.title, "Falta a versão");
  assert.equal(view.advice[0]?.section, "identificacao");
});

test("capa, fotos, km, câmbio, combustível e opcionais entram na checagem", () => {
  const view = presentListing(
    draft({
      version: "",
      km: "",
      transmission: "",
      fuel: "",
      accessories: [],
      photoCount: 0,
      coverWarnings: ["pouca luz"],
      description: "lindo",
    }),
    {
      captionScore: 0.2,
      captionConfidence: 0.8,
      thinOptions: 0.9,
      focus: "legenda",
    },
  );
  assert.equal(view.grade?.label, "Fraco");
  assert.ok((view.grade?.score ?? 10) < 5);
  assert.deepEqual(
    view.advice.map((item) => item.id),
    ["fotos", "versao", "km", "cambio", "combustivel", "opcionais", "legenda"],
  );
  assert.equal(
    view.advice.some((item) => item.id === "capa"),
    false,
  );
});

test("capa fraca só aparece quando já existe foto", () => {
  const view = presentListing(
    draft({
      photoCount: 9,
      coverWarnings: ["Imagem pequena para o recorte da capa."],
    }),
    strongJudgment,
  );
  assert.equal(view.advice[0]?.title, "Capa fraca");
  assert.match(view.advice[0]?.detail ?? "", /Imagem pequena/);
  assert.equal(listingGrade(draft({ photoCount: 9, coverWarnings: ["x"] }), strongJudgment).score, 9.1);
});

test("km zero não conta como campo vazio", () => {
  const view = presentListing(draft({ km: "0" }), strongJudgment);
  assert.equal(
    view.advice.some((item) => item.id === "km"),
    false,
  );
});

test("câmbio que diverge da versão vira aviso", () => {
  const view = presentListing(
    draft({ version: "EX 1.8 Automático", transmission: "Manual" }),
    strongJudgment,
  );
  const gear = view.advice.find((item) => item.id === "cambio");
  assert.equal(gear?.title, "Câmbio não bate com a versão");
  assert.match(gear?.detail ?? "", /Manual/);
});

test("legenda curta continua avisando mesmo com nota alta do modelo", () => {
  const view = presentListing(
    draft({ description: "Ótimo estado." }),
    strongJudgment,
  );
  assert.equal(view.advice.some((item) => item.title === "Legenda curta"), true);
  assert.notEqual(view.grade?.label, "Forte");
});

test("sem julgamento não inventa nota e ainda lista o que falta", () => {
  const view = presentListing(
    draft({ version: "", photoCount: 2, accessories: ["Ar"] }),
    null,
  );
  assert.equal(view.grade, null);
  assert.equal(view.advice.some((item) => item.id === "versao"), true);
  assert.equal(view.advice.some((item) => item.id === "fotos"), true);
  assert.equal(view.advice.some((item) => item.id === "opcionais"), true);
});

test("legenda longa e rasa só aparece com o Jev confiante", () => {
  const long =
    "Honda Civic EXL 2020/2021, automático, flex, prata, 45 mil km, com ar, direção, multimídia e sensor. Aceito proposta.";
  const unsure = presentListing(
    draft({ description: long }),
    { ...strongJudgment, captionScore: 0.4, captionConfidence: 0.2 },
  );
  assert.equal(unsure.advice.some((item) => item.id === "legenda"), false);

  const sure = presentListing(
    draft({ description: long }),
    { ...strongJudgment, captionScore: 0.4, captionConfidence: 0.81, focus: "legenda" },
  );
  assert.equal(sure.advice[0]?.title, "Legenda não vende");
});

test("opcionais pobres para a versão só quando a lista já tem itens", () => {
  const view = presentListing(draft(), {
    ...strongJudgment,
    thinOptions: 0.8,
    focus: "opcionais",
  });
  assert.equal(view.advice[0]?.title, "Opcionais curtos para a versão");
  assert.equal(view.grade?.score, 9.3);
});

test("vendido e rascunho sem nome não medem", () => {
  assert.equal(presentListing(draft({ status: "vendido" }), strongJudgment).grade, null);
  assert.match(
    presentListing(draft({ brand: "", model: "" }), null).prompt ?? "",
    /marca e modelo/,
  );
});

test("o contexto do Jev não leva placa, cidade nem custo", () => {
  const text = listingStateText(
    draft({ description: "Revisões em dia na Honda." }),
  );
  assert.match(text, /Honda Civic EXL 2\.0/);
  assert.match(text, /Revisões em dia/);
  assert.equal(/placa|linhares|serra|compra|custo/i.test(text), false);
});

test("julgamento inválido não passa", () => {
  assert.equal(isListingJudgment(null), false);
  assert.equal(isListingJudgment({ captionScore: 1 }), false);
  assert.equal(
    isListingJudgment({
      captionScore: 1.9,
      captionConfidence: 0.77,
      thinOptions: 0.2,
      focus: "legenda",
    }),
    true,
  );
});
