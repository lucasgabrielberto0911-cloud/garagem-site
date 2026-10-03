/** Integration checks ONLY against the disposable local admin database. */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  checkSharedLoginLimit,
  clearSharedLoginLimit,
} from "../src/lib/admin-login-limit";
import {
  getAdminSalesPage,
  getAdminSalesTotals,
} from "../src/lib/admin-vehicles";
import { customerSearchWhere } from "../src/lib/admin-customer-search";
import { sessionFingerprint } from "../src/lib/admin-session-fingerprint";
import { withAdminStorageLock } from "../src/lib/admin-storage-lock";
import { lockCustomerIdentity } from "../src/lib/admin-customer-lock";

const url = new URL(process.env.DATABASE_URL || "postgresql://invalid/invalid");
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !url.pathname.endsWith("/garagem_admin_test")
)
  throw new Error("Use somente o banco local descartável garagem_admin_test.");
const db = new PrismaClient();
async function main() {
  await withAdminStorageLock(async (tx) => {
    await lockCustomerIdentity(tx, "27990000000", "00000000000");
    assert.equal(await tx.admin.count(), await db.admin.count());
  });
  // A disposable database, never point this script at an existing store database.
  await db.$transaction([
    db.leadActivity.deleteMany(),
    db.adminAudit.deleteMany(),
    db.adminDraft.deleteMany(),
    db.adminLoginAttempt.deleteMany(),
    db.sale.deleteMany(),
    db.photo.deleteMany(),
    db.vehicleCost.deleteMany(),
    db.vehicleDocument.deleteMany(),
    db.vehicle.deleteMany(),
    db.customer.deleteMany(),
    db.leadVenda.deleteMany(),
    db.testimonial.deleteMany(),
    db.siteSettings.deleteMany(),
    db.admin.deleteMany(),
  ]);
  const admin = await db.admin.create({
    data: {
      id: "admin-local-test",
      name: "Ambiente de teste",
      email: "admin@example.test",
      passwordHash: await bcrypt.hash("LocalTestOnly123!", 10),
    },
  });
  const base = {
    fuel: "Flex",
    transmission: "Automático",
    locationCity: "serra",
    color: "Prata",
    year: 2020,
    yearModel: 2021,
    km: 20000,
    brand: "Veículo de teste",
    model: "Demonstração",
    price: 45000,
    description:
      "Dados sintéticos para validação. Este anúncio não existe na loja.",
  };
  for (const [id, model, purchasePrice] of [
    ["vehicle-test-duster", "Duster · teste", 30000.5],
    ["vehicle-test-civic", "Civic · teste", null],
    ["vehicle-test-hrv", "HR-V · teste", 35000],
  ] as const)
    await db.vehicle.create({
      data: {
        ...base,
        id,
        model,
        purchasePrice,
        photos: {
          create: Array.from({ length: 12 }, (_, order) => ({
            url: "/branding/placeholder-car.png",
            order,
          })),
        },
        costs: {
          create: {
            kind: "mecanica",
            description: "Custo sintético",
            amount: 100.5,
          },
        },
      },
    });
  await db.vehicle.create({
    data: {
      ...base,
      id: "vehicle-sold-gap",
      model: "Venda pendente · teste",
      status: "vendido",
    },
  });
  const customer = await db.customer.create({
    data: {
      id: "customer-local-test",
      name: "Cliente de teste",
      phone: "27990000000",
      cpf: "00000000000",
      email: "cliente@example.test",
    },
  });
  for (let i = 0; i < 95; i++) {
    const v = await db.vehicle.create({
      data: {
        ...base,
        id: `historical-local-${i}`,
        brand: "Histórico de teste",
        model: `Registro ${i + 1}`,
        status: "vendido",
        historical: true,
        purchasePrice: i % 2 === 0 ? 10000.5 : null,
      },
    });
    await db.sale.create({
      data: {
        id: `sale-local-${i}`,
        vehicleId: v.id,
        customerId: customer.id,
        salePrice: 20000.55,
        paymentMethod: "À vista (Pix/dinheiro)",
        saleDate: new Date(
          i < 90 ? "2026-09-15T15:00:00Z" : "2026-08-15T15:00:00Z",
        ),
      },
    });
  }
  await db.leadVenda.create({
    data: {
      id: "lead-local-test",
      name: "Contato de teste",
      phone: "27990000000",
      vehicleInfo: "Pedido de teste — sem envio real",
      nextAction: "Confirmar preferência de modelo",
      nextActionAt: new Date("2026-10-01T15:00:00Z"),
    },
  });
  await db.siteSettings.create({
    data: {
      id: "default",
      region: "Atendimento de teste no ES",
      email: "contato@example.test",
      address: "Ambiente de teste — não é dado da loja",
      hours: "Horário de teste",
      hoursWeekdays: "Horário de teste",
      hoursSaturday: "Horário de teste",
    },
  });
  assert.equal(
    (
      await db.customer.findMany({
        where: customerSearchWhere("InexistenteZXQ"),
      })
    ).length,
    0,
  );
  assert.equal(
    (await db.customer.findMany({ where: customerSearchWhere("Cliente") }))
      .length,
    1,
  );
  const page = await getAdminSalesPage({
    page: 1,
    pageSize: 500,
    period: "all",
  });
  assert.equal(page.sales.length, 80);
  assert.equal(page.total, 95);
  const total = await getAdminSalesTotals("all");
  assert.equal(total.count, 95);
  assert.equal(total.revenue, 1900052.25);
  assert.equal(total.profitCount, 48);
  assert.equal(total.incomplete, 47);
  const fingerprint = sessionFingerprint(admin.passwordHash, admin.email);
  assert.notEqual(
    fingerprint,
    sessionFingerprint(
      await bcrypt.hash("OutraSenhaDeTeste!", 10),
      admin.email,
    ),
  );
  const tries = await Promise.all(
    Array.from({ length: 12 }, () =>
      checkSharedLoginLimit("db-integration-test"),
    ),
  );
  assert.equal(tries.filter((t) => t.ok).length, 8);
  await clearSharedLoginLimit("db-integration-test");
  const original = await db.vehicle.findUniqueOrThrow({
    where: { id: "vehicle-test-duster" },
  });
  await db.vehicle.update({
    where: { id: original.id, updatedAt: original.updatedAt },
    data: { price: 45000.01 },
  });
  await assert.rejects(() =>
    db.$transaction(async (tx) => {
      await tx.photo.deleteMany({ where: { vehicleId: original.id } });
      await tx.vehicle.update({
        where: { id: original.id, updatedAt: original.updatedAt },
        data: { price: 50000 },
      });
    }),
  );
  assert.equal(
    await db.photo.count({ where: { vehicleId: original.id } }),
    12,
    "conflito não pode apagar fotos",
  );
  await db.adminDraft.create({
    data: {
      adminId: admin.id,
      key: "vehicle:new",
      payload: { brand: "Rascunho privado" },
      photoUrls: [
        "https://example.test/storage/v1/object/public/veiculos/draft.webp",
      ],
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  assert.equal(
    await db.vehicle.count({ where: { brand: "Rascunho privado" } }),
    0,
  );
  console.log(
    "Integração local OK: busca, 95 vendas, totais completos, centavos, limite concorrente, conflito e rascunho privado.",
  );
}
main().finally(() => db.$disconnect());
