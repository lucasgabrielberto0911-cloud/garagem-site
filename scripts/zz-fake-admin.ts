// Dados FICTÍCIOS só para auditoria local do admin (banco local "ci"). Nada real.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
const day = 86400000;
async function main() {
  const email = "auditoria@teste.local";
  await prisma.admin.upsert({ where: { email }, update: { passwordHash: await bcrypt.hash("Auditoria#2026", 4) }, create: { name: "Auditoria", email, passwordHash: await bcrypt.hash("Auditoria#2026", 4) } });
  const base = [
    ["Fiat", "Argo", "Drive 1.0", 2021, 5, 62900, 54000, false],
    ["Chevrolet", "Onix", "LT 1.0 Turbo", 2022, 18, 78900, 69000, false],
    ["Volkswagen", "Gol", "1.0 MPI", 2019, 34, 45900, 39000, false],
    ["Toyota", "Corolla", "XEi 2.0 Automático", 2020, 41, 112900, 98000, false],
    ["Jeep", "Renegade", "Longitude 1.8 Automático", 2018, 52, 84900, 76000, false],
    ["Honda", "Fit", "EX 1.5 CVT", 2017, 66, 69900, 0, true],
    ["Renault", "Logan", "Expression 1.6", 2016, 88, 38900, 33000, false],
    ["Ford", "EcoSport", "Titanium 2.0 Automático", 2019, 120, 74900, 70000, false],
    ["Hyundai", "Creta", "Pulse 1.6 Automático", 2021, 9, 0, 0, false],
  ] as const;
  for (const [brand, model, version, year, age, price, buy, consigned] of base) {
    const v = await prisma.vehicle.create({ data: { brand, model, version, year, yearModel: year, km: 30000 + age * 900, price, purchasePrice: buy || null, consigned, fuel: "Flex", transmission: version.includes("Autom") || version.includes("CVT") ? "Automático" : "Manual", color: "Prata", description: age % 2 ? "Carro revisado, pronto para rodar. Financiamos em até 60x." : null, createdAt: new Date(Date.now() - age * day), status: "disponivel" } });
    if (age % 3 !== 2) await prisma.photo.create({ data: { vehicleId: v.id, url: "/branding/placeholder-car.png", order: 0 } });
    if (buy) await prisma.vehicleCost.create({ data: { vehicleId: v.id, kind: "mecanica", description: "Revisão fictícia", amount: 1200 } });
  }
  for (const [brand, model, price, d] of [["Nissan", "Kicks", 89900, 3], ["Fiat", "Mobi", 52900, 12]] as const) {
    const v = await prisma.vehicle.create({ data: { brand, model, year: 2021, yearModel: 2021, km: 40000, price, purchasePrice: price - 9000, fuel: "Flex", transmission: "Manual", status: "vendido", createdAt: new Date(Date.now() - 40 * day) } });
    await prisma.sale.create({ data: { vehicleId: v.id, salePrice: price - 1000, paymentMethod: "pix", saleDate: new Date(Date.now() - d * day) } });
  }
  await prisma.preparationVehicle.createMany({ data: [{ brand: "Peugeot", model: "208", year: 2020, ready: true }, { brand: "VW", model: "Polo", year: 2019 }] });
  console.log("ok dados fictícios");
}
main().finally(() => prisma.$disconnect());
