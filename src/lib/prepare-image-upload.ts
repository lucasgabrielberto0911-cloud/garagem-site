/**
 * Prepara imagens no navegador antes do upload: redimensiona, comprime em JPEG
 * e tenta converter HEIC (Safari). Assim evitamos estourar o limite de body
 * da Vercel (~4,5 MB) e falhas de "conexão".
 */

const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.85;
const MAX_OUTPUT_BYTES = 3.5 * 1024 * 1024;

function isHeicLike(file: File) {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  return /\.(heic|heif)$/i.test(file.name);
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
  // Preferível: decode nativo (Safari costuma abrir HEIC).
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

function canvasToJpegFile(canvas: HTMLCanvasElement, baseName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Falha ao comprimir a imagem."));
          return;
        }
        const name = baseName.replace(/\.[^.]+$/, "") + ".jpg";
        resolve(new File([blob], name, { type: "image/jpeg" }));
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

/**
 * Devolve um arquivo pronto para `/api/upload`.
 * Se não der para decodificar HEIC no browser, devolve o original (servidor tenta).
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  const alreadySmallJpeg =
    file.type === "image/jpeg" && file.size <= MAX_OUTPUT_BYTES;

  if (alreadySmallJpeg) {
    // Ainda pode ser enorme em pixels; comprime se necessário via canvas.
  }

  try {
    const canvas = await canvasFromFile(file);
    const prepared = await canvasToJpegFile(canvas, file.name);
    if (prepared.size > 0 && prepared.size <= Math.max(file.size, MAX_OUTPUT_BYTES)) {
      return prepared;
    }
    // Se a compressão ficou pior e não é HEIC, mantém o original.
    if (!isHeicLike(file) && file.size <= MAX_OUTPUT_BYTES) return file;
    return prepared;
  } catch (error) {
    if (isHeicLike(file)) {
      // Chrome etc. não decodificam HEIC — deixa o servidor converter.
      return file;
    }
    throw error instanceof Error
      ? error
      : new Error("Não foi possível preparar a imagem.");
  }
}
