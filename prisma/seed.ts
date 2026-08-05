import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * A senha padrão do seed NÃO deve ser commitada. Defina SEED_ADMIN_PASSWORD
 * no ambiente. Se não houver, o upsert cria o admin só na primeira vez com
 * um valor temporário e o painel avisa para trocar.
 */
const DEFAULT_WEAK_PASSWORD = "troque-esta-senha";

async function main() {
  const seedPassword =
    process.env.SEED_ADMIN_PASSWORD?.trim() || DEFAULT_WEAK_PASSWORD;
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  const admin = await prisma.admin.upsert({
    where: { email: "admin@loja.com" },
    // Não sobrescreve a senha em re-seeds — evita resetar a senha de produção
    // toda vez que alguém roda `npm run db:seed`.
    update: {
      name: "Administrador",
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
        year: 2020,
        yearModel: 2021,
        km: 42000,
        price: 149900,
        fuel: "Gasolina",
        transmission: "Automático",
        color: "Preto",
        description: "Golf GTI impecável, único dono, revisões em dia.",
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
        status: "disponivel",
        featured: true,
        photos: {
          create: [{ url: "/branding/placeholder-car.png", order: 0 }],
        },
      },
    }),
    prisma.vehicle.create({
      data: {
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
        status: "disponivel",
        featured: false,
        photos: {
          create: [{ url: "/branding/placeholder-car.png", order: 0 }],
        },
      },
    }),
  ]);

  console.log(`Admin: ${admin.email}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(
      `Senha temporária: ${DEFAULT_WEAK_PASSWORD} (defina SEED_ADMIN_PASSWORD para personalizar)`,
    );
  }
  console.log(`${vehicles.length} veículos de exemplo criados.`);

  const { SEED_TESTIMONIALS } = await import("../src/lib/testimonials-seed");
  const existingTestimonials = await prisma.testimonial.count();
  if (existingTestimonials === 0) {
    await prisma.testimonial.createMany({
      data: SEED_TESTIMONIALS.map((item) => ({
        name: item.name,
        city: item.city,
        message: item.message,
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
      region: "Vitória, Linhares",
      email: "suagaragem2@gmail.com",
      address: "Loja digital — atendimento online",
      hours: "Todos os dias, 8h às 23h (online)",
      hoursWeekdays: "08:00 – 23:00",
      hoursSaturday: "08:00 – 23:00",
    },
    update: {
      region: "Vitória, Linhares",
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
