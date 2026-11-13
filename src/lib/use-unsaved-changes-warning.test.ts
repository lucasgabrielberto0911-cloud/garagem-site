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

test("reativar o guarda antes do recuo agendado não abre o diálogo nem recua a entrada nova", async () => {
  const { activateUnsavedGuard, deactivateUnsavedGuard } = await import(
    "@/components/admin/useUnsavedChangesWarning"
  );
  // O teste anterior deixa `leaving` ligado por 500 ms (estado do módulo).
  await new Promise((r) => setTimeout(r, 600));
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  const goCalls: number[] = [];
  let pushes = 0;
  const g = globalThis as Record<string, unknown>;
  g.window = {
    location: { href: "http://x/admin/vendas/nova" },
    history: {
      state: null,
      pushState: () => void pushes++,
      go: (n: number) => void goCalls.push(n),
    },
    addEventListener: (t: string, fn: (e: unknown) => void) =>
      void (listeners[t] ??= []).push(fn),
    removeEventListener: () => {},
    setTimeout,
  };
  g.document = { addEventListener: () => {}, removeEventListener: () => {} };
  let asked = 0;
  setUnsavedChangesConfirmer(async () => (asked++, false));
  try {
    activateUnsavedGuard(); // rascunho sujo
    deactivateUnsavedGuard(); // autosave terminou: agenda o recuo
    activateUnsavedGuard(); // nova digitação antes do timer
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(goCalls, [], "o recuo agendado foi cancelado");
    assert.equal(pushes, 1, "reaproveita a entrada extra, sem empilhar outra");
    assert.equal(asked, 0, "nenhum diálogo abre sozinho");

    deactivateUnsavedGuard(); // saída limpa: agora sim recua uma vez
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(goCalls, [-1]);
  } finally {
    setUnsavedChangesConfirmer(null);
    delete g.window;
    delete g.document;
  }
});

test("eco do recuo do próprio guarda não é lido como Voltar do usuário", async () => {
  const { activateUnsavedGuard, deactivateUnsavedGuard } = await import(
    "@/components/admin/useUnsavedChangesWarning"
  );
  // Estado do módulo deixado pelos testes anteriores: `leaving` (500 ms) e a marca de eco (1 s).
  await new Promise((r) => setTimeout(r, 1100));
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  const goCalls: number[] = [];
  let pushes = 0;
  const g = globalThis as Record<string, unknown>;
  g.window = {
    location: { href: "http://x/admin/vendas/nova" },
    history: {
      state: null,
      pushState: () => void pushes++,
      go: (n: number) => void goCalls.push(n),
    },
    addEventListener: (t: string, fn: (e: unknown) => void) =>
      void (listeners[t] ??= []).push(fn),
    removeEventListener: () => {},
    setTimeout,
  };
  g.document = { addEventListener: () => {}, removeEventListener: () => {} };
  let asked = 0;
  setUnsavedChangesConfirmer(async () => (asked++, false));
  try {
    activateUnsavedGuard(); // sujo
    deactivateUnsavedGuard(); // autosave terminou
    await new Promise((r) => setTimeout(r, 10)); // o guarda dispara go(-1) sozinho
    assert.deepEqual(goCalls, [-1]);
    activateUnsavedGuard(); // nova digitação ANTES do popstate do go(-1) chegar
    const before = pushes;
    const pop = listeners.popstate.at(-1)!;
    let stopped = false;
    pop({ stopImmediatePropagation: () => void (stopped = true) }); // eco do go(-1)
    assert.equal(asked, 0, "o eco não abre diálogo");
    assert.equal(stopped, false, "o eco segue para o roteador como antes");
    assert.equal(pushes, before + 1, "recria a entrada extra, pois o guarda voltou a valer");

    // Um Voltar de verdade logo depois continua pedindo confirmação.
    pop({ stopImmediatePropagation() {} });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(asked, 1);
  } finally {
    deactivateUnsavedGuard();
    await new Promise((r) => setTimeout(r, 10)); // deixa o recuo agendado rodar com o window falso ainda de pé
    setUnsavedChangesConfirmer(null);
    delete g.window;
    delete g.document;
  }
});
