/* eslint-disable @typescript-eslint/no-explicit-any -- fake mínimo de tx do Prisma */
import assert from "node:assert/strict";
import test from "node:test";
import { completeCustomerFields } from "./admin-customer-complete";

type Row = { id: string; phone: string; cpf: string | null; address: string | null };

/** Fake de tx: o lock por chave serializa quem pede a mesma chave, como pg_advisory_xact_lock. */
function makeDb(rows: Row[]) {
  const locks = new Map<string, Promise<void>>();
  const match = (r: Row, w: any) =>
    (w.id === undefined || (typeof w.id === "string" ? r.id === w.id : r.id !== w.id.not)) &&
    (w.cpf === undefined || r.cpf === w.cpf) &&
    (!w.OR || w.OR.some((c: any) => Object.entries(c).every(([k, v]) => ((r as any)[k] ?? null) === v || (v === null && (r as any)[k] == null))));
  async function run<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const releases: Array<() => void> = [];
    const tx: any = {
      $queryRaw: async (_s: TemplateStringsArray, key: string) => {
        const prev = locks.get(key) ?? Promise.resolve();
        let release!: () => void;
        locks.set(key, new Promise<void>((r) => (release = r)));
        releases.push(release);
        await prev;
        await new Promise((r) => setTimeout(r, 1));
        return [];
      },
      customer: {
        findUnique: async ({ where }: any) => { await Promise.resolve(); return structuredClone(rows.find((r) => r.id === where.id) ?? null); },
        findUniqueOrThrow: async ({ where }: any) => structuredClone(rows.find((r) => r.id === where.id)!),
        findFirst: async ({ where }: any) => { await new Promise((r) => setTimeout(r, 2)); return rows.find((r) => r.cpf === where.cpf && r.id !== where.id.not) ?? null; },
        updateMany: async ({ where, data }: any) => { const hit = rows.filter((r) => match(r, where)); hit.forEach((r) => Object.assign(r, data)); return { count: hit.length }; },
      },
    };
    try { return await fn(tx); } finally { releases.forEach((r) => r()); }
  }
  return run;
}

test("dois clientes disputando o mesmo CPF: só um grava", async () => {
  const rows: Row[] = [
    { id: "a", phone: "1", cpf: null, address: null },
    { id: "b", phone: "2", cpf: null, address: null },
  ];
  const run = makeDb(rows);
  const [x, y] = await Promise.all([
    run((tx) => completeCustomerFields(tx, "a", "52998224725", "")),
    run((tx) => completeCustomerFields(tx, "b", "52998224725", "")),
  ]);
  assert.equal([x, y].filter((r) => r.ok).length, 1);
  assert.equal(rows.filter((r) => r.cpf === "52998224725").length, 1);
});

test("não sobrescreve campo já preenchido", async () => {
  const rows: Row[] = [{ id: "a", phone: "1", cpf: "11111111111", address: "Rua X" }];
  const res = await makeDb(rows)((tx) => completeCustomerFields(tx, "a", "52998224725", "Rua Y"));
  assert.equal(res.ok, false);
  assert.equal(rows[0].cpf, "11111111111");
  assert.equal(rows[0].address, "Rua X");
});
