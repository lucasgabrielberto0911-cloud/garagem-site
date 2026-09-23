import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STORE_INSPECTION_BODY,
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
