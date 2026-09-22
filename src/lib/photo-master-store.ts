import { encodeMasterJpeg } from "@/lib/photo-jpeg";
import {
  masterObjectPathFromGalleryPath,
  masterObjectPathFromId,
  PHOTO_MASTER_PREFIX,
} from "@/lib/photo-master";
import {
  VEHICLE_DOCS_BUCKET,
  ensurePrivateDocsBucket,
  getSupabaseAdmin,
} from "@/lib/supabase";

const MAX_MASTER_BYTES = 12 * 1024 * 1024;

function isMasterPath(path: string) {
  return (
    path.startsWith(PHOTO_MASTER_PREFIX) &&
    path.length < 160 &&
    !path.includes("..") &&
    path.endsWith(".jpg")
  );
}

export async function downloadPrivateMaster(
  path: string,
): Promise<Uint8Array | null> {
  if (!isMasterPath(path)) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(VEHICLE_DOCS_BUCKET)
      .download(path);
    if (error || !data) return null;
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_MASTER_BYTES) return null;
    return bytes;
  } catch (error) {
    console.warn("[photo-master] download:", error);
    return null;
  }
}

/** Grava o JPEG privado. Não publica URL. Não substitui um master que já existe. */
export async function uploadPrivateMasterBytes(stemOrId: string, bytes: Uint8Array) {
  const path =
    masterObjectPathFromId(stemOrId) ??
    masterObjectPathFromGalleryPath(`${stemOrId}.webp`);
  if (!path || !isMasterPath(path)) return false;
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MASTER_BYTES) return false;

  try {
    await ensurePrivateDocsBucket();
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(VEHICLE_DOCS_BUCKET)
      .upload(path, Buffer.from(bytes), {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "31536000",
      });
    if (error) {
      if (!/already exists|duplicate|exists/i.test(error.message)) {
        console.warn("[photo-master] upload:", error.message);
      }
      return /already exists|duplicate|exists/i.test(error.message);
    }
    return true;
  } catch (error) {
    console.warn("[photo-master] upload:", error);
    return false;
  }
}

export async function storeFallbackMaster(id: string, source: Uint8Array) {
  try {
    const jpeg = await encodeMasterJpeg(source);
    return await uploadPrivateMasterBytes(id, jpeg);
  } catch (error) {
    console.warn("[photo-master] fallback:", error);
    return false;
  }
}

/** Apaga `foto-master/*.jpg` cujo nome não é o de uma foto ainda no estoque. */
export async function deleteUnreferencedMasters(
  stems: ReadonlySet<string>,
): Promise<number> {
  try {
    const supabase = getSupabaseAdmin();
    const folder = PHOTO_MASTER_PREFIX.replace(/\/$/, "");
    const orphans: string[] = [];
    const limit = 100;

    for (let page = 0; page < 50; page += 1) {
      const { data, error } = await supabase.storage.from(VEHICLE_DOCS_BUCKET).list(folder, {
        limit,
        offset: page * limit,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        console.warn("[photo-master] list:", error.message);
        return 0;
      }
      if (!data || data.length === 0) break;

      for (const item of data) {
        if (!item.name || !/\.jpg$/i.test(item.name)) continue;
        if (item.id === null && !item.metadata) continue;
        const stem = item.name.replace(/\.jpg$/i, "");
        if (!stems.has(stem)) orphans.push(`${PHOTO_MASTER_PREFIX}${item.name}`);
      }

      if (data.length < limit) break;
    }

    let removed = 0;
    for (let index = 0; index < orphans.length; index += 50) {
      const batch = orphans.slice(index, index + 50);
      const { error } = await supabase.storage.from(VEHICLE_DOCS_BUCKET).remove(batch);
      if (error) {
        console.warn("[photo-master] cleanup:", error.message);
        break;
      }
      removed += batch.length;
    }
    return removed;
  } catch (error) {
    console.warn("[photo-master] cleanup:", error);
    return 0;
  }
}

export async function copyPrivateMaster(
  sourceGalleryPath: string,
  destGalleryPath: string,
) {
  const from = masterObjectPathFromGalleryPath(sourceGalleryPath);
  const to = masterObjectPathFromGalleryPath(destGalleryPath);
  if (!from || !to || from === to) return;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(VEHICLE_DOCS_BUCKET)
      .copy(from, to);
    if (error && !/not found|does not exist|404/i.test(error.message)) {
      console.warn("[photo-master] copy:", error.message);
    }
  } catch (error) {
    console.warn("[photo-master] copy:", error);
  }
}
