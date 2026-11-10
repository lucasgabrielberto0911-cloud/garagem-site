import { prepareGalleryUploadPath } from "./gallery-preview-store";
import { cardObjectPath, encodeCardImage, encodeGalleryImage } from "./image-variants";
import { hasR2Config, uploadR2Photo } from "./r2-photos";
import { VEHICLE_DOCS_BUCKET, getSupabaseAdmin } from "./supabase";

/**
 * Fallback do upload quando a Vercel recusa o corpo (413) e o R2 está ativo.
 * O navegador não tem credencial do R2, então a foto leve passa por um objeto
 * PRIVADO no bucket `documentos` (URL assinada, sem URL pública). O servidor
 * lê esse objeto, gera galeria e capa, grava só no R2 e apaga o temporário.
 */
export const STAGING_PREFIX = "foto-staging/";
const STAGING_PATH = /^foto-staging\/([0-9a-z-]{8,80})\.(webp|jpg)$/i;
const MAX_STAGED_BYTES = 15 * 1024 * 1024;

export function stagingObjectPath(stem: string, extension: "webp" | "jpg") {
  const path = `${STAGING_PREFIX}${stem}.${extension}`;
  return STAGING_PATH.test(path) ? path : null;
}

export function parseStagingPath(path: unknown) {
  if (typeof path !== "string") return null;
  const match = STAGING_PATH.exec(path);
  return match ? { stem: match[1], extension: match[2].toLowerCase() as "webp" | "jpg" } : null;
}

export type StagingDeps = {
  download: (path: string) => Promise<Buffer | null>;
  remove: (path: string) => Promise<void>;
  uploadPublic: (path: string, body: Buffer, contentType: string) => Promise<string>;
  preparePath: typeof prepareGalleryUploadPath;
};

const defaultDeps: StagingDeps = {
  async download(path) {
    const { data, error } = await getSupabaseAdmin().storage.from(VEHICLE_DOCS_BUCKET).download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  },
  async remove(path) {
    await getSupabaseAdmin().storage.from(VEHICLE_DOCS_BUCKET).remove([path]);
  },
  async uploadPublic(path, body, contentType) {
    return (await uploadR2Photo(path, body, contentType)).url;
  },
  preparePath: prepareGalleryUploadPath,
};

export type PublishStagedResult =
  | { ok: true; url: string; thumbnailUrl: string }
  | { ok: false; status: 400 | 500 | 503; error: string };

/** Publica no R2 a foto temporária. Nunca grava foto pública no Supabase. */
export async function publishStagedPhoto(
  path: unknown,
  deps: StagingDeps = defaultDeps,
  r2Ready: boolean = hasR2Config(),
): Promise<PublishStagedResult> {
  const parsed = parseStagingPath(path);
  if (!parsed) return { ok: false, status: 400, error: "Arquivo temporário inválido." };
  if (!r2Ready) return { ok: false, status: 503, error: "Upload indisponível: configuração do R2 incompleta." };
  const stagedPath = path as string;

  try {
    const raw = await deps.download(stagedPath);
    if (!raw || raw.byteLength === 0 || raw.byteLength > MAX_STAGED_BYTES) {
      return { ok: false, status: 400, error: "Arquivo temporário não encontrado." };
    }
    let gallery: Awaited<ReturnType<typeof encodeGalleryImage>>;
    let card: Awaited<ReturnType<typeof encodeCardImage>>;
    try {
      [gallery, card] = await Promise.all([encodeGalleryImage(raw), encodeCardImage(raw)]);
    } catch {
      return { ok: false, status: 400, error: "Não foi possível otimizar a foto." };
    }
    const galleryPath = await deps.preparePath(parsed.stem, gallery);
    const [url, thumbnailUrl] = await Promise.all([
      deps.uploadPublic(galleryPath, gallery.buffer, gallery.contentType),
      deps.uploadPublic(cardObjectPath(galleryPath), card.buffer, card.contentType),
    ]);
    return { ok: true, url, thumbnailUrl };
  } catch (error) {
    console.error("[upload/publish-staged]", error instanceof Error ? error.message : "falha");
    return { ok: false, status: 500, error: "Falha ao enviar a foto para o armazenamento." };
  } finally {
    await deps.remove(stagedPath).catch(() => undefined);
  }
}
