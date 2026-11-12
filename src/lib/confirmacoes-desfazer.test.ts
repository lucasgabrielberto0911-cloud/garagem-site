import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function installFakeWindow(initial?: string[]) {
  const store = new Map<string, string>();
  if (initial) store.set("garagem:favoritos", JSON.stringify(initial));
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
    dispatchEvent: () => true,
  };
  return () => JSON.parse(store.get("garagem:favoritos") ?? "[]") as string[];
}

test("desfazer limpar favoritos recoloca os antigos na ordem original", async () => {
  const saved = installFakeWindow([]);
  try {
    const { restoreFavoriteIds } = await import("./favorites");
    assert.deepEqual(restoreFavoriteIds(["c", "b", "a"]), ["c", "b", "a"]);
    assert.deepEqual(saved(), ["c", "b", "a"]);
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test("desfazer mantém o que foi salvo depois, na frente, sem duplicar", async () => {
  const saved = installFakeWindow(["novo", "b"]);
  try {
    const { restoreFavoriteIds } = await import("./favorites");
    assert.deepEqual(restoreFavoriteIds(["c", "b", "a"]), ["novo", "c", "b", "a"]);
    assert.deepEqual(saved(), ["novo", "c", "b", "a"]);
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test("limpar favoritos desfaz por toast e não usa window.confirm", () => {
  const list = readFileSync("src/components/site/FavoritesList.tsx", "utf8");
  assert.doesNotMatch(list, /window\.confirm/);
  assert.match(list, /label: "Desfazer", onClick: \(\) => restore\(previous\)/);
});

test("painel usa o diálogo padrão em vez de window.confirm", () => {
  for (const file of [
    "src/components/admin/SaleFlow.tsx",
    "src/components/admin/compra/PurchaseForm.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /window\.confirm/, file);
    assert.match(source, /useConfirmDialog\(\)/, file);
    assert.match(source, /\{confirmDialog\}/, file);
  }
});
