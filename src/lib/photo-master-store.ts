import { e2ePhotoFixture } from "./e2e-photo-fixture";
import { encodeMasterJpeg } from "@/lib/photo-jpeg";
import {
  masterObjectPathFromGalleryPath,
  masterObjectPathFromId,
  PHOTO_MASTER_PREFIX,
  previousObjectPathFromGalleryPath,
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
  options?: { timeoutMs?: number },
): Promise<Uint8Array | null> {
  if (!isMasterPath(path)) return null;
  const fixture = await e2ePhotoFixture();
  if (fixture) return fixture;

  const timeoutMs = Math.max(500, options?.timeoutMs ?? 8_000);
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const supabase = getSupabaseAdmin();
    const downloadPromise = supabase.storage
      .from(VEHICLE_DOCS_BUCKET)
      .download(path);
    const timeoutPromise = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });

    const result = await Promise.race([downloadPromise, timeoutPromise]);
    if (!result || result.error || !result.data) return null;

    const bytes = new Uint8Array(await result.data.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_MASTER_BYTES)
      return null;
    return bytes;
  } catch (error) {
    console.warn("[photo-master] download:", error);
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Grava o JPEG privado. Não publica URL. Não substitui um master que já existe. */
export async function uploadPrivateMasterBytes(
  stemOrId: string,
  bytes: Uint8Array,
) {
  const path =
    masterObjectPathFromId(stemOrId) ??
    masterObjectPathFromGalleryPath(`${stemOrId}.webp`);
  if (!path || !isMasterPath(path)) return false;
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MASTER_BYTES)
    return false;

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

export async function copyPrivateMaster(
  sourceGalleryPath: string,
  destGalleryPath: string,
) {
  const pairs = [
    [masterObjectPathFromGalleryPath(sourceGalleryPath), masterObjectPathFromGalleryPath(destGalleryPath)],
    [previousObjectPathFromGalleryPath(sourceGalleryPath), previousObjectPathFromGalleryPath(destGalleryPath)],
  ];
  await Promise.all(pairs.map(async ([from, to]) => {
    if (!from || !to || from === to) return;
    try {
      const { error } = await getSupabaseAdmin().storage.from(VEHICLE_DOCS_BUCKET).copy(from, to);
      if (error && !/not found|does not exist|404/i.test(error.message)) console.warn("[photo-master] copy:", error.message);
    } catch (error) { console.warn("[photo-master] copy:", error); }
  }));
}
