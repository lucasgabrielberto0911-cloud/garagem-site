import test from "node:test";
import assert from "node:assert/strict";
import { allowsSpeculativeLoading } from "./connection-policy";

test("sem informação de rede mantém o comportamento normal", () => {
  assert.equal(allowsSpeculativeLoading({}), true);
  assert.equal(allowsSpeculativeLoading({ online: true, effectiveType: "4g", downlink: 8 }), true);
});
test("offline, economia de dados e redes limitadas evitam antecipação", () => {
  for (const hints of [{ online: false }, { saveData: true }, { effectiveType: "slow-2g" }, { effectiveType: "2g" }, { effectiveType: "3g" }, { downlink: 0.5 }]) {
    assert.equal(allowsSpeculativeLoading(hints), false);
  }
  assert.equal(allowsSpeculativeLoading({ downlink: 1 }), true);
});
