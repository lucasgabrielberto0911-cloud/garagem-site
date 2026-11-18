import assert from "node:assert/strict";
import test from "node:test";
import {
  createAnnouncementConfirmMessage,
  createAnnouncementHref,
  DELETE_PREPARATION_CONFIRM_MESSAGE,
  getDeletePreparationDialog,
  getPreparationAnnouncementAriaLabel,
  getPreparationAnnouncementDialog,
  getPreparationAnnouncementMode,
} from "./preparation-confirm";

test("link do anúncio leva ao cadastro com o id da preparação", () => {
  assert.equal(createAnnouncementHref("abc123"), "/admin/veiculos/novo?prep=abc123");
  assert.equal(
    createAnnouncementHref("a b/c"),
    `/admin/veiculos/novo?prep=${encodeURIComponent("a b/c")}`,
  );
});

test("confirmação de publicar usa linguagem simples e lembra fotos e preço", () => {
  const pronto = createAnnouncementConfirmMessage(true);
  const emPreparo = createAnnouncementConfirmMessage(false);
  assert.ok(pronto.includes("Criar o anúncio"));
  assert.ok(pronto.includes("fotos e preço"));
  assert.ok(emPreparo.includes("ainda não está marcado como pronto"));
  assert.ok(emPreparo.includes("fotos e preço"));
});

test("confirmação de excluir avisa que não dá para desfazer", () => {
  assert.ok(DELETE_PREPARATION_CONFIRM_MESSAGE.includes("Excluir"));
  assert.ok(DELETE_PREPARATION_CONFIRM_MESSAGE.includes("Não dá para desfazer"));
});

test("decisão do Criar anúncio depende do pronto", () => {
  assert.equal(getPreparationAnnouncementMode(true), "move-to-stock");
  assert.equal(getPreparationAnnouncementMode(false), "mark-ready-and-move");
});

test("diálogo do Criar anúncio muda o rótulo quando ainda em preparo", () => {
  const pronto = getPreparationAnnouncementDialog(true);
  const emPreparo = getPreparationAnnouncementDialog(false);
  assert.equal(pronto.confirmLabel, "Criar anúncio");
  assert.ok(pronto.title.includes("Criar o anúncio"));
  assert.ok(pronto.description.includes("fotos e preço"));
  assert.ok(emPreparo.title.includes("Marcar como pronto"));
  assert.equal(emPreparo.confirmLabel, "Marcar como pronto e continuar");
  assert.ok(emPreparo.description.includes("ainda não está marcado como pronto"));
  assert.ok(emPreparo.description.includes("fotos e preço"));
});

test("rótulo acessível do Criar anúncio muda quando ainda em preparo", () => {
  assert.equal(
    getPreparationAnnouncementAriaLabel(true),
    "Criar anúncio deste carro",
  );
  assert.equal(
    getPreparationAnnouncementAriaLabel(false),
    "Marcar como pronto e criar anúncio deste carro",
  );
});

test("diálogo de excluir é de perigo e pede confirmação", () => {
  const dialog = getDeletePreparationDialog();
  assert.equal(dialog.danger, true);
  assert.equal(dialog.confirmLabel, "Excluir");
  assert.ok(dialog.description.includes("Não dá para desfazer"));
});
