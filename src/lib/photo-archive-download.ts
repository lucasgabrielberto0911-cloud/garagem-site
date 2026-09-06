import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseOriginalSrc } from "@/lib/stock-query";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  storagePathFromPublicUrl,
} from "@/lib/supabase";

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

/**
 * Baixa o arquivo da galeria (não a miniatura do card).
 * Prefere o Storage com service role; cai na URL pública ou em /public.
 */
export async function loadArchiveOriginal(url: string): Promise<ArchiveFile | null> {
  const original = supabaseOriginalSrc(url).split("#")[0] ?? url;
  const storagePath = storagePathFromPublicUrl(original);

  if (storagePath) {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.storage
        .from(VEHICLE_PHOTOS_BUCKET)
        .download(storagePath);
      if (!error && data) {
        return {
          bytes: new Uint8Array(await data.arrayBuffer()),
          contentType: data.type || contentTypeFromName(storagePath, "image/webp"),
        };
      }
      if (error) {
        console.warn("[photo-archive] storage download:", error.message);
      }
    } catch (error) {
      console.warn("[photo-archive] storage:", error);
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

export function attachmentHeaders(filename: string, contentType: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${ascii}"`,
    "Cache-Control": "private, no-store",
  };
}
