import assert from "node:assert/strict";
import { test } from "node:test";
import { handleFocusTrap } from "./focus-trap";

test("handleFocusTrap ignora teclas que não são Tab", () => {
  const container = {
    querySelectorAll: () => [],
  } as unknown as HTMLElement;
  const event = {
    key: "Escape",
    preventDefault() {},
  } as KeyboardEvent;
  assert.equal(handleFocusTrap(event, container), false);
});

test("handleFocusTrap prende o foco e cicla entre primeiro e último elemento", () => {
  let firstFocused = false;
  let lastFocused = false;
  let defaultPrevented = false;

  const first = {
    tabIndex: 0,
    hasAttribute: () => false,
    getAttribute: () => null,
    focus: () => { firstFocused = true; },
  };
  const last = {
    tabIndex: 0,
    hasAttribute: () => false,
    getAttribute: () => null,
    focus: () => { lastFocused = true; },
  };

  const container = {
    querySelectorAll: () => [first, last],
  } as unknown as HTMLElement;

  const originalDocument = globalThis.document;
  try {
    (globalThis as unknown as { document: { activeElement: unknown } }).document = { activeElement: first };
    const shiftTabEvent = {
      key: "Tab",
      shiftKey: true,
      preventDefault: () => { defaultPrevented = true; },
    } as KeyboardEvent;
    assert.equal(handleFocusTrap(shiftTabEvent, container), true);
    assert.equal(lastFocused, true);
    assert.equal(defaultPrevented, true);

    (globalThis as unknown as { document: { activeElement: unknown } }).document = { activeElement: last };
    defaultPrevented = false;
    const tabEvent = {
      key: "Tab",
      shiftKey: false,
      preventDefault: () => { defaultPrevented = true; },
    } as KeyboardEvent;
    assert.equal(handleFocusTrap(tabEvent, container), true);
    assert.equal(firstFocused, true);
    assert.equal(defaultPrevented, true);
  } finally {
    globalThis.document = originalDocument;
  }
});
