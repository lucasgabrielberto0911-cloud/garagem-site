type FileUploadResponse = {
  error?: string;
  url?: string;
  name?: string;
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
  const form = new FormData();
  form.append("file", file);
  if (vehicleId) form.append("vehicleId", vehicleId);

  const response = await fetch("/api/admin/files", {
    method: "POST",
    credentials: "same-origin",
    body: form,
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

  return { url: data.url, name: data.name || file.name };
}
