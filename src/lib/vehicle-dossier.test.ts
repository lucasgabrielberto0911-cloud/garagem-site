import assert from "node:assert/strict";
import { test } from "node:test";
import { publicDossierChips } from "./vehicle-dossier";

test("chips do dossiê só aparecem quando o item é verdadeiro", () => {
  assert.deepEqual(publicDossierChips({}), []);
  assert.deepEqual(
    publicDossierChips({
      hasSpareKey: false,
      hasManual: false,
      hasVideo: false,
    }),
    [],
  );
  assert.deepEqual(
    publicDossierChips({
      hasSpareKey: true,
      hasManual: null,
      hasVideo: false,
    }),
    ["Chave reserva"],
  );
  assert.deepEqual(
    publicDossierChips({
      hasSpareKey: true,
      hasManual: true,
      hasVideo: true,
    }),
    ["Chave reserva", "Manual do proprietário", "Vídeo sob pedido"],
  );
});
