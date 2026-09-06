/**
 * Cria/atualiza anúncios no banco live e sobe fotos no bucket público
 * `veiculos`, no mesmo pipeline do admin (`/api/upload`):
 * HEIC→JPEG se preciso, blur de placa (Rekognition), galeria WebP 1280
 * e capa 480×300.
 *
 *   npx tsx scripts/import-stock-vehicle.ts
 *   npx tsx scripts/import-stock-vehicle.ts --dry-run
 *   npx tsx scripts/import-stock-vehicle.ts --photos-only
 *
 * Pastas de foto (primeira imagem = capa):
 *   ./prisma-photos
 *   ./palio-weekend-photos
 *
 * Requer DATABASE_URL e credenciais do Supabase (service role).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { blurDetectedPlates } from "../src/lib/blur-plates";
import {
  cardObjectPath,
  encodeCardImage,
  encodeGalleryImage,
} from "../src/lib/image-variants";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
} from "../src/lib/supabase";
import { vehiclePath } from "../src/lib/vehicle-slug";

const prisma = new PrismaClient();

const PHOTO_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]);

type IntakePhoto = { url: string; thumbnailUrl: string | null };

type IntakeVehicle = {
  key: string;
  photoDir: string;
  brand: string;
  model: string;
  version: string;
  year: number;
  yearModel: number;
  km: number;
  price: number;
  transmission: string;
  fuel: string;
  color: string;
  category: "carro";
  status: "disponivel";
  featured: false;
  engine: string;
  doors: number;
  accessories: string[];
  description: string;
};

const INTAKE: IntakeVehicle[] = [
  {
    key: "chevrolet-prisma-2019",
    photoDir: "prisma-photos",
    brand: "Chevrolet",
    model: "Prisma",
    version: "Sed. Joy/LS 1.0 8V FlexPower 4p",
    year: 2018,
    yearModel: 2019,
    km: 152000,
    price: 52900,
    transmission: "Manual",
    fuel: "Flex",
    color: "Prata",
    category: "carro",
    status: "disponivel",
    featured: false,
    engine: "1.0 8V FlexPower",
    doors: 4,
    accessories: [
      "Ar-condicionado",
      "Direção hidráulica",
      "Vidros elétricos",
      "Travas elétricas",
      "Airbag duplo",
      "ABS",
      "Bluetooth",
    ],
    description: [
      "🔥 NOVIDADE NO ESTOQUE DA GARAGEM!",
      "",
      "🚗 Chevrolet Prisma Joy/LS 1.0 8V FlexPower — 2018/2019",
      "",
      "💲 Valor: R$ 52.900",
      "",
      "Sedã compacto econômico, motor 1.0 FlexPower e câmbio manual — pronto pro dia a dia!",
      "",
      "📊 Quilometragem: 152.000 km",
      "📅 Ano: 2018/2019",
      "🎨 Cor: Prata",
      "⚙️ Câmbio: Manual",
      "⛽ Combustível: Flex",
      "🛠️ Motor: 1.0 8V FlexPower",
    ].join("\n"),
  },
  {
    key: "fiat-palio-weekend-adventure-2016",
    photoDir: "palio-weekend-photos",
    brand: "Fiat",
    model: "Palio Weekend",
    version: "Adventure 1.8 Flex 16V",
    year: 2016,
    yearModel: 2016,
    km: 156400,
    price: 47900,
    transmission: "Manual",
    fuel: "Flex",
    color: "Branca",
    category: "carro",
    status: "disponivel",
    featured: false,
    engine: "1.8 16V Flex",
    doors: 4,
    accessories: [
      "Ar-condicionado",
      "Direção hidráulica",
      "Vidros elétricos",
      "Travas elétricas",
      "Volante multifuncional",
      "Rodas de liga leve",
      "Airbag duplo",
      "ABS",
      "Bluetooth",
    ],
    description: [
      "🔥 NOVIDADE NO ESTOQUE DA GARAGEM!",
      "",
      "🚗 Fiat Palio Weekend Adventure 1.8 Flex 16V — 2016",
      "",
      "💲 Valor: R$ 47.900",
      "",
      "Perua Adventure com visual off-road, motor 1.8 e câmbio manual — espaço e robustez pro dia a dia!",
      "",
      "📊 Quilometragem: 156.400 km",
      "📅 Ano: 2016",
      "🎨 Cor: Branca",
      "⚙️ Câmbio: Manual",
      "⛽ Combustível: Flex",
      "🛠️ Motor: 1.8 16V Flex",
    ].join("\n"),
  },
];

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function listPhotoFiles(dir: string) {
  const absolute = path.resolve(process.cwd(), dir);
  try {
    const entries = await readdir(absolute, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => PHOTO_EXTS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => path.join(absolute, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function uploadPublicObject(objectPath: string, buffer: Buffer, contentType: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).upload(objectPath, buffer, {
    contentType,
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(VEHICLE_PHOTOS_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function uploadPhotoFile(filePath: string): Promise<IntakePhoto> {
  const raw = await readFile(filePath);
  const withPlatesBlurred = await blurDetectedPlates(raw);
  const [gallery, card] = await Promise.all([
    encodeGalleryImage(withPlatesBlurred),
    encodeCardImage(withPlatesBlurred),
  ]);

  const id = `${Date.now()}-${crypto.randomUUID()}`;
  const galleryPath = `${id}.${gallery.extension}`;
  const cardPath = cardObjectPath(galleryPath);
  const [url, thumbnailUrl] = await Promise.all([
    uploadPublicObject(galleryPath, gallery.buffer, gallery.contentType),
    uploadPublicObject(cardPath, card.buffer, card.contentType),
  ]);
  return { url, thumbnailUrl };
}

async function findExisting(item: IntakeVehicle) {
  return prisma.vehicle.findFirst({
    where: {
      brand: { equals: item.brand, mode: "insensitive" },
      model: { equals: item.model, mode: "insensitive" },
      yearModel: item.yearModel,
      km: item.km,
      historical: false,
      status: { not: "vendido" },
    },
    include: { photos: { orderBy: { order: "asc" } } },
  });
}

function vehicleFields(item: IntakeVehicle) {
  return {
    category: item.category,
    brand: item.brand,
    model: item.model,
    version: item.version,
    year: item.year,
    yearModel: item.yearModel,
    km: item.km,
    price: item.price,
    fuel: item.fuel,
    transmission: item.transmission,
    color: item.color,
    description: item.description,
    engine: item.engine,
    doors: item.doors,
    accessories: item.accessories,
    status: item.status,
    featured: item.featured,
  };
}

async function replacePhotos(vehicleId: string, photos: IntakePhoto[]) {
  await prisma.$transaction([
    prisma.photo.deleteMany({ where: { vehicleId } }),
    prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        photos: {
          create: photos.map((photo, order) => ({
            url: photo.url,
            thumbnailUrl: photo.thumbnailUrl,
            order,
          })),
        },
      },
    }),
  ]);
}

async function importVehicle(item: IntakeVehicle, opts: { dryRun: boolean; photosOnly: boolean }) {
  const files = await listPhotoFiles(item.photoDir);
  const existing = await findExisting(item);

  console.log(
    `\n[${item.key}] ${item.brand} ${item.model} — ${files.length} foto(s) em ${item.photoDir}` +
      (existing ? ` (já existe ${existing.id})` : " (novo)"),
  );

  if (opts.dryRun) {
    console.log(`- [dry-run] ${existing ? "atualizaria" : "criaria"} o anúncio`);
    if (files.length) console.log(`- [dry-run] subiria ${files.length} foto(s)`);
    return existing;
  }

  let vehicle = existing;
  if (!opts.photosOnly) {
    if (vehicle) {
      vehicle = await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: vehicleFields(item),
        include: { photos: { orderBy: { order: "asc" } } },
      });
      console.log(`- dados atualizados ${vehicle.id}`);
    } else {
      vehicle = await prisma.vehicle.create({
        data: vehicleFields(item),
        include: { photos: { orderBy: { order: "asc" } } },
      });
      console.log(`- criado ${vehicle.id}`);
    }
  }

  if (!vehicle) {
    console.warn("- pulando fotos: anúncio ainda não existe (rode sem --photos-only).");
    return null;
  }

  if (files.length === 0) {
    console.warn(
      `- sem fotos em ${item.photoDir}. Coloque JPG/WebP na pasta e rode com --photos-only.`,
    );
    return vehicle;
  }

  if (!hasSupabaseServiceRole()) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para upload no bucket veiculos.");
  }

  const photos: IntakePhoto[] = [];
  for (const file of files) {
    process.stdout.write(`- upload ${path.basename(file)}… `);
    const uploaded = await uploadPhotoFile(file);
    photos.push(uploaded);
    console.log("ok");
  }

  await replacePhotos(vehicle.id, photos);
  console.log(`- ${photos.length} foto(s) ligadas (capa = ${path.basename(files[0])})`);
  return prisma.vehicle.findUniqueOrThrow({
    where: { id: vehicle.id },
    include: { photos: { orderBy: { order: "asc" } } },
  });
}

async function fixHb20EvolutionPrice(dryRun: boolean) {
  const hb20 = await prisma.vehicle.findFirst({
    where: {
      id: "cmshu67mo0000la04hhc9jp7v",
      brand: { contains: "Hyundai", mode: "insensitive" },
      model: { equals: "HB20", mode: "insensitive" },
      version: { contains: "evolution", mode: "insensitive" },
      status: "disponivel",
    },
  });

  if (!hb20) {
    console.warn("\n[hb20-evolution] anúncio não encontrado — preço não alterado.");
    return;
  }

  if (hb20.price === 64900) {
    console.log(`\n[hb20-evolution] ${hb20.id} já está em R$ 64.900.`);
    return;
  }

  const nextDescription = hb20.description
    ? hb20.description.replace(/67\.?900/g, "64.900")
    : hb20.description;

  console.log(
    `\n[hb20-evolution] ${hb20.id} preço ${hb20.price} → 64900` +
      (dryRun ? " [dry-run]" : ""),
  );

  if (dryRun) return;

  await prisma.vehicle.update({
    where: { id: hb20.id },
    data: {
      price: 64900,
      description: nextDescription,
    },
  });
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const photosOnly = hasFlag("photos-only");

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Falta DATABASE_URL.");
  }

  if (!photosOnly) {
    await fixHb20EvolutionPrice(dryRun);
  }

  const results = [];
  for (const item of INTAKE) {
    const vehicle = await importVehicle(item, { dryRun, photosOnly });
    if (vehicle) results.push({ item, vehicle });
  }

  console.log("\n=== Resultado ===");
  for (const { item, vehicle } of results) {
    const publicPath = vehiclePath(vehicle);
    console.log(
      `${item.brand} ${item.model}: ${vehicle.id} | ${vehicle.photos.length} foto(s) | https://www.suagaragem.net${publicPath}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
