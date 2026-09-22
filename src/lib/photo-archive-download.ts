import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ADMIN_JPEG_QUALITY,
  DOWNLOAD_JPEG_QUALITY,
  toDownloadJpeg,
} from "@/lib/photo-jpeg";
import { masterObjectPathFromGalleryPath } from "@/lib/photo-master";
import { downloadPrivateMaster } from "@/lib/photo-master-store";
import { supabaseOriginalSrc } from "@/lib/stock-query";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  storagePathFromPublicUrl,
} from "@/lib/supabase";

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_ADMIN_SOURCE_BYTES = 20 * 1024 * 1024;

export type ArchiveFile = {
  bytes: Uint8Array;
  contentType: string;
};

const CONTENT_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function contentTypeFromName(name: string, fallback = "application/octet-stream") {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_BY_EXT[ext] || fallback;
}

export function isSafeVehicleStoragePath(storagePath: string) {
  if (!storagePath || storagePath.length > 512) return false;
  if (
    storagePath.startsWith("/") ||
    storagePath.includes("\\") ||
    storagePath.includes("..")
  ) {
    return false;
  }
  return storagePath.split("/").every((part) => part.length > 0 && part !== ".");
}

/**
 * Path no bucket `veiculos` a partir da URL pública.
 * O host da URL é ignorado de propósito: o download usa a service role
 * neste bucket, nunca um fetch da URL recebida.
 */
export function vehiclePhotoStoragePath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  const withoutHash = trimmed.split("#")[0] ?? "";
  const withoutQuery = withoutHash.split("?")[0] ?? "";
  let storagePath: string | null;
  try {
    storagePath = storagePathFromPublicUrl(supabaseOriginalSrc(withoutQuery));
  } catch {
    return null;
  }
  if (!storagePath || !isSafeVehicleStoragePath(storagePath)) return null;
  return storagePath;
}

async function encodeDownload(
  bytes: Uint8Array,
  quality: number,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
    console.warn("[photo-jpeg] tamanho inválido:", bytes.byteLength);
    return null;
  }
  try {
    return await toDownloadJpeg(bytes, quality);
  } catch (error) {
    console.warn("[photo-jpeg] conversão:", error);
    return null;
  }
}

async function downloadStorageObject(storagePath: string): Promise<Uint8Array | null> {
  if (!isSafeVehicleStoragePath(storagePath)) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .download(storagePath);
    if (error || !data) {
      if (error) console.warn("[photo-archive] storage download:", error.message);
      return null;
    }
    return new Uint8Array(await data.arrayBuffer());
  } catch (error) {
    console.warn("[photo-archive] storage:", error);
    return null;
  }
}

/**
 * Baixa o arquivo da galeria (não a miniatura do card).
 * Prefere o Storage com service role; cai na URL pública ou em /public.
 */
export async function loadArchiveOriginal(url: string): Promise<ArchiveFile | null> {
  const withoutHash = url.split("#")[0] ?? url;
  const original = supabaseOriginalSrc(withoutHash).split("?")[0] ?? withoutHash;
  let storagePath: string | null = null;
  try {
    storagePath = storagePathFromPublicUrl(original);
  } catch {
    storagePath = null;
  }

  if (storagePath && isSafeVehicleStoragePath(storagePath)) {
    const bytes = await downloadStorageObject(storagePath);
    if (bytes) {
      return {
        bytes,
        contentType: contentTypeFromName(storagePath, "image/webp"),
      };
    }
  }

  if (original.startsWith("/") && !original.startsWith("//")) {
    const relative = original.replace(/^\/+/, "");
    if (relative.includes("..")) return null;
    try {
      const filePath = path.join(process.cwd(), "public", relative);
      const buffer = await readFile(filePath);
      return {
        bytes: new Uint8Array(buffer),
        contentType: contentTypeFromName(relative),
      };
    } catch {
      return null;
    }
  }

  if (!/^https?:\/\//i.test(original)) return null;

  try {
    const response = await fetch(original);
    if (!response.ok) return null;
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType:
        response.headers.get("content-type") ||
        contentTypeFromName(original, "image/webp"),
    };
  } catch (error) {
    console.warn("[photo-archive] fetch:", error);
    return null;
  }
}

/** JPG leve da ficha: só a WebP da galeria (≤1280), qualidade 90. */
export async function loadGalleryJpeg(url: string): Promise<Uint8Array | null> {
  const file = await loadArchiveOriginal(url);
  if (!file) return null;
  return encodeDownload(file.bytes, DOWNLOAD_JPEG_QUALITY, MAX_SOURCE_BYTES);
}

/**
 * JPG do admin. Prefere o master privado (até 3840, sem URL pública).
 * Se a foto é antiga e só existe a galeria, usa esses pixels inteiros em JPEG 93
 * — não reduz de novo para 1280.
 */
export async function loadAdminJpeg(url: string): Promise<Uint8Array | null> {
  const galleryPath = vehiclePhotoStoragePath(url);
  const masterPath = galleryPath
    ? masterObjectPathFromGalleryPath(galleryPath)
    : null;
  if (masterPath) {
    const master = await downloadPrivateMaster(masterPath);
    if (master) {
      const jpeg = await encodeDownload(
        master,
        ADMIN_JPEG_QUALITY,
        MAX_ADMIN_SOURCE_BYTES,
      );
      if (jpeg) return jpeg;
    }
  }

  const file = await loadArchiveOriginal(url);
  if (!file) return null;
  return encodeDownload(file.bytes, ADMIN_JPEG_QUALITY, MAX_ADMIN_SOURCE_BYTES);
}

export function attachmentHeaders(filename: string, contentType: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${ascii}"`,
    "Cache-Control": "private, no-store",
  };
}
