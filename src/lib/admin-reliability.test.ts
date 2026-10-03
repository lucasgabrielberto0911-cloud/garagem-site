import { isSameOriginRequest } from "./admin-request-origin";
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMoneyBR, moneyInput, moneySum } from "./admin-money";
import { businessDay, businessPeriodStart, localDateInput } from "./admin-date";
import { customerSearchWhere } from "./admin-customer-search";
import { csvCell, csvDocument, csvMoney } from "./admin-csv";
import { isCleanupCandidate, PHOTO_CLEANUP_GRACE_MS } from "./admin-cleanup";
import { OrderedSave } from "./ordered-save";
import { vehicleFieldErrors } from "./admin-vehicle-fields";
import { sessionFingerprint } from "./admin-session-fingerprint";

test("dinheiro: centavos brasileiros, grupos e entrada inválida", () => {
  for (const [value, expected] of [
    ["100,50", 100.5],
    ["1.234,56", 1234.56],
    ["100", 100],
    ["0,01", 0.01],
    ["R$ 98.765,40", 98765.4],
  ] as const)
    assert.equal(parseMoneyBR(value), expected);
  for (const value of ["", "texto", "100,500", "1,2,3", "1.23"])
    assert.equal(parseMoneyBR(value), null);
  assert.equal(moneyInput(100.5), "100,50");
  assert.equal(moneySum([0.1, 0.2]), 0.3);
});
test("virada do mês/ano usa o dia do ES mesmo quando UTC já mudou", () => {
  const now = new Date("2027-01-01T01:30:00Z");
  assert.equal(localDateInput(now), "2026-12-31");
  assert.equal(
    businessPeriodStart("month", now).toISOString(),
    "2026-12-01T03:00:00.000Z",
  );
  assert.equal(
    businessPeriodStart("year", now).toISOString(),
    "2026-01-01T03:00:00.000Z",
  );
  assert.equal(businessDay("2026-02-31").toString(), "Invalid Date");
  assert.equal(
    businessDay("2026-10-02").toISOString(),
    "2026-10-02T15:00:00.000Z",
  );
});
test("busca de nome nunca contém um predicado numérico vazio", () => {
  assert.equal(customerSearchWhere("Lucas").OR?.length, 2);
  assert.equal(customerSearchWhere("(27) 99900-0000").OR?.length, 4);
  assert.deepEqual(customerSearchWhere(" "), {});
});
test("CSV protege fórmulas, aspas e multilinhas", () => {
  for (const value of ["=1+1", " +CMD", "@SUM(A1)", "\t-1+2"])
    assert.ok(csvCell(value).startsWith("\"'"));
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell(csvMoney(-1234.56)), '"-1234,56"');
  assert.throws(() => csvMoney(Infinity));
  assert.equal(
    csvDocument([
      ["a", "b"],
      ["linha\n2", 1],
    ]),
    '\uFEFF"a";"b"\r\n"linha\n2";"1"',
  );
});
test("limpeza não inclui referências, upload recente ou arquivo sem idade", () => {
  const now = Date.parse("2026-10-02T00:00:00Z");
  const old = new Date(now - PHOTO_CLEANUP_GRACE_MS - 1000).toISOString();
  assert.equal(
    isCleanupCandidate({ name: "old.webp", created_at: old }, new Set(), now),
    true,
  );
  assert.equal(
    isCleanupCandidate(
      { name: "founder.webp", created_at: old },
      new Set(["founder.webp"]),
      now,
    ),
    false,
  );
  assert.equal(
    isCleanupCandidate(
      { name: "draft.webp", created_at: new Date(now - 60000).toISOString() },
      new Set(),
      now,
    ),
    false,
  );
  assert.equal(
    isCleanupCandidate({ name: "unknown.webp" }, new Set(), now),
    false,
  );
  assert.equal(
    isCleanupCandidate(
      {
        name: "old.webp",
        created_at: old,
        updated_at: new Date(now).toISOString(),
      },
      new Set(),
      now,
    ),
    false,
  );
});
test("autosave não permite concorrência nem confirma uma revisão mais nova", async () => {
  const writes: number[] = [];
  const states: string[] = [];
  let finish!: () => void;
  const first = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const queue = new OrderedSave<number>(
    async (value) => {
      writes.push(value);
      if (value === 1) await first;
    },
    (state) => states.push(state),
  );
  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);
  assert.deepEqual(writes, [1]);
  assert.equal(states.includes("saved"), false);
  finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(writes, [1, 3]);
  assert.equal(queue.pending, false);
  assert.equal(states.at(-1), "saved");
});
test("autosave mantém a última mudança após falha e permite reenviar", async () => {
  let fail = true;
  const writes: number[] = [];
  const states: string[] = [];
  const queue = new OrderedSave<number>(
    async (value) => {
      if (fail) throw new Error("offline");
      writes.push(value);
    },
    (state) => states.push(state),
  );
  queue.enqueue(10);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(queue.pending, true);
  assert.equal(states.at(-1), "error");
  fail = false;
  queue.retry();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(writes, [10]);
  assert.equal(queue.pending, false);
});
test("servidor valida status, anos inteiros, quilometragem e portas", () => {
  assert.deepEqual(
    vehicleFieldErrors(
      { year: 2020, yearModel: 2021, km: 0, status: "disponivel", doors: 4 },
      2026,
    ),
    {},
  );
  const errors = vehicleFieldErrors(
    { year: 2020.5, yearModel: 2035, km: 1.5, status: "qualquer", doors: 2.5 },
    2026,
  );
  assert.deepEqual(Object.keys(errors), [
    "year",
    "yearModel",
    "km",
    "status",
    "doors",
  ]);
});
test("alterar senha ou e-mail invalida a impressão da sessão antiga", () => {
  const first = sessionFingerprint("hash-original", "admin@example.test");
  assert.notEqual(first, sessionFingerprint("hash-novo", "admin@example.test"));
  assert.notEqual(
    first,
    sessionFingerprint("hash-original", "outro@example.test"),
  );
});

test("datas inválidas retornam erro sem quebrar a validação", () => {
  for (const text of ["2026-99-99", "2026-00-01", "2026-02-30", "texto"])
    assert.ok(Number.isNaN(businessDay(text).getTime()));
});
test("origem considera o Host público atrás do proxy e rejeita outra origem", () => {
  assert.equal(
    isSameOriginRequest(
      new Request("http://localhost:3100/api", {
        headers: {
          host: "www.suagaragem.net",
          origin: "https://www.suagaragem.net",
        },
      }),
    ),
    true,
  );
  assert.equal(
    isSameOriginRequest(
      new Request("http://localhost:3100/api", {
        headers: {
          host: "www.suagaragem.net",
          origin: "https://other.example.test",
        },
      }),
    ),
    false,
  );
  assert.equal(
    isSameOriginRequest(
      new Request("http://localhost:3100/api", { headers: { origin: "null" } }),
    ),
    false,
  );
});
