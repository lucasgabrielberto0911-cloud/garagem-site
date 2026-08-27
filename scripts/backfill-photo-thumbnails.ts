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
import { cardObjectPath, encodeCardImage } from "../src/lib/image-variants";

const prisma = new PrismaClient();

function arg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function storagePathFromPublicUrl(url: string, bucket = "veiculos") {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const limit = Math.max(1, Number(arg("limit") || 80) || 80);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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
    const sourcePath = storagePathFromPublicUrl(photo.url);
    if (!sourcePath) {
      skipped += 1;
      console.warn(`- skip ${photo.id}: URL fora do Storage`);
      continue;
    }

    if (dryRun) {
      console.log(`- geraria capa para ${photo.id} ← ${sourcePath}`);
      done += 1;
      continue;
    }

    const download = await fetch(photo.url);
    if (!download.ok) {
      skipped += 1;
      console.warn(`- skip ${photo.id}: download ${download.status}`);
      continue;
    }

    const original = Buffer.from(await download.arrayBuffer());
    const card = await encodeCardImage(original);
    const cardPath = cardObjectPath(sourcePath);

    const { error } = await supabase.storage
      .from("veiculos")
      .upload(cardPath, card.buffer, {
        contentType: card.contentType,
        upsert: true,
        cacheControl: "31536000",
      });

    if (error) {
      skipped += 1;
      console.warn(`- skip ${photo.id}: ${error.message}`);
      continue;
    }

    const { data } = supabase.storage.from("veiculos").getPublicUrl(cardPath);
    await prisma.photo.update({
      where: { id: photo.id },
      data: { thumbnailUrl: data.publicUrl },
    });
    done += 1;
    console.log(`- ok ${photo.id} (${card.buffer.length} bytes)`);
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
