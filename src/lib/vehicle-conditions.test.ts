import assert from "node:assert/strict";
import { test } from "node:test";
import { FAQ_ITEMS } from "./faq";
import {
  DEFAULT_VEHICLE_CONDITIONS,
  STORE_INSPECTION_BODY,
  STORE_WARRANTY,
  isLegacyStoreWarrantyCopy,
  publicStoreInspectionText,
} from "./vehicle-conditions";

const OLD_COPY =
  "Antes de entrar no estoque, o seminovo passa pela vistoria da loja: checagem interna de procedência e condição geral. Não é documento oficial de inspeção.";

test("vistoria pública troca o texto antigo por um tom positivo", () => {
  assert.equal(publicStoreInspectionText(OLD_COPY), STORE_INSPECTION_BODY);
  assert.equal(publicStoreInspectionText(null), STORE_INSPECTION_BODY);
  assert.equal(publicStoreInspectionText("   "), STORE_INSPECTION_BODY);
  assert.match(STORE_INSPECTION_BODY, /óleo/i);
  assert.match(STORE_INSPECTION_BODY, /fluidos/i);
  assert.doesNotMatch(STORE_INSPECTION_BODY, /documento oficial/i);
});

test("garantia comercial cobre motor e câmbio, sem revisão completa", () => {
  assert.match(STORE_WARRANTY.body, /checagem na loja/i);
  assert.match(STORE_WARRANTY.body, /garantia comercial de 3 meses/i);
  assert.match(STORE_WARRANTY.body, /motor e câmbio/i);
  assert.match(STORE_WARRANTY.body, /pneus, pastilhas, filtros/i);
  assert.match(STORE_WARRANTY.body, /WhatsApp/);
  assert.match(STORE_WARRANTY.title, /motor e câmbio/i);
  assert.match(STORE_WARRANTY.summary, /garantia comercial de 3 meses/i);
  assert.doesNotMatch(STORE_WARRANTY.body, /revisão completa/i);
  assert.doesNotMatch(STORE_WARRANTY.body, /CDC|código de defesa/i);
  assert.equal(DEFAULT_VEHICLE_CONDITIONS.intro, STORE_WARRANTY.body);
  assert.equal(DEFAULT_VEHICLE_CONDITIONS.title, STORE_WARRANTY.title);
  const exclusion = DEFAULT_VEHICLE_CONDITIONS.items.find(
    (item) => item.label === "O que a garantia não cobre",
  );
  assert.match(exclusion?.text ?? "", /garantia comercial de 3 meses/i);
  assert.equal(
    FAQ_ITEMS.find((item) => item.question === "Como funciona a garantia?")?.answer,
    STORE_WARRANTY.body,
  );
  assert.equal(
    isLegacyStoreWarrantyCopy(
      "Na Sua Garagem, todo veículo passa por uma revisão completa antes de chegar até você.",
    ),
    true,
  );
  assert.equal(
    isLegacyStoreWarrantyCopy(
      "A loja oferece garantia comercial de 3 meses para motor e câmbio.",
    ),
    false,
  );
});

test("nota própria da vistoria permanece, sem a frase de documento oficial", () => {
  assert.equal(
    publicStoreInspectionText(
      "Lataria revisada na loja. Não é documento oficial de inspeção.",
    ),
    "Lataria revisada na loja.",
  );
  assert.equal(
    publicStoreInspectionText("Óleo e filtros trocados na preparação."),
    "Óleo e filtros trocados na preparação.",
  );
});
