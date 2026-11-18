import assert from "node:assert/strict";
import test from "node:test";
import {
  createAnnouncementConfirmMessage,
  createAnnouncementHref,
  DELETE_PREPARATION_CONFIRM_MESSAGE,
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
