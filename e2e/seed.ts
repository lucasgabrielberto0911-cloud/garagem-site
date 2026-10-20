import { PrismaClient } from "@prisma/client";
import samples from "./public-samples.json";
import { SEED_TESTIMONIALS } from "../src/lib/testimonials-seed";

// Fixtures ficam exclusivamente no Postgres local/efêmero do CI.
const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
if (process.env.E2E_TEST !== "1" || !["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) || !["/ci", "/garagem_e2e"].includes(database.pathname)) {
  throw new Error("E2E exige banco local dedicado (ci ou garagem_e2e) e E2E_TEST=1.");
}
if (process.env.LEAD_WEBHOOK_URL || process.env.RESEND_API_KEY || process.env.LEAD_NOTIFY_TO || process.env.LEAD_NOTIFY_EMAIL) {
  throw new Error("Notificações externas devem estar desligadas no E2E.");
}
// Itens da ficha: Civic com poucos itens, HR-V com muitos (grade de chips).
const ACCESSORIES: Record<string, string[]> = {
  civic: ["Ar-condicionado", "Direção elétrica", "Bluetooth"],
  hrv: ["Multimídia", "Bluetooth", "Ar digital", "Vidros elétricos", "Travas elétricas", "Alarme", "Sensor de estacionamento", "Câmera de ré", "Bancos de couro", "Airbag duplo", "ABS", "Piloto automático", "Rodas de liga leve", "Teto solar", "Faróis de LED", "Retrovisores elétricos", "Computador de bordo", "Entrada USB", "Item personalizado do anúncio"],
};
function accessoriesFor(model: string) {
  const key = /civic/i.test(model) ? "civic" : /hr-?v/i.test(model) ? "hrv" : null;
  return key ? ACCESSORIES[key] : [];
}
async function seed() {
const prisma = new PrismaClient();
try {
  // Perfil fictício para conferir o sameAs sem exibir nota/selo na home.
  const google = { googleRating: 4.9, googleReviewCount: 127, googleProfileUrl: "https://maps.google.com/?cid=1234567890" };
  await prisma.siteSettings.upsert({ where: { id: "default" }, create: { id: "default", ...google }, update: google });
  for (const [index, item] of SEED_TESTIMONIALS.entries()) {
    const id = `ce2etestimonial${index}`;
    const data = { ...item, published: true };
    await prisma.testimonial.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  for (const sample of samples) {
    const { photos, ...publicFields } = sample;
    const data = { ...publicFields, accessories: accessoriesFor(sample.model), year: sample.yearModel, status: "disponivel", featured: true, historical: false };
    await prisma.vehicle.upsert({ where: { id: sample.id }, create: data, update: data });
    await prisma.photo.deleteMany({ where: { vehicleId: sample.id } });
    await prisma.photo.createMany({ data: photos.map((photo, order) => ({ ...photo, vehicleId: sample.id, order })) });
  }
  const soldId = "ce2esold000000000000000001";
  const { photos, ...civic } = samples[0];
  const sold = { ...civic, accessories: [], id: soldId, year: civic.yearModel, status: "vendido", featured: false, historical: false };
  await prisma.vehicle.upsert({ where: { id: soldId }, create: sold, update: sold });
  await prisma.photo.deleteMany({ where: { vehicleId: soldId } });
  await prisma.photo.createMany({ data: photos.map((photo, order) => ({ ...photo, vehicleId: soldId, order })) });
  // Modelo com histórico, sem estoque disponível, para o pedido contextual.
  const soldOnly = { ...sold, id: "ce2esoldfit000000000000001", model: "Fit", version: null, price: 54321 };
  await prisma.vehicle.upsert({ where: { id: soldOnly.id }, create: soldOnly, update: soldOnly });
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
