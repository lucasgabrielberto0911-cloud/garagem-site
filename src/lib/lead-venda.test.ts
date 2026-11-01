import assert from "node:assert/strict";
import { test } from "node:test";
import { createLeadVenda } from "./lead-venda";
import { prisma } from "./prisma";
import { mockPrismaMethod } from "./test-mock";

const base = {
  name: "Cliente Teste",
  phone: "27999999999",
  vehicleInfo: "Modelo teste",
  plate: "ABC1D23",
  km: 1000,
  notes: null,
  interestVehicleId: "veiculo-1",
  source: "site",
  photoUrls: ["foto-1.webp"],
};

const colunaAusente = Object.assign(new Error("coluna"), { code: "P2022", meta: { column: "requestKey" } });

test("com requestKey existente devolve o lead já criado, sem criar outro", async (t) => {
  mockPrismaMethod(t, prisma.leadVenda, "findUnique", async () => ({ id: "lead-1" }));
  const tx = mockPrismaMethod(t, prisma, "$transaction", async () => ({ id: "novo" }));
  const result = await createLeadVenda({ ...base, requestKey: "chave-12345678" });
  assert.deepEqual(result, { id: "lead-1", duplicate: true });
  assert.equal(tx.mock.callCount(), 0);
});

test("coluna ausente: fallback mantém foto, veículo e origem e tira só requestKey", async (t) => {
  mockPrismaMethod(t, prisma.leadVenda, "findUnique", async () => null);
  mockPrismaMethod(t, prisma, "$transaction", async () => { throw colunaAusente; });
  const create = mockPrismaMethod(t, prisma.leadVenda, "create", async () => ({ id: "lead-2" }));
  const result = await createLeadVenda({ ...base, requestKey: "chave-12345678" });
  assert.deepEqual(result, { id: "lead-2" });
  const { data } = create.mock.calls[0]!.arguments[0] as { data: Record<string, unknown> };
  assert.equal("requestKey" in data, false);
  assert.deepEqual(data.photoUrls, base.photoUrls);
  assert.equal(data.interestVehicleId, base.interestVehicleId);
  assert.equal(data.source, base.source);
});

test("erro que não é coluna ausente continua subindo", async (t) => {
  mockPrismaMethod(t, prisma, "$transaction", async () => { throw new Error("outro erro"); });
  await assert.rejects(createLeadVenda({ ...base }), /outro erro/);
});
