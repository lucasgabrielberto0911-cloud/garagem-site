import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("troque-esta-senha", 10);

  const admin = await prisma.admin.upsert({
    where: { email: "admin@loja.com" },
    update: {
      name: "Administrador",
      passwordHash,
    },
    create: {
      name: "Administrador",
      email: "admin@loja.com",
      passwordHash,
    },
  });

  await prisma.sale.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.vehicle.deleteMany();

  const vehicles = await Promise.all([
    prisma.vehicle.create({
      data: {
        brand: "Volkswagen",
        model: "Golf",
        version: "GTI 2.0 TSI",
        year: 2021,
        yearModel: 2022,
        km: 42000,
        price: 189900,
        fuel: "Gasolina",
        transmission: "Automático",
        color: "Preto",
        description:
          "Golf GTI impecável, único dono, revisões na concessionária.",
        status: "disponivel",
        featured: true,
        photos: {
          create: [
            { url: "/placeholder.png", order: 0 },
            { url: "/placeholder.png", order: 1 },
          ],
        },
      },
    }),
    prisma.vehicle.create({
      data: {
        brand: "Toyota",
        model: "Corolla",
        version: "XEi 2.0",
        year: 2020,
        yearModel: 2020,
        km: 58000,
        price: 124900,
        fuel: "Flex",
        transmission: "Automático",
        color: "Prata",
        description: "Corolla XEi completo, baixo consumo e ótimo estado.",
        status: "disponivel",
        featured: true,
        photos: {
          create: [{ url: "/placeholder.png", order: 0 }],
        },
      },
    }),
    prisma.vehicle.create({
      data: {
        brand: "Jeep",
        model: "Compass",
        version: "Longitude 2.0 Diesel",
        year: 2022,
        yearModel: 2023,
        km: 31000,
        price: 169900,
        fuel: "Diesel",
        transmission: "Automático",
        color: "Branco",
        description: "Compass Longitude 4x4, pacote de segurança completo.",
        status: "disponivel",
        featured: false,
        photos: {
          create: [
            { url: "/placeholder.png", order: 0 },
            { url: "/placeholder.png", order: 1 },
          ],
        },
      },
    }),
    prisma.vehicle.create({
      data: {
        brand: "Honda",
        model: "Civic",
        version: "Touring 1.5 Turbo",
        year: 2019,
        yearModel: 2019,
        km: 67000,
        price: 139900,
        fuel: "Gasolina",
        transmission: "CVT",
        color: "Cinza",
        description: "Civic Touring top de linha, teto solar e bancos em couro.",
        status: "disponivel",
        featured: false,
        photos: {
          create: [{ url: "/placeholder.png", order: 0 }],
        },
      },
    }),
  ]);

  console.log(`Admin criado: ${admin.email}`);
  console.log(`Veículos criados: ${vehicles.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
