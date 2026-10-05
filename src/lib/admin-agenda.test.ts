import assert from "node:assert/strict";
import { test } from "node:test";
import { agendaWhere, parseAgendaPeriod } from "./admin-agenda";

test("agenda usa o dia de São Paulo e separa períodos sem sobreposição", () => {
  const now = new Date("2026-10-06T01:30:00Z");
  assert.deepEqual(agendaWhere("hoje", now), {
    status: { notIn: ["fechado", "perdido"] },
    nextActionAt: { gte: new Date("2026-10-05T03:00:00Z"), lt: new Date("2026-10-06T03:00:00Z") },
  });
  assert.deepEqual(agendaWhere("atrasados", now).nextActionAt, { lt: new Date("2026-10-05T03:00:00Z") });
  assert.deepEqual(agendaWhere("proximos", now).nextActionAt, { gte: new Date("2026-10-06T03:00:00Z") });
  assert.equal(parseAgendaPeriod("outro"), "hoje");
});
