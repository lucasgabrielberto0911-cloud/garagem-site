import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmUnsavedChanges,
  setUnsavedChangesConfirmer,
  UNSAVED_CHANGES_MESSAGE,
} from "@/components/admin/useUnsavedChangesWarning";

test("mensagem de aviso padrão do formulário não salvo", () => {
  assert.equal(
    UNSAVED_CHANGES_MESSAGE,
    "Você tem alterações não salvas. Sair mesmo assim?",
  );
});

test("confirmação delegada a confirmador customizado respeita resposta do usuário", async () => {
  let askedMessage = "";
  setUnsavedChangesConfirmer(async (msg) => {
    askedMessage = msg;
    return true;
  });

  const ok = await confirmUnsavedChanges();
  assert.equal(ok, true);
  assert.equal(askedMessage, UNSAVED_CHANGES_MESSAGE);

  setUnsavedChangesConfirmer(async () => false);
  const cancel = await confirmUnsavedChanges("Deseja sair?");
  assert.equal(cancel, false);

  // Limpa confirmador
  setUnsavedChangesConfirmer(null);
});

test("chamada em ambiente sem document devolve true sem estourar exceção", async () => {
  setUnsavedChangesConfirmer(null);
  // Em ambiente Node (sem document no global), confirmUnsavedChanges resolve com segurança
  const result = await confirmUnsavedChanges();
  assert.equal(result, true);
});
