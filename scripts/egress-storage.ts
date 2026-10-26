/**
 * Reduz egress do bucket `veiculos` (Supabase Storage):
 * - regrava com cacheControl de 1 ano os objetos que estão com outro valor;
 * - recomprime JPEG grandes, mantendo o MESMO path (a URL salva no banco não muda).
 *
 *   npx tsx --env-file=.env scripts/egress-storage.ts --dry-run --report=~/logs/egress-dryrun.txt
 *   npx tsx --env-file=.env scripts/egress-storage.ts --apply
 *
 * --dry-run: só lista metadados. Não baixa nem escreve nada (o download é o que gasta egress).
 * --apply:   antes de regravar, baixa cada alvo para <backup-dir>/<AAAA-MM-DDTHH-MM-SS>/
 *            e grava manifest.jsonl com o cacheControl/tamanho originais.
 *            Sem --dry-run nem --apply o script não faz nada.
 *
 * Opções: --bucket=veiculos --min-jpeg-kb=100 --quality=80 --backup-dir=~/bak-storage-egress
 * Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (o script nunca imprime as chaves).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const ONE_YEAR = 31536000;
const LIST_PAGE = 1000;

const dryRun = process.argv.includes("--dry-run");
const apply = process.argv.includes("--apply");
if (dryRun === apply) {
  throw new Error("Escolha exatamente um modo: --dry-run ou --apply.");
}

function arg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function expandHome(value: string) {
  return value.startsWith("~/") ? path.join(homedir(), value.slice(2)) : value;
}

const bucket = arg("bucket") || "veiculos";
const minJpegBytes = Number(arg("min-jpeg-kb") || 100) * 1024;
const quality = Number(arg("quality") || 80);
const backupRoot = expandHome(arg("backup-dir") || "~/bak-storage-egress");
const reportPath = arg("report") ? expandHome(arg("report")!) : null;

type StorageObject = { path: string; size: number; mimetype: string; cacheControl: string };
type PlanItem = StorageObject & { recompress: boolean };

const out: string[] = [];
function log(line = "") {
  out.push(line);
  console.log(line);
}

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isOneYear(cacheControl: string) {
  const maxAge = cacheControl.match(/max-age=(\d+)/);
  return Number(maxAge ? maxAge[1] : cacheControl) === ONE_YEAR;
}

function isJpeg(obj: StorageObject) {
  return obj.mimetype === "image/jpeg" || /\.jpe?g$/i.test(obj.path);
}

async function listAll(supabase: SupabaseClient, prefix = ""): Promise<StorageObject[]> {
  const objects: StorageObject[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: LIST_PAGE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Falha ao listar "${prefix || "/"}": ${error.message}`);
    if (!data?.length) break;

    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      // Pasta no Storage vem sem id: desce recursivamente.
      if (!item.id) {
        objects.push(...(await listAll(supabase, full)));
        continue;
      }
      objects.push({
        path: full,
        size: Number(item.metadata?.size ?? 0),
        mimetype: String(item.metadata?.mimetype ?? ""),
        cacheControl: String(item.metadata?.cacheControl ?? ""),
      });
    }

    if (data.length < LIST_PAGE) break;
    offset += data.length;
  }
  return objects;
}

// Paths já recomprimidos em rodadas anteriores (manifest.jsonl). Evita recomprimir de novo.
async function loadRecompressed(): Promise<Set<string>> {
  const done = new Set<string>();
  const runs = await readdir(backupRoot).catch(() => []);
  for (const run of runs) {
    const manifest = await readFile(path.join(backupRoot, run, "manifest.jsonl"), "utf8").catch(() => "");
    for (const line of manifest.split("\n").filter(Boolean)) {
      const entry = JSON.parse(line) as { path: string; recompress: boolean };
      if (entry.recompress) done.add(entry.path);
    }
  }
  return done;
}

function buildPlan(objects: StorageObject[], recompressed: Set<string>): PlanItem[] {
  const plan: PlanItem[] = [];
  for (const obj of objects) {
    const recompress = isJpeg(obj) && obj.size >= minJpegBytes && !recompressed.has(obj.path);
    if (recompress || !isOneYear(obj.cacheControl)) plan.push({ ...obj, recompress });
  }
  return plan;
}

async function dryRunReport(supabase: SupabaseClient, objects: StorageObject[], plan: PlanItem[]) {
  const totalBytes = objects.reduce((sum, obj) => sum + obj.size, 0);
  const cacheValues = new Map<string, number>();
  for (const obj of objects) {
    cacheValues.set(obj.cacheControl || "(vazio)", (cacheValues.get(obj.cacheControl || "(vazio)") ?? 0) + 1);
  }
  const jpegs = objects.filter(isJpeg);
  const bigJpegs = objects.filter((obj) => isJpeg(obj) && obj.size >= minJpegBytes);
  const wrongCache = objects.filter((obj) => !isOneYear(obj.cacheControl));
  const downloadBytes = plan.reduce((sum, item) => sum + item.size, 0);

  log(`Bucket: ${bucket}`);
  log(`Objetos: ${objects.length} (${mb(totalBytes)})`);
  log(`cacheControl atual (valor: quantidade):`);
  for (const [value, count] of [...cacheValues.entries()].sort((a, b) => b[1] - a[1])) {
    log(`  ${value}: ${count}`);
  }
  if (objects.length > 0 && cacheValues.size === 1 && cacheValues.has("(vazio)")) {
    log("AVISO: o list() não trouxe cacheControl. Não confie no relatório; confira com info() antes do --apply.");
  }
  log(`Fora de 1 ano: ${wrongCache.length} (${mb(wrongCache.reduce((s, o) => s + o.size, 0))})`);
  log(`JPEG: ${jpegs.length} (${mb(jpegs.reduce((s, o) => s + o.size, 0))}); >= ${minJpegBytes / 1024} KB: ${bigJpegs.length}`);
  log("");
  log(`Alvos a regravar: ${plan.length}`);
  log(`Download estimado (egress do --apply, feito uma vez por alvo): ${mb(downloadBytes)}`);
  log(`Backup local (se --apply): ${backupRoot}/<timestamp>/`);
  log("");
  log("path | KB | cacheControl atual | mimetype | recomprimir");
  for (const item of plan) {
    log(
      `${item.path} | ${(item.size / 1024).toFixed(1)} | ${item.cacheControl || "(vazio)"} | ${item.mimetype || "-"} | ${item.recompress ? "sim" : "não"}`,
    );
  }

  // Confere se o metadado do list() bate com info() em uma amostra (não baixa o arquivo).
  const sample = objects.slice(0, 3);
  log("");
  log("Conferência list() x info() (amostra de 3):");
  for (const obj of sample) {
    const { data, error } = await supabase.storage.from(bucket).info(obj.path);
    if (error || !data) {
      log(`  ${obj.path}: info() falhou (${error?.message ?? "sem dados"})`);
      continue;
    }
    const infoCache = String(data.metadata?.cacheControl ?? "");
    log(`  ${obj.path}: list="${obj.cacheControl}" info="${infoCache}" ${infoCache === obj.cacheControl ? "OK" : "DIVERGE"}`);
  }
}

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function applyPlan(supabase: SupabaseClient, plan: PlanItem[]) {
  if (plan.length === 0) {
    log("Nada a regravar.");
    return;
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const runDir = path.join(backupRoot, stamp);
  const manifest = path.join(runDir, "manifest.jsonl");
  await mkdir(runDir, { recursive: true });

  let done = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const item of plan) {
    if (item.path.split("/").includes("..")) {
      failures.push(`${item.path}: caminho inválido`);
      continue;
    }

    // Revalida no próprio objeto: o list() pode estar desatualizado.
    const { data: current, error: infoError } = await supabase.storage.from(bucket).info(item.path);
    if (infoError || !current) {
      failures.push(`${item.path}: info() falhou (${infoError?.message ?? "sem dados"})`);
      continue;
    }
    const currentCache = String(current.metadata?.cacheControl ?? "");
    if (!item.recompress && isOneYear(currentCache)) {
      skipped += 1;
      continue;
    }

    const { data: blob, error: downloadError } = await supabase.storage.from(bucket).download(item.path);
    if (downloadError || !blob) {
      failures.push(`${item.path}: download falhou (${downloadError?.message ?? "sem dados"})`);
      continue;
    }
    const original = Buffer.from(await blob.arrayBuffer());

    // Backup antes de qualquer escrita remota. flag "wx" nunca sobrescreve um backup existente.
    const backupFile = path.join(runDir, item.path);
    await mkdir(path.dirname(backupFile), { recursive: true });
    await writeFile(backupFile, original, { flag: "wx" });

    let body = original;
    if (item.recompress) {
      // rotate() aplica a orientação do EXIF e remove metadados (inclusive GPS).
      const smaller = await sharp(original).rotate().jpeg({ quality, mozjpeg: true }).toBuffer();
      if (smaller.length < original.length) body = smaller;
    }

    const { error: uploadError } = await supabase.storage.from(bucket).upload(item.path, body, {
      contentType: item.mimetype || (isJpeg(item) ? "image/jpeg" : "application/octet-stream"),
      cacheControl: String(ONE_YEAR),
      upsert: true,
    });
    if (uploadError) {
      failures.push(`${item.path}: upload falhou (${uploadError.message})`);
      continue;
    }

    await appendFile(
      manifest,
      `${JSON.stringify({
        path: item.path,
        cacheControlAntes: currentCache,
        sizeAntes: original.length,
        sizeDepois: body.length,
        recompress: item.recompress,
        recomprimido: body !== original,
      })}\n`,
    );
    done += 1;
  }

  log("");
  log(`Backup e manifest: ${runDir}`);
  log(`Regravados: ${done} | já estavam ok: ${skipped} | falhas: ${failures.length}`);
  for (const failure of failures) log(`FALHA ${failure}`);
}

async function main() {
  const supabase = getClient();
  const objects = await listAll(supabase);
  const plan = buildPlan(objects, await loadRecompressed());

  if (dryRun) {
    await dryRunReport(supabase, objects, plan);
  } else {
    log(`Modo --apply: ${plan.length} alvo(s) de ${objects.length} objeto(s).`);
    await applyPlan(supabase, plan);
  }

  if (reportPath) {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${out.join("\n")}\n`);
    console.log(`Relatório salvo em ${reportPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
