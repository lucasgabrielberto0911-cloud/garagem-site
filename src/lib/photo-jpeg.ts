import sharp from "sharp";

/**
 * Qualidade do JPEG no download (Facebook Marketplace, WhatsApp).
 * 90 fica na faixa alta pedida (85–92): a galeria já tem no máximo 1280px,
 * então o arquivo segue leve e o detalhe não amassa no Marketplace.
 * mozjpeg comprime melhor nesse patamar. A página continua servindo o WebP
 * do Storage — esta conversão só roda quando alguém baixa a foto.
 */
export const DOWNLOAD_JPEG_QUALITY = 90;

function isJpeg(bytes: Uint8Array) {
  return (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

/**
 * Converte a foto da galeria (WebP, PNG, etc.) para JPEG.
 * JPEG que já está no Storage passa direto, sem reencode.
 */
export async function toDownloadJpeg(bytes: Uint8Array): Promise<Uint8Array> {
  if (isJpeg(bytes)) return bytes;

  const encoded = await sharp(Buffer.from(bytes), { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: DOWNLOAD_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return new Uint8Array(encoded);
}
