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
};

/**
 * Comprime no browser e sobe pela API do servidor (blur de placa via
 * Rekognition). Se a Vercel recusar por tamanho (413), cai no upload
 * assinado direto ao Storage — sem blur, mas o cadastro não trava.
 */
export async function uploadImageDirect(file: File): Promise<string> {
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
      const url = data.url || data.urls?.[0];
      if (url) return url;
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

async function uploadViaSignedUrl(prepared: File): Promise<string> {
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

  if (!signResponse.ok || !signData.signedUrl || !signData.publicUrl) {
    throw new Error(
      signData.error ||
        `Falha ao preparar upload (${signResponse.status}).`,
    );
  }

  const put = await fetch(signData.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type":
        signData.contentType || prepared.type || "application/octet-stream",
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

  return signData.publicUrl;
}
