import assert from "node:assert/strict";
import { test } from "node:test";
import { clearStockPosition, parseStockPosition, readStockPosition, STOCK_POSITION_KEY, STOCK_SCROLL_KEY } from "./stock-return";

const position = {
  version: 1,
  path: "/estoque?brand=Honda&sort=menor-preco",
  href: "/estoque/honda-civic-2015-vehicle-id",
  index: 12,
  page: 2,
  offset: 200,
  scroll: 2788,
  savedAt: 123456,
};

test("a volta pertence à mesma busca e ordenação, independente da ordem dos parâmetros", () => {
  assert.deepEqual(parseStockPosition(JSON.stringify(position), "/estoque?sort=menor-preco&brand=Honda"), position);
});

test("uma posição antiga não desloca uma busca ou ordenação diferente", () => {
  for (const path of ["/estoque", "/estoque?brand=Fiat&sort=menor-preco", "/estoque?brand=Honda&sort=maior-preco"]) {
    assert.equal(parseStockPosition(JSON.stringify(position), path), null);
  }
});

test("armazenamento ausente, danificado ou inválido não impede abrir o estoque", () => {
  for (const raw of [null, "{broken", "null", "[]", "{}", JSON.stringify({ ...position, version: 2 }), JSON.stringify({ ...position, page: 0 }),
    JSON.stringify({ ...position, page: 1.5 }), JSON.stringify({ ...position, index: -1 }),
    JSON.stringify({ ...position, scroll: -10 }), JSON.stringify({ ...position, offset: null }),
    JSON.stringify({ ...position, savedAt: "123456" }), JSON.stringify({ ...position, href: "https://outside.example/estoque/id" })]) {
    assert.equal(parseStockPosition(raw, position.path), null);
  }
});

test("não aplica a volta em outra página, nem aceita caminhos externos ou com barra invertida", () => {
  for (const path of ["/estoque/id", "/estoque-outro", "//outside.example/estoque", "/estoque\\outside"]) {
    assert.equal(parseStockPosition(JSON.stringify({ ...position, path }), path), null);
  }
});

test("um card parcialmente visível mantém sua posição relativa, inclusive no começo da lista", () => {
  const first = { ...position, index: 0, page: 1, scroll: 0, offset: -80 };
  assert.deepEqual(parseStockPosition(JSON.stringify(first), position.path), first);
});


test("terminar uma volta antiga não apaga a posição de um novo carro escolhido", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
  } });
  try {
    const newer = { ...position, version: 1 as const, savedAt: position.savedAt + 1 };
    values.set(STOCK_POSITION_KEY, JSON.stringify(newer));
    values.set(STOCK_SCROLL_KEY, "2788");
    clearStockPosition({ ...position, version: 1 });
    assert.deepEqual(readStockPosition(position.path), newer);
    assert.equal(values.get(STOCK_SCROLL_KEY), "2788");
    clearStockPosition(newer);
    assert.equal(readStockPosition(position.path), null);
    assert.equal(values.has(STOCK_SCROLL_KEY), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "sessionStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});

test("armazenamento bloqueado permite navegar sem recuperação da posição", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("blocked"); } });
  try {
    assert.equal(readStockPosition(position.path), null);
    assert.doesNotThrow(() => clearStockPosition());
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "sessionStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
