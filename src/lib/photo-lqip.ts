import { unstable_cache } from "next/cache";
import sharp from "sharp";
import { e2ePhotoFixture } from "./e2e-photo-fixture";
import {
  getCachedPhotoLqip,
  isAllowedLqipUrl,
  isValidLqipDataUri,
  lqipSourceUrl,
  setCachedPhotoLqip,
} from "./photo-lqip-cache";
import type { VehicleCardRecord } from "./stock-query";

/**
 * Gera prévia borrada inline (LQIP) no servidor a partir da miniatura existente.
 *
 * Fontes técnicas:
 * - Image Load Lab (LQIP size): https://imageloadlab.com/lqip-blur-placeholder-size/
 *   (WebP 16×12 q40 gera data URI de ~160–300 chars; leve o bastante para ir inline no HTML)
 * - Image Load Lab (LQIP e LCP): https://imageloadlab.com/lcp-blur-placeholder-swap/
 *   (placeholder como fundo CSS por baixo do <img> real mantém o LCP na foto real)
 * - web.dev (Optimize LCP / Fetch Priority): https://web.dev/articles/optimize-lcp
 *   e https://web.dev/articles/fetch-priority
 *
 * ATENÇÃO: importa `sharp`. Usar apenas em Server Components/rotas onde `sharp`
 * é permitido — nunca importar em `/api/estoque/**` nem `/api/veiculos/**`.
 */

export const LQIP_WIDTH = 16;
export const LQIP_HEIGHT = 12;
export const LQIP_QUALITY = 40;
export const DEFAULT_LQIP_TIMEOUT_MS = 1500;
export const MAX_LQIP_SOURCE_BYTES = 2 * 1024 * 1024;
export const DEFAULT_LQIP_CARD_LIMIT = 16;
/** URLs das capas são imutáveis (timestamp/uuid ou sufixo de recorte): 30 dias de cache. */
const LQIP_CACHE_REVALIDATE_SECONDS = 60 * 60 * 24 * 30;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/gif",
]);

class LqipMissError extends Error {
  constructor() {
    super("LQIP indisponível");
    this.name = "LqipMissError";
  }
}

/** Converte um buffer de imagem em data URI WebP 16×12 q40. */
export async function lqipFromImageBuffer(input: Buffer | Uint8Array): Promise<string> {
  const bytes = await sharp(input, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(LQIP_WIDTH, LQIP_HEIGHT, { fit: "cover" })
    .webp({ quality: LQIP_QUALITY, effort: 4 })
    .toBuffer();
  return `data:image/webp;base64,${bytes.toString("base64")}`;
}

async function readBoundedBuffer(response: Response, maxBytes: number): Promise<Buffer | null> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) {
    const raw = Buffer.from(await response.arrayBuffer());
    return raw.byteLength > 0 && raw.byteLength <= maxBytes ? raw : null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) return null;
  return Buffer.concat(chunks, total);
}

export type GeneratePhotoLqipOptions = {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  skipCache?: boolean;
};

/**
 * Baixa a miniatura da origem permitida (timeout curto), gera o LQIP em WebP
 * 16×12 e guarda no cache em memória. Qualquer falha devolve `undefined`.
 */
export async function generatePhotoLqip(
  url: string | null | undefined,
  options?: GeneratePhotoLqipOptions,
): Promise<string | undefined> {
  if (!url || !isAllowedLqipUrl(url)) return undefined;

  if (!options?.skipCache) {
    const cached = getCachedPhotoLqip(url);
    if (cached) return cached;
  }

  try {
    let sourceBuffer: Buffer | null = null;

    if (!options?.fetcher) {
      // No E2E local, evita qualquer egresso de rede usando a fixture versionada.
      const fixture = await e2ePhotoFixture();
      if (fixture) sourceBuffer = fixture;
    }

    if (!sourceBuffer) {
      const fetcher = options?.fetcher ?? fetch;
      const timeoutMs = Math.max(50, options?.timeoutMs ?? DEFAULT_LQIP_TIMEOUT_MS);
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new DOMException("Tempo esgotado", "TimeoutError")),
        timeoutMs,
      );
      try {
        const response = await fetcher(url, {
          method: "GET",
          redirect: "error",
          cache: "force-cache",
          headers: { Accept: "image/webp,image/jpeg,image/png" },
          signal: controller.signal,
        });
        if (!response.ok) {
          await response.body?.cancel();
          return undefined;
        }
        const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
        if (contentType && !ALLOWED_IMAGE_TYPES.has(contentType)) {
          await response.body?.cancel();
          return undefined;
        }
        sourceBuffer = await readBoundedBuffer(response, MAX_LQIP_SOURCE_BYTES);
      } finally {
        clearTimeout(timer);
      }
    }

    if (!sourceBuffer) return undefined;
    const dataUri = await lqipFromImageBuffer(sourceBuffer);
    if (!isValidLqipDataUri(dataUri)) return undefined;
    setCachedPhotoLqip(url, dataUri);
    return dataUri;
  } catch {
    return undefined;
  }
}

const loadPhotoLqipCached = unstable_cache(
  async (url: string): Promise<string> => {
    const generated = await generatePhotoLqip(url);
    // Falhas transitórias lançam erro para o Next não persistir "vazio" por 30 dias.
    if (!generated) throw new LqipMissError();
    return generated;
  },
  ["photo-lqip-v1"],
  { revalidate: LQIP_CACHE_REVALIDATE_SECONDS },
);

/** Busca LQIP no cache em memória, depois no Data Cache do Next (30 dias). */
export async function getPhotoLqip(url: string | null | undefined): Promise<string | undefined> {
  if (!url || !isAllowedLqipUrl(url)) return undefined;
  const cached = getCachedPhotoLqip(url);
  if (cached) return cached;
  try {
    const dataUri = await loadPhotoLqipCached(url);
    if (isValidLqipDataUri(dataUri)) {
      setCachedPhotoLqip(url, dataUri);
      return dataUri;
    }
    return undefined;
  } catch (error) {
    if (error instanceof LqipMissError) return undefined;
    // Fora do runtime do Next (ex.: testes ou scripts), cai na geração direta com cache em memória.
    return generatePhotoLqip(url);
  }
}

/**
 * Enriquece os cards renderizados no servidor com LQIP em paralelo, limitado
 * aos primeiros `limit` veículos para proteger o tempo de resposta SSR.
 */
export async function enrichVehiclesWithLqip<T extends VehicleCardRecord>(
  vehicles: T[],
  options?: { limit?: number; resolver?: (url: string) => Promise<string | undefined> },
): Promise<T[]> {
  if (vehicles.length === 0) return vehicles;
  const limit = Math.max(0, options?.limit ?? DEFAULT_LQIP_CARD_LIMIT);
  if (limit === 0) return vehicles;

  const resolve = options?.resolver ?? getPhotoLqip;
  const sliceCount = Math.min(limit, vehicles.length);

  const resolved = await Promise.all(
    vehicles.slice(0, sliceCount).map(async (vehicle) => {
      const source = lqipSourceUrl(vehicle.photos);
      if (!source) return undefined;
      return resolve(source);
    }),
  );

  let changed = false;
  const enriched = vehicles.map((vehicle, index) => {
    const lqip = index < sliceCount ? resolved[index] : undefined;
    if (!lqip || !vehicle.photos?.[0]) return vehicle;
    changed = true;
    const [first, ...rest] = vehicle.photos;
    return {
      ...vehicle,
      photos: [{ ...first, lqip }, ...rest],
    };
  });

  return changed ? enriched : vehicles;
}
