import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_NAME,
  DEFAULT_ADMIN_PASSWORD,
} from "../src/lib/secrets";

const prisma = new PrismaClient();

async function main() {
  const seedPassword =
    process.env.SEED_ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD;
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  const admin = await prisma.admin.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    // Não sobrescreve a senha em re-seeds.
    update: {
      name: DEFAULT_ADMIN_NAME,
    },
    create: {
      name: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
    },
  });

  await prisma.sale.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.vehicle.deleteMany();

  const vehicles = await Promise.all([
    prisma.vehicle.create({
      data: {
        category: "carro",
        brand: "Volkswagen",
        model: "Golf",
        version: "GTI 2.0 TSI",
        year: 2020,
        yearModel: 2021,
        km: 42000,
        price: 149900,
        fuel: "Gasolina",
        transmission: "Automático",
        color: "Preto",
        description: "Golf GTI impecável, único dono, revisões em dia.",
        accessories: [
          "Multimídia",
          "Bluetooth",
          "Ar digital",
          "Bancos de couro",
          "Piloto automático",
          "Sensor de estacionamento",
          "Câmera de ré",
          "Único dono",
        ],
        status: "disponivel",
        featured: true,
        photos: {
          create: [
            { url: "/branding/placeholder-car.png", order: 0 },
            { url: "/branding/placeholder-car.png", order: 1 },
          ],
        },
      },
    }),
    prisma.vehicle.create({
      data: {
        category: "carro",
        brand: "Toyota",
        model: "Corolla",
        version: "XEi 2.0",
        year: 2022,
        yearModel: 2022,
        km: 28000,
        price: 139900,
        fuel: "Flex",
        transmission: "Automático",
        color: "Prata",
        description: "Corolla XEi completo, baixo km, pronto para transferir.",
        accessories: [
          "Multimídia",
          "Bluetooth",
          "Ar-condicionado",
          "Apple CarPlay / Android Auto",
          "Bancos de couro",
          "Keyless (partida por botão)",
        ],
        status: "disponivel",
        featured: true,
        photos: {
          create: [{ url: "/branding/placeholder-car.png", order: 0 }],
        },
      },
    }),
    prisma.vehicle.create({
      data: {
        category: "carro",
        brand: "Jeep",
        model: "Compass",
        version: "Longitude 2.0",
        year: 2021,
        yearModel: 2021,
        km: 51000,
        price: 159900,
        fuel: "Flex",
        transmission: "Automático",
        color: "Branco",
        description: "Compass Longitude, banco de couro, multimídia.",
        accessories: [
          "Multimídia",
          "Bluetooth",
          "Ar digital",
          "Bancos de couro",
          "Sensor de estacionamento",
          "Câmera de ré",
          "Rodas de liga leve",
        ],
        status: "disponivel",
        featured: false,
        photos: {
          create: [
            { url: "/branding/placeholder-car.png", order: 0 },
            { url: "/branding/placeholder-car.png", order: 1 },
          ],
        },
      },
    }),
    prisma.vehicle.create({
      data: {
        category: "carro",
        brand: "Honda",
        model: "Civic",
        version: "EXL 2.0",
        year: 2019,
        yearModel: 2019,
        km: 67000,
        price: 124900,
        fuel: "Flex",
        transmission: "CVT",
        color: "Cinza",
        description: "Civic EXL, histórico completo, pneus novos.",
        accessories: [
          "Multimídia",
          "Bluetooth",
          "Ar-condicionado",
          "Bancos de couro",
          "Volante multifuncional",
          "Pneus novos",
        ],
        status: "disponivel",
        featured: false,
        photos: {
          create: [{ url: "/branding/placeholder-car.png", order: 0 }],
        },
      },
    }),
    prisma.vehicle.create({
      data: {
        category: "moto",
        brand: "Honda",
        model: "CB 500F",
        version: "ABS",
        year: 2022,
        yearModel: 2022,
        km: 12000,
        price: 34900,
        fuel: "Gasolina",
        transmission: "Manual",
        color: "Vermelha",
        description: "CB 500F ABS, baixa km, revisões em dia.",
        accessories: [
          "ABS",
          "Freio a disco (dianteiro e traseiro)",
          "Injeção eletrônica",
          "Partida elétrica",
          "Painel digital",
          "Farol de LED",
          "Bauleto",
          "Pneus novos",
        ],
        status: "disponivel",
        featured: true,
        photos: {
          create: [{ url: "/branding/placeholder-car.png", order: 0 }],
        },
      },
    }),
  ]);

  console.log(`Admin: ${admin.email} / senha padrão: ${DEFAULT_ADMIN_PASSWORD}`);
  console.log(`${vehicles.length} veículos de exemplo criados.`);

  const { SEED_TESTIMONIALS } = await import("../src/lib/testimonials-seed");
  const existingTestimonials = await prisma.testimonial.count();
  if (existingTestimonials === 0) {
    await prisma.testimonial.createMany({
      data: SEED_TESTIMONIALS.map((item) => ({
        name: item.name,
        city: item.city,
        message: item.message,
        rating: item.rating,
        vehicleLabel: item.vehicleLabel ?? null,
        order: item.order,
        published: true,
      })),
    });
    console.log(`${SEED_TESTIMONIALS.length} depoimentos de exemplo criados.`);
  }

  await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      region: "Aracruz, Vitória, Linhares",
      email: "suagaragem2@gmail.com",
      address: "Loja digital — atendimento online",
      hours: "Todos os dias, 8h às 23h (online)",
      hoursWeekdays: "08:00 – 23:00",
      hoursSaturday: "08:00 – 23:00",
    },
    update: {
      region: "Aracruz, Vitória, Linhares",
      email: "suagaragem2@gmail.com",
      address: "Loja digital — atendimento online",
      hours: "Todos os dias, 8h às 23h (online)",
      hoursWeekdays: "08:00 – 23:00",
      hoursSaturday: "08:00 – 23:00",
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
