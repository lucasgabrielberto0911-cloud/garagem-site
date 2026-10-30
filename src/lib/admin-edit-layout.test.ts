import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("EditLayout mantém as 4 etapas com botões de acesso direto, Salvar alterações sempre visível e menu de ações (M5)", () => {
  const editLayout = readFileSync(
    new URL("src/components/admin/vehicle-form/EditLayout.tsx", root),
    "utf8",
  );
  const actionsMenu = readFileSync(
    new URL("src/components/admin/vehicle-form/VehicleActionsMenu.tsx", root),
    "utf8",
  );
  const vehicleForm = readFileSync(
    new URL("src/components/admin/vehicle-form/VehicleForm.tsx", root),
    "utf8",
  );

  // EditLayout tem navegação de etapas com botões clicáveis para qualquer etapa
  assert.match(editLayout, /aria-label="Etapas do anúncio"/);
  assert.match(editLayout, /onClick=\{\(\) => changeStep\(current\)\}/);
  // Rótulo curto da etapa 3 destaca Preço no celular
  assert.match(editLayout, /"Preço"/);
  // Botão Salvar alterações sempre visível no rodapé da edição (fora de condicional step === 4)
  assert.match(editLayout, /Salvar alterações/);
  assert.doesNotMatch(editLayout, /step === 4 \?/);
  // PriceStatusSection ("essencial") aparece no topo da etapa 3 na edição (order: 0)
  assert.match(
    editLayout,
    /!visible\.includes\("essencial"\)\}\s*style=\{\{\s*order:\s*0\s*\}\}/,
  );

  // VehicleForm só intercepta submit antes da etapa 4 no modo create; em edit salva direto
  assert.match(vehicleForm, /if \(mode === "create" && step !== 4\)/);

  // VehicleActionsMenu não está mais hidden e expõe o botão "Mais ações do anúncio" + 4 ações no ActionSheet
  assert.doesNotMatch(actionsMenu, /<div hidden>/);
  assert.match(actionsMenu, /aria-label="Mais ações do anúncio"/);
  assert.match(actionsMenu, /label="Ver no site"/);
  assert.match(actionsMenu, /label="Kit de divulgação"/);
  assert.match(actionsMenu, /label="Iniciar venda"/);
  assert.match(actionsMenu, /label="Excluir definitivamente"/);
});
