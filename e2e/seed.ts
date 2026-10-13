import { PrismaClient } from "@prisma/client";
import samples from "./public-samples.json";

// Fixtures ficam exclusivamente no Postgres local/efêmero do CI.
const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
if (process.env.E2E_TEST !== "1" || !["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) || !["/ci", "/garagem_e2e"].includes(database.pathname)) {
  throw new Error("E2E exige banco local dedicado (ci ou garagem_e2e) e E2E_TEST=1.");
}
if (process.env.LEAD_WEBHOOK_URL || process.env.RESEND_API_KEY || process.env.LEAD_NOTIFY_TO || process.env.LEAD_NOTIFY_EMAIL) {
  throw new Error("Notificações externas devem estar desligadas no E2E.");
}
async function seed() {
const prisma = new PrismaClient();
try {
  for (const sample of samples) {
    const { photos, ...publicFields } = sample;
    const data = { ...publicFields, year: sample.yearModel, status: "disponivel", featured: true, historical: false };
    await prisma.vehicle.upsert({ where: { id: sample.id }, create: data, update: data });
    await prisma.photo.deleteMany({ where: { vehicleId: sample.id } });
    await prisma.photo.createMany({ data: photos.map((photo, order) => ({ ...photo, vehicleId: sample.id, order })) });
  }
  const soldId = "ce2esold000000000000000001";
  const { photos, ...civic } = samples[0];
  const sold = { ...civic, id: soldId, year: civic.yearModel, status: "vendido", featured: false, historical: false };
  await prisma.vehicle.upsert({ where: { id: soldId }, create: sold, update: sold });
  await prisma.photo.deleteMany({ where: { vehicleId: soldId } });
  await prisma.photo.createMany({ data: photos.map((photo, order) => ({ ...photo, vehicleId: soldId, order })) });
  // A conversa HTTP reproduz o caso informado pelo Lucas sem mudar as fixtures do browser.
  if (process.env.E2E_CHAT_CONVERSA === "1") {
    const weekend = {
      brand: "Fiat", model: "Palio Weekend", year: 2016, yearModel: 2016,
      price: 47900, transmission: "Manual", category: "carro", fuel: "Flex",
      km: 50000, status: "disponivel", historical: false,
    };
    await prisma.vehicle.upsert({
      where: { id: "ce2eweekend000000000000001" },
      create: { id: "ce2eweekend000000000000001", ...weekend }, update: weekend,
    });
    console.log("Conversa HTTP: Palio Weekend 2016 manual de R$ 47.900 (km fictício de teste).");
  }
  console.log("E2E: três disponíveis e uma simulação de vendido no banco local.");
} finally { await prisma.$disconnect(); }

}
seed().catch(error => { console.error(error); process.exitCode = 1; });
