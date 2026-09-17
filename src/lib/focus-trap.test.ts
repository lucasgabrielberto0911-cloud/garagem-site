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
