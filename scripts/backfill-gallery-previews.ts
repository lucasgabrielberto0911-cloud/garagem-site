/** Default is read-only. Run in batches, never from a build/deploy. */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PrismaClient } from "@prisma/client";
import { backfillLegacyGallery, legacyGalleryPlan, type LegacyGalleryReceipt } from "../src/lib/legacy-gallery-preview";
import { getSupabaseAdmin, VEHICLE_PHOTOS_BUCKET } from "../src/lib/supabase";

const args = process.argv.slice(2);
function option(name: string) { return args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3); }
const apply = args.includes("--apply");
const limit = Number(option("limit") ?? "20");
if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Use um lote de 1 a 100 fotos.");
if (args.some(arg => !/^--(?:apply|dry-run)$|^--(?:limit|after|report|rollback)=.+$/.test(arg))) throw new Error("Opção desconhecida.");
if (apply && args.includes("--dry-run")) throw new Error("Escolha --apply ou --dry-run.");

async function main() {
  const prisma = new PrismaClient();
  try {
    const rollback = option("rollback");
    if (rollback) {
      const receipts = (await readFile(rollback, "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line) as LegacyGalleryReceipt);
      // Validate the whole report before the first database write.
      for (const row of receipts) if (!row.id || !row.vehicleId || legacyGalleryPlan(row.url)?.galleryUrl !== row.nextUrl) throw new Error("Relatório de recuperação inválido.");
      let restored = 0;
      for (const row of receipts) {
        if (apply) restored += (await prisma.photo.updateMany({ where: { id: row.id, vehicleId: row.vehicleId, url: row.nextUrl }, data: { url: row.url } })).count;
      }
      console.log({ mode: apply ? "rollback" : "dry-run rollback", records: receipts.length, restored });
      return;
    }
    const photos = await prisma.photo.findMany({
      where: { vehicle: { status: "disponivel", historical: false }, ...(option("after") ? { id: { gt: option("after") } } : {}),
        NOT: ["webp", "jpg", "jpeg", "png"].map(ext => ({ url: { endsWith: `-g800.${ext}` } })) },
      orderBy: { id: "asc" }, take: limit, select: { id: true, vehicleId: true, url: true },
    });
    if (!apply) {
      console.log({ mode: "dry-run", scanned: photos.length, eligible: photos.filter(photo => legacyGalleryPlan(photo.url)).length, after: photos.at(-1)?.id ?? null });
      return;
    }
    const storage = getSupabaseAdmin().storage.from(VEHICLE_PHOTOS_BUCKET);
    const report = option("report") ?? `artifacts/gallery-preview-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
    await mkdir(dirname(report), { recursive: true });
    async function read(path: string) {
      const { data, error } = await storage.download(path);
      if (error || !data) throw new Error("Não foi possível ler a foto no Storage.");
      return Buffer.from(await data.arrayBuffer());
    }
    let updated = 0, failed = 0, skipped = 0;
    for (const photo of photos) {
      try {
        const result = await backfillLegacyGallery(photo, {
          read,
          put: async (path, bytes, type) => {
            const { error } = await storage.upload(path, bytes, { contentType: type, cacheControl: "31536000", upsert: false });
            if (!error) return;
            if (/already exists|duplicate/i.test(error.message) && (await read(path)).equals(bytes)) return;
            throw new Error("Falha ou conteúdo diferente no destino imutável.");
          },
          replace: async (id, expectedUrl, nextUrl) => (await prisma.photo.updateMany({ where: { id, vehicleId: photo.vehicleId, url: expectedUrl }, data: { url: nextUrl } })).count === 1,
          journal: receipt => appendFile(report, JSON.stringify(receipt) + "\n"),
        });
        if (result.status === "updated") updated++; else skipped++;
        console.log({ id: photo.id, status: result.status });
      } catch { failed++; console.error({ id: photo.id, status: "failed", message: "Foto mantida como estava; conferir o lote antes de continuar." }); }
    }
    console.log({ mode: "apply", updated, skipped, failed, report, after: photos.at(-1)?.id ?? null });
    if (failed) process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error("Não foi possível concluir o lote. Confira conexão, credenciais e relatório."); process.exitCode = 1; });
