/**
 * Gera miniaturas 480×300 WebP para fotos que ainda não têm thumbnailUrl.
 *
 *   npx tsx scripts/backfill-photo-thumbnails.ts --dry-run
 *   npx tsx scripts/backfill-photo-thumbnails.ts --limit=20
 *   npx tsx scripts/backfill-photo-thumbnails.ts
 *
 * Requer DATABASE_URL / DIRECT_URL e credenciais do Supabase.
 */
import { PrismaClient } from "@prisma/client";
import { storeCardThumbnail } from "../src/lib/photo-thumbnails";

const prisma = new PrismaClient();

function arg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const limit = Math.max(1, Number(arg("limit") || 80) || 80);

  const photos = await prisma.photo.findMany({
    where: { OR: [{ thumbnailUrl: null }, { thumbnailUrl: "" }] },
    orderBy: { order: "asc" },
    take: limit,
    select: { id: true, url: true, vehicleId: true },
  });

  console.log(
    `${dryRun ? "[dry-run] " : ""}${photos.length} foto(s) sem miniatura (limite ${limit}).`,
  );

  let done = 0;
  let skipped = 0;

  for (const photo of photos) {
    if (dryRun) {
      console.log(`- geraria capa para ${photo.id}`);
      done += 1;
      continue;
    }

    const result = await storeCardThumbnail(photo.url);
    if (!result.ok) {
      skipped += 1;
      console.warn(`- skip ${photo.id}: ${result.error}`);
      continue;
    }

    await prisma.photo.update({
      where: { id: photo.id },
      data: { thumbnailUrl: result.thumbnailUrl },
    });
    done += 1;
    console.log(`- ok ${photo.id}`);
  }

  console.log(`Concluído: ${done} processada(s), ${skipped} ignorada(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
