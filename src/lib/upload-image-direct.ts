import { createClient } from "@supabase/supabase-js";
import {
  prepareImageForUpload,
  prepareMasterForUpload,
} from "@/lib/prepare-image-upload";

type SignResponse = {
  error?: string;
  id?: string;
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
 * Comprime no browser e sobe pela API do servidor (variantes WebP).
 * Não borra placa. O admin marca o retângulo depois, na foto já enviada.
 * Com `master: true`, também grava um JPEG maior no bucket privado
 * `documentos` — sem URL pública. O formulário de venda não usa isso.
 * Se a Vercel recusar por tamanho (413), cai no upload assinado direto
 * ao Storage e gera a miniatura em seguida.
 */
export async function uploadImageDirect(
  file: File,
  options?: { master?: boolean; id?: string },
): Promise<UploadedPhoto> {
  const heic =
    /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type);
  if (heic && file.size > 3 * 1024 * 1024)
    throw new Error(
      "HEIC acima de 3 MB. Exporte esta foto como JPG para enviar com segurança.",
    );
  const prepared = heic ? file : await prepareImageForUpload(file);
  // Evita decodificar simultaneamente a versão pública e o original no celular.
  const masterId =
    options?.master && !heic
      ? await uploadPrivateMaster(file, options.id)
      : null;

  try {
    const form = new FormData();
    form.append("file", prepared, prepared.name || "photo.webp");
    if (options?.master) form.append("storeMaster", "1");
    if (masterId) form.append("masterId", masterId);
    if (options?.id) form.append("uploadId", options.id);

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
          thumbnailUrl:
            data.photos?.[0]?.thumbnailUrl ?? data.thumbnailUrl ?? null,
        };
      }
    }

    if (response.status === 413) {
      console.warn(
        "[upload] /api/upload retornou 413 — usando upload assinado.",
      );
      if (heic)
        throw new Error(
          "O servidor recusou o tamanho do HEIC. Exporte como JPG e tente novamente.",
        );
      return uploadViaSignedUrl(prepared, masterId ?? options?.id ?? null);
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

async function uploadPrivateMaster(
  file: File,
  id?: string,
): Promise<string | null> {
  try {
    const prepared = await prepareMasterForUpload(file);
    if (!prepared) return null;

    const signResponse = await fetch("/api/upload/master/sign", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const signRaw = await signResponse.text();
    let signData: SignResponse = {};
    try {
      signData = signRaw ? (JSON.parse(signRaw) as SignResponse) : {};
    } catch {
      return null;
    }

    if (
      !signResponse.ok ||
      !signData.id ||
      !signData.path ||
      !signData.token ||
      !signData.signedUrl
    ) {
      console.warn(
        "[upload] master privado:",
        signData.error || signResponse.status,
      );
      return null;
    }

    const uploaded = await putWithCacheControl({
      bucket: "documentos",
      path: signData.path,
      token: signData.token,
      signedUrl: signData.signedUrl,
      prepared,
      contentType: "image/jpeg",
    });
    return uploaded ? signData.id : null;
  } catch (error) {
    console.warn("[upload] master privado:", error);
    return null;
  }
}

async function uploadViaSignedUrl(
  prepared: File,
  masterId: string | null,
): Promise<UploadedPhoto> {
  const signResponse = await fetch("/api/upload/sign", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentType: prepared.type || "image/webp",
      extension: prepared.name.toLowerCase().endsWith(".jpg") ? "jpg" : "webp",
      id: masterId ?? undefined,
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
      signData.error || `Falha ao preparar upload (${signResponse.status}).`,
    );
  }

  const contentType =
    signData.contentType || prepared.type || "application/octet-stream";
  const uploaded = await putWithCacheControl({
    bucket: "veiculos",
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
  bucket,
  path,
  token,
  signedUrl,
  prepared,
  contentType,
}: {
  bucket: "veiculos" | "documentos";
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
        .from(bucket)
        .uploadToSignedUrl(path, token, prepared, {
          contentType,
          cacheControl: "31536000",
          upsert: false,
        });
      if (!error) return true;
      if (/already exists|duplicate/i.test(error.message)) return true;
      console.warn(
        "[upload] uploadToSignedUrl falhou, tentando PUT:",
        error.message,
      );
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
    if (
      [400, 409].includes(put.status) &&
      /already exists|duplicate/i.test(detail)
    )
      return true;
    console.error("Direct storage upload failed:", put.status, detail);
    throw new Error(
      put.status === 413
        ? "Arquivo ainda grande demais. Tente JPG menor."
        : `Falha no Storage (${put.status}). Tente de novo.`,
    );
  }

  return true;
}
