import { createClient } from "@supabase/supabase-js";
import { prepareImageForUpload } from "@/lib/prepare-image-upload";

type SignResponse = {
  error?: string;
  path?: string;
  token?: string;
  signedUrl?: string;
  publicUrl?: string;
  contentType?: string;
};

type UploadApiResponse = {
  error?: string;
  url?: string;
  urls?: string[];
  thumbnailUrl?: string | null;
  photos?: Array<{ url: string; thumbnailUrl: string | null }>;
};

export type UploadedPhoto = {
  url: string;
  thumbnailUrl: string | null;
};

/**
 * Comprime no browser e sobe pela API do servidor (blur de placa via
 * Rekognition + variantes WebP). Se a Vercel recusar por tamanho (413),
 * cai no upload assinado direto ao Storage e gera a miniatura em seguida.
 */
export async function uploadImageDirect(file: File): Promise<UploadedPhoto> {
  const prepared = await prepareImageForUpload(file);

  try {
    const form = new FormData();
    form.append("file", prepared, prepared.name || "photo.webp");

    const response = await fetch("/api/upload", {
      method: "POST",
      credentials: "same-origin",
      body: form,
    });

    const raw = await response.text();
    let data: UploadApiResponse = {};
    try {
      data = raw ? (JSON.parse(raw) as UploadApiResponse) : {};
    } catch {
      // segue para fallback se 413 / resposta estranha
    }

    if (response.ok) {
      const url = data.photos?.[0]?.url || data.url || data.urls?.[0];
      if (url) {
        return {
          url,
          thumbnailUrl: data.photos?.[0]?.thumbnailUrl ?? data.thumbnailUrl ?? null,
        };
      }
    }

    if (response.status === 413) {
      console.warn(
        "[upload] /api/upload retornou 413 — usando upload assinado (sem blur nesta foto).",
      );
      return uploadViaSignedUrl(prepared);
    }

    throw new Error(
      data.error || `Falha no upload (${response.status}). Tente de novo.`,
    );
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Falha no upload. Tente de novo.");
  }
}

async function deriveThumbnail(url: string): Promise<string | null> {
  try {
    const response = await fetch("/api/upload/variants", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { thumbnailUrl?: string };
    return data.thumbnailUrl ?? null;
  } catch {
    return null;
  }
}

async function uploadViaSignedUrl(prepared: File): Promise<UploadedPhoto> {
  const signResponse = await fetch("/api/upload/sign", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentType: prepared.type || "image/webp",
      extension: prepared.name.toLowerCase().endsWith(".jpg") ? "jpg" : "webp",
    }),
  });

  const signRaw = await signResponse.text();
  let signData: SignResponse = {};
  try {
    signData = signRaw ? (JSON.parse(signRaw) as SignResponse) : {};
  } catch {
    throw new Error(
      signResponse.ok
        ? "Resposta inválida ao preparar upload."
        : `Falha ao preparar upload (${signResponse.status}).`,
    );
  }

  if (
    !signResponse.ok ||
    !signData.signedUrl ||
    !signData.publicUrl ||
    !signData.path ||
    !signData.token
  ) {
    throw new Error(
      signData.error ||
        `Falha ao preparar upload (${signResponse.status}).`,
    );
  }

  const contentType =
    signData.contentType || prepared.type || "application/octet-stream";
  const uploaded = await putWithCacheControl({
    path: signData.path,
    token: signData.token,
    signedUrl: signData.signedUrl,
    prepared,
    contentType,
  });

  if (!uploaded) {
    throw new Error("Falha no Storage. Tente de novo.");
  }

  const thumbnailUrl = await deriveThumbnail(signData.publicUrl);
  return { url: signData.publicUrl, thumbnailUrl };
}

async function putWithCacheControl({
  path,
  token,
  signedUrl,
  prepared,
  contentType,
}: {
  path: string;
  token: string;
  signedUrl: string;
  prepared: File;
  contentType: string;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (url && anon) {
    try {
      const supabase = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await supabase.storage
        .from("veiculos")
        .uploadToSignedUrl(path, token, prepared, {
          contentType,
          cacheControl: "31536000",
          upsert: false,
        });
      if (!error) return true;
      console.warn("[upload] uploadToSignedUrl falhou, tentando PUT:", error.message);
    } catch (error) {
      console.warn("[upload] uploadToSignedUrl indisponível:", error);
    }
  }

  const put = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "cache-control": "31536000",
      "x-upsert": "false",
    },
    body: prepared,
  });

  if (!put.ok) {
    const detail = await put.text().catch(() => "");
    console.error("Direct storage upload failed:", put.status, detail);
    throw new Error(
      put.status === 413
        ? "Arquivo ainda grande demais. Tente JPG menor."
        : `Falha no Storage (${put.status}). Tente de novo.`,
    );
  }

  return true;
}
