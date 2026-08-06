import { prepareImageForUpload } from "@/lib/prepare-image-upload";

type SignResponse = {
  error?: string;
  path?: string;
  token?: string;
  signedUrl?: string;
  publicUrl?: string;
  contentType?: string;
};

/**
 * Comprime no browser e sobe direto ao Supabase via URL assinada
 * (não passa o arquivo pela Vercel → evita 413).
 */
export async function uploadImageDirect(file: File): Promise<string> {
  const prepared = await prepareImageForUpload(file);

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
