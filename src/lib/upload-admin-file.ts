type FileUploadResponse = {
  error?: string;
  url?: string;
  name?: string;
  signedUrl?: string;
};

/**
 * Upload interno (comprovantes / documentos): PDF ou imagem, sem blur de placa.
 */
export async function uploadAdminFile(
  file: File,
  vehicleId?: string,
): Promise<{
  url: string;
  name: string;
}> {
  if (file.size > 12 * 1024 * 1024)
    throw new Error("Arquivo muito grande. Máximo 12 MB.");
  const response = await fetch("/api/admin/files/sign", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      type: file.type,
      size: file.size,
      vehicleId,
    }),
  });
  const raw = await response.text();
  let data: FileUploadResponse = {};
  try {
    data = raw ? (JSON.parse(raw) as FileUploadResponse) : {};
  } catch {
    throw new Error(`Falha no upload (${response.status}).`);
  }

  if (!response.ok || !data.url) {
    throw new Error(data.error || `Falha no upload (${response.status}).`);
  }

  if (!data.signedUrl)
    throw new Error("Resposta inválida ao preparar o arquivo.");
  const upload = await fetch(data.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type, "x-upsert": "false" },
    body: file,
    signal: AbortSignal.timeout(120000),
  });
  if (!upload.ok)
    throw new Error("Não foi possível enviar o arquivo. Tente novamente.");
  return { url: data.url, name: data.name || file.name };
}
