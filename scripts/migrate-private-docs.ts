/**
 * Copia comprovantes/documentos públicos do bucket `veiculos` para o bucket
 * privado `documentos` e atualiza as URLs no banco.
 *
 *   npx tsx scripts/migrate-private-docs.ts --dry-run
 *   npx tsx scripts/migrate-private-docs.ts
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const PHOTOS_BUCKET = "veiculos";
const DOCS_BUCKET = "documentos";
const PREFIX = "private://documentos/";

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function storagePathFromPublicUrl(url: string) {
  const marker = `/storage/v1/object/public/${PHOTOS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

function isPrivate(url: string | null | undefined) {
  return Boolean(url?.startsWith(PREFIX));
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((bucket) => bucket.name === DOCS_BUCKET)) {
    if (dryRun) {
      console.log("[dry-run] bucket `documentos` ainda não existe.");
    } else {
      const { error } = await supabase.storage.createBucket(DOCS_BUCKET, {
        public: false,
        fileSizeLimit: 12 * 1024 * 1024,
      });
      if (error && !/already exists|duplicate|exists/i.test(error.message)) {
        throw new Error(
          `Crie o bucket privado \`documentos\` no Supabase. (${error.message})`,
        );
      }
    }
  }

  const [documents, costs] = await Promise.all([
    prisma.vehicleDocument.findMany({
      select: { id: true, fileUrl: true, vehicleId: true },
    }),
    prisma.vehicleCost.findMany({
      select: { id: true, receiptUrl: true, vehicleId: true },
    }),
  ]);

  type Job = {
    kind: "doc" | "cost";
    id: string;
    url: string;
    vehicleId: string;
  };

  const jobs: Job[] = [
    ...documents
      .filter((row) => row.fileUrl && !isPrivate(row.fileUrl))
      .map((row) => ({
        kind: "doc" as const,
        id: row.id,
        url: row.fileUrl,
        vehicleId: row.vehicleId,
      })),
    ...costs
      .filter((row) => row.receiptUrl && !isPrivate(row.receiptUrl))
      .map((row) => ({
        kind: "cost" as const,
        id: row.id,
        url: row.receiptUrl as string,
        vehicleId: row.vehicleId,
      })),
  ];

  console.log(
    `${dryRun ? "[dry-run] " : ""}${jobs.length} arquivo(s) públicos para migrar.`,
  );

  let done = 0;
  let skipped = 0;

  for (const job of jobs) {
    const sourcePath = storagePathFromPublicUrl(job.url);
    if (!sourcePath) {
      skipped += 1;
      console.warn(`- skip ${job.kind} ${job.id}: URL fora do Storage`);
      continue;
    }

    const destPath = `${job.vehicleId}/${sourcePath.split("/").pop() || sourcePath}`;
    if (dryRun) {
      console.log(`- ${job.kind} ${job.id}: ${sourcePath} → ${destPath}`);
      done += 1;
      continue;
    }

    const download = await supabase.storage.from(PHOTOS_BUCKET).download(sourcePath);
    if (download.error || !download.data) {
      skipped += 1;
      console.warn(`- skip ${job.kind} ${job.id}: ${download.error?.message}`);
      continue;
    }

    const buffer = Buffer.from(await download.data.arrayBuffer());
    const contentType = download.data.type || "application/octet-stream";
    const upload = await supabase.storage.from(DOCS_BUCKET).upload(destPath, buffer, {
      contentType,
      upsert: true,
    });
    if (upload.error) {
      skipped += 1;
      console.warn(`- skip ${job.kind} ${job.id}: ${upload.error.message}`);
      continue;
    }

    const nextUrl = `${PREFIX}${destPath}`;
    if (job.kind === "doc") {
      await prisma.vehicleDocument.update({
        where: { id: job.id },
        data: { fileUrl: nextUrl },
      });
    } else {
      await prisma.vehicleCost.update({
        where: { id: job.id },
        data: { receiptUrl: nextUrl },
      });
    }
    done += 1;
    console.log(`- ok ${job.kind} ${job.id}`);
  }

  console.log(`Concluído: ${done} migrado(s), ${skipped} ignorado(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
