/**
 * Prepara imagens no navegador antes do upload: redimensiona e comprime
 * para caber no limite da Vercel / Storage sem estourar 413.
 */

const MAX_EDGE_START = 1280;
const TARGET_BYTES = 850 * 1024;
/** Nunca enviar request/body maior que isso para a API. */
export const HARD_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

function isHeicLike(file: File) {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  return /\.(heic|heif)$/i.test(file.name);
}

function supportsWebp(): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem. Tente JPG."));
    };
    image.src = url;
  });
}

async function canvasFromFile(
  file: File,
  maxEdge: number,
): Promise<HTMLCanvasElement> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      throw new Error("Canvas indisponível.");
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
  } catch (error) {
    if (isHeicLike(file)) {
      throw new Error(
        "HEIC não pode ser comprimido aqui. Exporte como JPG (iPhone: Formatos → Mais Compatível) e envie de novo.",
      );
    }
    const image = await loadImageFromBlob(file);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Falha ao comprimir a imagem."));
          return;
        }
        resolve(blob);
      },
      mime,
      quality,
    );
  });
}

function baseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || "foto";
}

/**
 * Devolve arquivo leve para upload. Nunca devolve HEIC bruto nem arquivos
 * acima de HARD_MAX_UPLOAD_BYTES.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  const useWebp = supportsWebp();
  const mime = useWebp ? "image/webp" : "image/jpeg";
  const ext = useWebp ? ".webp" : ".jpg";
  const name = `${baseName(file.name)}${ext}`;

  let maxEdge = MAX_EDGE_START;
  let quality = useWebp ? 0.7 : 0.72;
  let lastError: Error | null = null;
  let lastPrepared: File | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const canvas = await canvasFromFile(file, maxEdge);
      const blob = await canvasToBlob(canvas, mime, quality);
      const prepared = new File([blob], name, { type: mime });
      lastPrepared = prepared;

      if (prepared.size > 0 && prepared.size <= TARGET_BYTES) {
        return prepared;
      }

      quality = Math.max(0.45, quality - 0.1);
      maxEdge = Math.max(720, Math.round(maxEdge * 0.82));
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Não foi possível preparar a imagem.");
      if (isHeicLike(file)) throw lastError;
      break;
    }
  }

  if (
    lastPrepared &&
    lastPrepared.size > 0 &&
    lastPrepared.size <= HARD_MAX_UPLOAD_BYTES
  ) {
    return lastPrepared;
  }

  if (lastError) throw lastError;

  throw new Error(
    `A foto ${file.name} continua grande demais após comprimir. Tente JPG menor.`,
  );
}
