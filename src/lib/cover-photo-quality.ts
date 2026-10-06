export type CoverAssessment = { width: number; height: number; warnings: string[] };

/** Apenas sinais para revisão humana, nunca um bloqueio de publicação. */
export function assessCoverPhoto(width: number, height: number, pixels: Uint8ClampedArray, sampleWidth: number, sampleHeight: number): CoverAssessment {
  const warnings: string[] = [];
  if (Math.min(width, height * 4 / 3) < 480 || Math.min(height, width * 3 / 4) < 360) {
    warnings.push("Imagem pequena para o recorte da capa. Se você tiver uma foto maior, vale usar essa versão.");
  }
  const count = sampleWidth * sampleHeight;
  if (count < 16 || pixels.length < count * 4) return { width, height, warnings };
  const luminance = new Float32Array(count);
  let sum = 0, square = 0, dark = 0;
  for (let i = 0; i < count; i++) {
    const value = .2126 * pixels[i * 4] + .7152 * pixels[i * 4 + 1] + .0722 * pixels[i * 4 + 2];
    luminance[i] = value; sum += value; square += value * value;
    if (value < 40) dark++;
  }
  const mean = sum / count;
  if (mean < 35 && dark / count > .7) {
    warnings.push("Boa parte da foto tem pouca luz. Confira se o veículo está fácil de enxergar.");
  }
  let edges = 0, edgeSquare = 0, samples = 0;
  for (let y = 1; y < sampleHeight - 1; y++) for (let x = 1; x < sampleWidth - 1; x++) {
    const i = y * sampleWidth + x;
    const value = luminance[i - 1] + luminance[i + 1] + luminance[i - sampleWidth] + luminance[i + sampleWidth] - 4 * luminance[i];
    edges += value; edgeSquare += value * value; samples++;
  }
  const contrast = Math.sqrt(Math.max(0, square / count - mean * mean));
  const detail = samples ? edgeSquare / samples - (edges / samples) ** 2 : 0;
  if (contrast > 18 && detail < 8 && mean >= 35 && mean <= 220) {
    warnings.push("Há um sinal de pouco detalhe. Confira a nitidez do veículo; esse aviso também pode aparecer em fotos com fundo liso.");
  }
  return { width, height, warnings };
}
