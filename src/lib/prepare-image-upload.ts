/**
 * Prepara imagens no navegador antes do upload: redimensiona e comprime
 * (WebP quando o browser permite, senão JPEG) para ficar leve no site.
 */

const MAX_EDGE = 1400;
const WEBP_QUALITY = 0.72;
const JPEG_QUALITY = 0.74;
const MAX_OUTPUT_BYTES = 1.2 * 1024 * 1024;

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
      reject(new Error("Não foi possível ler a imagem."));
    };
    image.src = url;
  });
}

async function canvasFromFile(file: File): Promise<HTMLCanvasElement> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
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
  } catch {
    const image = await loadImageFromBlob(file);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
}

function canvasToFile(canvas: HTMLCanvasElement, baseName: string): Promise<File> {
  const useWebp = supportsWebp();
  const mime = useWebp ? "image/webp" : "image/jpeg";
  const quality = useWebp ? WEBP_QUALITY : JPEG_QUALITY;
  const ext = useWebp ? ".webp" : ".jpg";

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Falha ao comprimir a imagem."));
          return;
        }
        const name = baseName.replace(/\.[^.]+$/, "") + ext;
        resolve(new File([blob], name, { type: mime }));
      },
      mime,
      quality,
    );
  });
}

/** Devolve arquivo leve para `/api/upload`. */
export async function prepareImageForUpload(file: File): Promise<File> {
  try {
    const canvas = await canvasFromFile(file);
    const prepared = await canvasToFile(canvas, file.name);
    if (prepared.size > 0 && prepared.size <= MAX_OUTPUT_BYTES * 1.5) {
      return prepared;
    }
    if (!isHeicLike(file) && file.size <= prepared.size) return file;
    return prepared;
  } catch (error) {
    if (isHeicLike(file)) return file;
    throw error instanceof Error
      ? error
      : new Error("Não foi possível preparar a imagem.");
  }
}
