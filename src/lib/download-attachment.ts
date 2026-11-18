"use client";

import type { PhotoZipFailure } from "@/lib/admin-photo-zip";

export class DownloadAttachmentError extends Error {
  failures?: PhotoZipFailure[];

  constructor(message: string, failures?: PhotoZipFailure[]) {
    super(message);
    this.name = "DownloadAttachmentError";
    this.failures = failures;
  }
}

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

/** Baixa a resposta como arquivo, usando o nome do Content-Disposition. */
export async function downloadAttachment(
  href: string,
  fallbackName: string,
): Promise<{ filename: string; headers: Headers }> {
  const response = await fetch(
    href,
    href.startsWith("blob:") ? undefined : { credentials: "same-origin" },
  );
  if (!response.ok) {
    let message = "Não foi possível baixar.";
    let failures: PhotoZipFailure[] | undefined;
    try {
      const data = (await response.json()) as {
        error?: string;
        failures?: PhotoZipFailure[];
      };
      if (data.error) message = data.error;
      if (Array.isArray(data.failures)) failures = data.failures;
    } catch {
      // resposta binária ou vazia
    }
    throw new DownloadAttachmentError(message, failures);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (fallbackName.endsWith(".zip") && (bytes[0] !== 0x50 || bytes[1] !== 0x4b)) {
    throw new DownloadAttachmentError(
      "O arquivo baixado não é um ZIP válido. Tente de novo.",
    );
  }

  const type = fallbackName.endsWith(".zip")
    ? "application/zip"
    : response.headers.get("content-type") || "application/octet-stream";
  const blob = new Blob([bytes], { type });
  const name = filenameFromDisposition(
    response.headers.get("content-disposition"),
    fallbackName,
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);

  return { filename: name, headers: response.headers };
}
