import assert from "node:assert/strict";
import test from "node:test";
import {
  UNIT_CLAIM_REPLACEMENT,
  fixVehicleBrands,
  guardLlmReply,
  guardUnitClaims,
} from "./chat-claims";
import type { ChatVehicleRecord } from "./chat-stock";

const vehicle = (brand: string, model: string): ChatVehicleRecord => ({
  id: `${brand}-${model}`,
  brand,
  model,
  version: null,
  yearModel: 2019,
  km: 50_000,
  price: 80_000,
  color: null,
  transmission: "Automático",
  fuel: "Flex",
});

test("laudo, batida, revisão, original, dono único e garantia de fábrica da unidade viram confirmação com o consultor", () => {
  const claims = [
    "O Civic tem laudo cautelar aprovado.",
    "Esse carro nunca foi batido.",
    "Ele é sem histórico de sinistro, pode ficar tranquilo.",
    "É todo original de fábrica.",
    "O Corolla é de dono único.",
    "Já está com as revisões em dia.",
    "Foi revisado na concessionária.",
    "Passou por conferência de qualidade antes de entrar no estoque.",
    "Ainda tem garantia de fábrica.",
    "A procedência é garantida.",
  ];
  for (const claim of claims) {
    const out = guardUnitClaims(`O motor entrega 126 cv. ${claim} Quer ver outro?`);
    assert.match(out, /^O motor entrega 126 cv\./, claim);
    assert.ok(out.includes(UNIT_CLAIM_REPLACEMENT), claim);
    assert.ok(out.endsWith("Quer ver outro?"), claim);
    assert.equal(/laudo cautelar aprovado|nunca foi batido|dono único|conferência de qualidade/.test(out.replace(UNIT_CLAIM_REPLACEMENT, "")), false, claim);
  }
});

test("a frase segura entra uma única vez, mesmo com várias afirmações", () => {
  const out = guardUnitClaims("Tem laudo. Sem batida. Dono único. Revisado.");
  assert.equal(out.split(UNIT_CLAIM_REPLACEMENT).length - 1, 1);
});

test("quando o próprio texto já diz que não sabe ou que confirma, nada muda", () => {
  const kept = [
    "Laudo cautelar dessa unidade eu não tenho aqui, o consultor confirma no WhatsApp.",
    "Não consta histórico de revisões nos dados do anúncio.",
    "Vale pedir o laudo cautelar ao consultor antes de fechar.",
    "Não posso afirmar se é dono único.",
  ];
  for (const text of kept) assert.equal(guardUnitClaims(text), text);
});

test("política da loja e dados de fábrica do modelo não são tocados", () => {
  const ok = [
    "A garantia é de 3 meses de motor e câmbio.",
    "O HB20 1.6 faz 128 cv no etanol e 122 cv na gasolina.",
    "O motor turbo pede óleo da especificação certa e revisões em dia.",
  ];
  // A terceira é dado típico do modelo (ficha); só frases da UNIDADE são trocadas pelo prompt,
  // e o texto determinístico das fichas nunca passa por esta guarda.
  assert.equal(guardUnitClaims(ok[0]!), ok[0]);
  assert.equal(guardUnitClaims(ok[1]!), ok[1]);
});

test("marca certa: Honda Corolla vira Toyota Corolla, pelo estoque e pela ficha", () => {
  const stock = [vehicle("Toyota", "Corolla"), vehicle("Honda", "City")];
  assert.equal(fixVehicleBrands("O Honda Corolla é automático.", stock), "O Toyota Corolla é automático.");
  assert.equal(fixVehicleBrands("O Toyota City tem 7 marchas simuladas.", stock), "O Honda City tem 7 marchas simuladas.");
  // Sem o carro no estoque, a ficha do modelo decide.
  assert.equal(fixVehicleBrands("O Honda Corolla Altis é CVT.", []), "O Toyota Corolla Altis é CVT.");
  assert.equal(fixVehicleBrands("O Chevrolet HB20 1.6 tem 128 cv.", []), "O Hyundai HB20 1.6 tem 128 cv.");
});

test("marca certa fica como está; modelo desconhecido e frases com duas marcas não mudam", () => {
  const stock = [vehicle("Toyota", "Corolla")];
  for (const text of [
    "O Toyota Corolla é automático.",
    "O Honda Modelozinho é novidade.",
    "Entre Honda e Toyota Corolla, o Corolla é mais espaçoso.",
    "Tenho Corolla e City.",
  ]) {
    assert.equal(fixVehicleBrands(text, stock), text);
  }
});

test("guardLlmReply aplica marca e afirmações juntas", () => {
  const out = guardLlmReply("O Honda Corolla é automático. Tem laudo cautelar.", [vehicle("Toyota", "Corolla")]);
  assert.match(out, /^O Toyota Corolla/);
  assert.ok(out.includes(UNIT_CLAIM_REPLACEMENT));
});
