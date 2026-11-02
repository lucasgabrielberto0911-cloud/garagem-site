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

test("Voltar de novo com o modal aberto não sai sem confirmar", async () => {
  const { activateUnsavedGuard, deactivateUnsavedGuard } = await import(
    "@/components/admin/useUnsavedChangesWarning"
  );
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  let goCalls: number[] = [];
  const g = globalThis as Record<string, unknown>;
  const loc = { href: "http://x/admin/veiculos/novo" };
  g.window = {
    location: loc,
    history: {
      state: null,
      pushState: () => {},
      go: (n: number) => void goCalls.push(n),
    },
    addEventListener: (t: string, fn: (e: unknown) => void) =>
      void (listeners[t] ??= []).push(fn),
    removeEventListener: () => {},
    setTimeout,
  };
  g.document = { addEventListener: () => {}, removeEventListener: () => {} };

  let resolveConfirm!: (v: boolean) => void;
  setUnsavedChangesConfirmer(
    () => new Promise<boolean>((r) => (resolveConfirm = r)),
  );
  try {
    activateUnsavedGuard();
    const pop = listeners.popstate[0];
    const ev = () => ({ stopImmediatePropagation() {} });

    pop(ev()); // 1º Voltar: abre a confirmação
    goCalls = [];
    loc.href = "http://x/anterior";
    pop(ev()); // 2º Voltar com modal aberto
    assert.deepEqual(goCalls, [1], "deve desfazer o recuo (go(1))");
    loc.href = "http://x/admin/veiculos/novo";
    pop(ev()); // eco do go(1) é ignorado
    assert.deepEqual(goCalls, [1]);

    resolveConfirm(true);
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(goCalls, [1, -1], "só sai após confirmar");
  } finally {
    deactivateUnsavedGuard();
    setUnsavedChangesConfirmer(null);
    delete g.window;
    delete g.document;
  }
});
