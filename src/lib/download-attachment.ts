"use client";

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

/** Baixa a resposta como arquivo, usando o nome do Content-Disposition. */
export async function downloadAttachment(href: string, fallbackName: string) {
  const response = await fetch(href, { credentials: "same-origin" });
  if (!response.ok) {
    let message = "Não foi possível baixar.";
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // resposta binária ou vazia
    }
    throw new Error(message);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (fallbackName.endsWith(".zip") && (bytes[0] !== 0x50 || bytes[1] !== 0x4b)) {
    throw new Error("O arquivo baixado não é um ZIP válido. Tente de novo.");
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
}
