import assert from "node:assert/strict";
import { test } from "node:test";
import { draftBannerLabel, draftStatusText } from "./vehicle-draft-status";

test("status do rascunho em texto curto", () => {
  assert.equal(draftStatusText({ status: "pending", savedAt: null }), "Salvando…");
  assert.equal(
    draftStatusText({ status: "error", savedAt: null }),
    "Sem conexão: cópia no aparelho",
  );
  assert.equal(
    draftStatusText({ status: "idle", savedAt: null }),
    "Rascunho automático",
  );
  assert.match(
    draftStatusText({ status: "saved", savedAt: "2026-10-30T17:32:00Z" }),
    /^Salvo às \d{2}:\d{2}$/,
  );
});

test("aviso de retomada resume carro e dia", () => {
  const now = new Date("2026-10-31T15:00:00");
  const draft = { brand: "Honda", model: "Civic", year: "2019" };
  assert.match(
    draftBannerLabel(draft, "2026-10-31T10:04:00", now),
    /^Rascunho: Honda Civic 2019, hoje às \d{2}:\d{2}$/,
  );
  assert.match(
    draftBannerLabel(draft, "2026-10-30T10:04:00", now),
    /, ontem às /,
  );
  assert.equal(draftBannerLabel({}, null, now), "Rascunho: veículo sem nome");
});
