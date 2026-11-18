import { e2ePhotoFixture } from "./e2e-photo-fixture";
import { isPublicPhotoBlob } from "./public-photo-url";
import { isPublicPhotoSource } from "./public-photo-source";
import { downloadR2Photo, isR2PhotoUrl } from "./r2-photos";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ADMIN_JPEG_QUALITY,
  DOWNLOAD_JPEG_QUALITY,
  toDownloadJpeg,
  toCatalogJpeg,
} from "@/lib/photo-jpeg";
import { masterObjectPathFromGalleryPath } from "@/lib/photo-master";
import { downloadPrivateMaster } from "@/lib/photo-master-store";
import { supabaseOriginalSrc } from "@/lib/stock-query";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  isAllowedStorageHost,
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

export type AdminJpegLoadOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  downloadMaster?: (
    masterPath: string,
    options?: { timeoutMs?: number },
  ) => Promise<Uint8Array | null>;
};

export type AdminJpegDetailedResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: string };

async function downloadStorageObject(
  storagePath: string,
  timeoutMs = 8_000,
): Promise<{ bytes: Uint8Array | null; reason?: string }> {
  if (!isSafeVehicleStoragePath(storagePath)) {
    return { bytes: null, reason: "Endereço de foto inválido" };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const supabase = getSupabaseAdmin();
    const downloadPromise = supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .download(storagePath);
    const timeoutPromise = new Promise<"TIMEOUT">((resolve) => {
      timer = setTimeout(() => resolve("TIMEOUT"), timeoutMs);
    });
    const outcome = await Promise.race([downloadPromise, timeoutPromise]);
    if (outcome === "TIMEOUT") {
      return { bytes: null, reason: "Tempo esgotado" };
    }
    const { data, error } = outcome;
    if (error || !data) {
      if (error) console.warn("[photo-archive] storage download:", error.message);
      const notFound = error && /not\s*found|404|does\s*not\s*exist/i.test(error.message);
      return {
        bytes: null,
        reason: notFound ? "Foto não encontrada" : "Falha ao baixar do Storage",
      };
    }
    return { bytes: new Uint8Array(await data.arrayBuffer()) };
  } catch (error) {
    console.warn("[photo-archive] storage:", error);
    return { bytes: null, reason: "Falha ao baixar do Storage" };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function loadArchiveOriginalDetailed(
  url: string,
  source: "admin" | "public" = "admin",
  options?: {
    signal?: AbortSignal;
    timeoutMs?: number;
    fetcher?: typeof fetch;
  },
): Promise<{ file: ArchiveFile | null; reason: string }> {
  const fixture = await e2ePhotoFixture();
  if (fixture) {
    return {
      file: { bytes: fixture, contentType: "image/png" },
      reason: "",
    };
  }
  if (source === "public" && !isPublicPhotoSource(url)) {
    return { file: null, reason: "Endereço de foto inválido" };
  }
  const withoutHash = url.split("#")[0] ?? url;
  const original = supabaseOriginalSrc(withoutHash).split("?")[0] ?? withoutHash;
  const timeoutMs = Math.max(20, options?.timeoutMs ?? 10_000);
  const fetcher = options?.fetcher ?? fetch;
  const maxBytes = source === "admin" ? MAX_ADMIN_SOURCE_BYTES : MAX_SOURCE_BYTES;

  let storagePath: string | null = null;
  try {
    storagePath = storagePathFromPublicUrl(original);
  } catch {
    storagePath = null;
  }

  let fallbackReason = "Falha ao baixar do Storage";

  if (storagePath && isSafeVehicleStoragePath(storagePath)) {
    if (isR2PhotoUrl(original)) {
      let r2Reason = "Falha ao baixar do R2";
      const bytes = await downloadR2Photo(original, fetcher, {
        timeoutMs,
        signal: options?.signal,
        onFailureReason: (reason) => {
          r2Reason = reason;
        },
      });
      if (!bytes) {
        // Sem segunda busca: R2 já tentou URL pública e API autenticada
        return { file: null, reason: r2Reason };
      }
      return {
        file: {
          bytes,
          contentType: contentTypeFromName(storagePath, "image/webp"),
        },
        reason: "",
      };
    } else {
      const storageRes = await downloadStorageObject(storagePath, timeoutMs);
      if (storageRes.bytes) {
        return {
          file: {
            bytes: storageRes.bytes,
            contentType: contentTypeFromName(storagePath, "image/webp"),
          },
          reason: "",
        };
      }
      if (storageRes.reason) fallbackReason = storageRes.reason;
    }
  }

  if (original.startsWith("/") && !original.startsWith("//")) {
    const relative = original.replace(/^\/+/, "");
    if (relative.includes("..")) {
      return { file: null, reason: "Endereço de foto inválido" };
    }
    try {
      const filePath = path.join(process.cwd(), "public", relative);
      const buffer = await readFile(filePath);
      return {
        file: {
          bytes: new Uint8Array(buffer),
          contentType: contentTypeFromName(relative),
        },
        reason: "",
      };
    } catch {
      return { file: null, reason: "Foto não encontrada" };
    }
  }

  if (!/^https:\/\//i.test(original)) {
    return { file: null, reason: "Endereço de foto inválido" };
  }

  try {
    const parsed = new URL(original);
    if (parsed.protocol !== "https:") {
      return { file: null, reason: "Endereço de foto inválido" };
    }
    if (parsed.username || parsed.password) {
      return { file: null, reason: "Endereço de foto inválido" };
    }
    if (parsed.port && parsed.port !== "443") {
      return { file: null, reason: "Endereço de foto inválido" };
    }
    if (!isPublicPhotoBlob(original) && !isAllowedStorageHost(parsed.hostname)) {
      return { file: null, reason: "Endereço de foto inválido" };
    }

    const controller = new AbortController();
    const onOuterAbort = () => controller.abort(options?.signal?.reason);
    if (options?.signal) {
      if (options.signal.aborted) {
        controller.abort(options.signal.reason);
      } else {
        options.signal.addEventListener("abort", onOuterAbort, { once: true });
      }
    }
    const timeout = setTimeout(
      () => controller.abort(new DOMException("Tempo esgotado", "TimeoutError")),
      timeoutMs,
    );

    try {
      const response = await fetcher(original, {
        signal: controller.signal,
        redirect: "error",
      });
      if (!response.ok || !response.body) {
        return {
          file: null,
          reason:
            response.status === 404
              ? "Foto não encontrada"
              : `Erro HTTP ${response.status}`,
        };
      }

      const contentLength = Number(response.headers.get("content-length"));
      if (contentLength && contentLength > maxBytes) {
        return { file: null, reason: "Tamanho acima do limite" };
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return { file: null, reason: "Tamanho acima do limite" };
        }
        chunks.push(value);
      }

      const merged = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return {
        file: {
          bytes: merged,
          contentType:
            response.headers.get("content-type") ||
            contentTypeFromName(original, "image/webp"),
        },
        reason: "",
      };
    } finally {
      clearTimeout(timeout);
      options?.signal?.removeEventListener("abort", onOuterAbort);
    }
  } catch (error) {
    const aborted =
      options?.signal?.aborted ||
      (error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError"));
    if (!aborted) {
      console.warn("[photo-archive] fetch:", error);
    }
    return {
      file: null,
      reason: aborted ? "Tempo esgotado" : fallbackReason,
    };
  }
}

/**
 * Baixa o arquivo da galeria (não a miniatura do card).
 * Prefere o Storage com service role; cai na URL pública ou em /public.
 */
export async function loadArchiveOriginal(
  url: string,
  source: "admin" | "public" = "admin",
): Promise<ArchiveFile | null> {
  const { file } = await loadArchiveOriginalDetailed(url, source);
  return file;
}

/** JPG público da ficha: mesmo legado JPEG fica limitado a 1280 px. */
export async function loadGalleryJpeg(url: string): Promise<Uint8Array | null> {
  return loadCatalogJpeg(url, DOWNLOAD_JPEG_QUALITY);
}

/** Catálogo público usa a galeria e nunca busca o master privado. */
export async function loadCatalogJpeg(url: string, quality = 80): Promise<Uint8Array | null> {
  const file = await loadArchiveOriginal(url, "public");
  if (!file || file.bytes.byteLength === 0 || file.bytes.byteLength > MAX_SOURCE_BYTES) return null;
  try { return await toCatalogJpeg(file.bytes, quality); }
  catch { return null; }
}

/**
 * Versão detalhada do carregamento de foto em alta para o admin.
 * Prefere o master privado (JPEG até 3840px, repassado sem recomprimir nem redimensionar);
 * caso não exista, baixa o original do R2/Storage (sem reduzir dimensões e sem recomprimir JPEGs).
 */
export async function loadAdminJpegDetailed(
  url: string,
  options?: AdminJpegLoadOptions,
): Promise<AdminJpegDetailedResult> {
  if (options?.signal?.aborted) {
    return { ok: false, reason: "Tempo esgotado" };
  }

  const timeoutMs = Math.max(20, options?.timeoutMs ?? 8_000);
  const masterLoader = options?.downloadMaster ?? downloadPrivateMaster;

  try {
    const galleryPath = vehiclePhotoStoragePath(url);
    const masterPath = galleryPath
      ? masterObjectPathFromGalleryPath(galleryPath)
      : null;

    if (masterPath && !options?.signal?.aborted) {
      const master = await masterLoader(masterPath, { timeoutMs });
      if (master) {
        const jpeg = await encodeDownload(
          master,
          ADMIN_JPEG_QUALITY,
          MAX_ADMIN_SOURCE_BYTES,
        );
        if (jpeg) return { ok: true, bytes: jpeg };
      }
    }

    if (options?.signal?.aborted) {
      return { ok: false, reason: "Tempo esgotado" };
    }

    const { file, reason } = await loadArchiveOriginalDetailed(url, "admin", {
      signal: options?.signal,
      timeoutMs,
      fetcher: options?.fetcher,
    });
    if (!file) {
      return { ok: false, reason: reason || "Falha ao baixar foto" };
    }
    if (file.bytes.byteLength === 0) {
      return { ok: false, reason: "Arquivo vazio" };
    }
    if (file.bytes.byteLength > MAX_ADMIN_SOURCE_BYTES) {
      return { ok: false, reason: "Tamanho acima do limite" };
    }

    const encoded = await encodeDownload(
      file.bytes,
      ADMIN_JPEG_QUALITY,
      MAX_ADMIN_SOURCE_BYTES,
    );
    if (!encoded) {
      return { ok: false, reason: "Arquivo inválido ou corrompido" };
    }

    return { ok: true, bytes: encoded };
  } catch (error) {
    if (
      options?.signal?.aborted ||
      (error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError"))
    ) {
      return { ok: false, reason: "Tempo esgotado" };
    }
    const detail = error instanceof Error ? error.message : String(error);
    const safeDetail = detail
      .replace(/https?:\/\/\S+/gi, "[URL removida]")
      .replace(/((?:token|key|password|secret)\s*[=:]\s*)\S+/gi, "$1[redigido]")
      .slice(0, 160);
    console.error("[photo-archive] falha inesperada ao preparar JPG:", safeDetail);
    return { ok: false, reason: "Falha ao processar foto" };
  }
}

/**
 * JPG do admin. Prefere o master privado (até 3840, sem URL pública).
 * Se a foto é antiga e só existe a galeria, usa esses pixels inteiros em JPEG 93
 * — não reduz de novo para 1280.
 */
export async function loadAdminJpeg(url: string): Promise<Uint8Array | null> {
  const result = await loadAdminJpegDetailed(url);
  return result.ok ? result.bytes : null;
}

export async function loadAdminJpegSafely(
  url: string,
  loader: typeof loadAdminJpeg = loadAdminJpeg,
): Promise<Uint8Array | null> {
  try {
    return await loader(url);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const safeDetail = detail
      .replace(/https?:\/\/\S+/gi, "[URL removida]")
      .replace(/((?:token|key|password|secret)\s*[=:]\s*)\S+/gi, "$1[redigido]")
      .slice(0, 160);
    console.error("[photo-archive] falha inesperada ao preparar JPG:", safeDetail);
    return null;
  }
}

export function attachmentHeaders(filename: string, contentType: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${ascii}"`,
    "Cache-Control": "private, no-store",
  };
}
