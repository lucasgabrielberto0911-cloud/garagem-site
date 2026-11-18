import {
  adminStorageJpgPath,
  archivePhotoFilename,
  archiveZipFilename,
} from "@/lib/photo-archive";
import { buildZipStore, type ZipEntry } from "@/lib/zip-store";

export const PHOTO_ZIP_FAILURES_HEADER = "X-Photo-Zip-Failures";
export const PHOTO_ZIP_COUNTS_HEADER = "X-Photo-Zip-Counts";
export const PHOTO_ZIP_BATCH_HEADER = "X-Admin-Zip-Batch";
export const PHOTO_ZIP_REPORT_FILENAME = "FALHAS.txt";

export const DEFAULT_PHOTO_FETCH_TIMEOUT_MS = 10_000;
export const DEFAULT_PHOTO_RETRIES = 1;
export const DEFAULT_PHOTO_RETRY_DELAY_MS = 250;

export type PhotoZipVehicleInfo = {
  brand: string;
  model: string;
  year: number;
};

export type PhotoZipSourceItem = {
  id?: string;
  url: string;
};

export type PhotoZipFailure = {
  /** Posição 1-based da foto na ordem do anúncio. */
  index: number;
  /** Nome esperado do arquivo no acervo/ZIP (ex.: fiat-argo-2021-02.jpg). */
  filename: string;
  /** Motivo curto e seguro para exibir na tela e gravar no FALHAS.txt. */
  reason: string;
};

export type PhotoLoadAttemptOutcome =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: string };

export type BuildResilientPhotoZipResult =
  | {
      ok: true;
      zip: Uint8Array;
      zipFilename: string;
      totalCount: number;
      downloadedCount: number;
      failures: PhotoZipFailure[];
    }
  | {
      ok: false;
      error: string;
      totalCount: number;
      failures: PhotoZipFailure[];
    };

/**
 * Converte erros e respostas em motivo curto em português,
 * sem vazar URLs internas, tokens ou chaves.
 */
export function sanitizeFailureReason(raw: unknown): string {
  if (raw instanceof Error) {
    if (raw.name === "AbortError" || raw.name === "TimeoutError") {
      return "Tempo esgotado";
    }
  }

  const text = (
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : ""
  )
    .replace(/https?:\/\/\S+/gi, "")
    .replace(
      /\b(?:authorization\s*:\s*(?:bearer\s+)?\S+|bearer\s+\S+|(?:token|key|password|secret)\s*[=:]\s*\S+)/gi,
      "[redigido]",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "Falha ao baixar";

  if (/tempo esgotado|timed?\s*out|aborted|timeout/i.test(text)) {
    return "Tempo esgotado";
  }
  if (/404|not\s*found|n[aã]o\s+encontrad/i.test(text)) {
    return "Foto não encontrada";
  }
  if (/401|403|n[aã]o\s+autorizad|sess[aã]o/i.test(text)) {
    return "Sessão expirada ou sem permissão";
  }
  if (/vazi[oa]|empty|0\s*bytes/i.test(text)) {
    return "Arquivo vazio";
  }
  if (
    /fetch\s+failed|network\s*error|failed\s+to\s+fetch|econnrefused|enotfound|econnreset|socket\s+hang\s+up/i.test(
      text,
    )
  ) {
    return "Falha de conexão";
  }

  const clean = text.replace(/[.]+$/, "").trim();
  if (!clean) return "Falha ao baixar";
  return clean.length > 72 ? `${clean.slice(0, 69).trimEnd()}…` : clean;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa o carregamento de uma foto com timeout por tentativa e 1 retry por padrão.
 */
export async function loadPhotoWithRetry(
  loader: (signal: AbortSignal) => Promise<PhotoLoadAttemptOutcome>,
  options?: {
    retries?: number;
    timeoutMs?: number;
    retryDelayMs?: number;
  },
): Promise<PhotoLoadAttemptOutcome> {
  const retries = Math.max(0, options?.retries ?? DEFAULT_PHOTO_RETRIES);
  const timeoutMs = Math.max(20, options?.timeoutMs ?? DEFAULT_PHOTO_FETCH_TIMEOUT_MS);
  const retryDelayMs = Math.max(0, options?.retryDelayMs ?? DEFAULT_PHOTO_RETRY_DELAY_MS);

  let lastReason = "Falha ao baixar";

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0 && retryDelayMs > 0) {
      await sleep(retryDelayMs);
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeoutPromise = new Promise<PhotoLoadAttemptOutcome>((resolve) => {
        timer = setTimeout(() => {
          controller.abort(new DOMException("Tempo esgotado", "TimeoutError"));
          resolve({ ok: false, reason: "Tempo esgotado" });
        }, timeoutMs);
      });

      const outcome = await Promise.race([
        loader(controller.signal),
        timeoutPromise,
      ]);

      if (outcome.ok) {
        if (outcome.bytes.byteLength === 0) {
          lastReason = "Arquivo vazio";
        } else {
          return outcome;
        }
      } else {
        lastReason = sanitizeFailureReason(outcome.reason);
      }
    } catch (error) {
      lastReason = controller.signal.aborted
        ? "Tempo esgotado"
        : sanitizeFailureReason(error);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  return { ok: false, reason: lastReason };
}

export function formatPhotoNumber(index: number): string {
  return String(Math.max(1, index)).padStart(2, "0");
}

/** Gera o texto de FALHAS.txt incluído no ZIP quando há falha parcial. */
export function formatPhotoZipFailuresReport(input: {
  totalCount: number;
  downloadedCount: number;
  failures: PhotoZipFailure[];
}): string {
  const failedCount = input.failures.length;
  const header = [
    "Aviso de download parcial — Garagem",
    `Fotos incluídas no ZIP: ${input.downloadedCount} de ${input.totalCount}.`,
    failedCount === 1
      ? "1 foto não pôde ser baixada após nova tentativa:"
      : `${failedCount} fotos não puderam ser baixadas após nova tentativa:`,
    "",
  ];

  const lines = input.failures.map(
    (item) =>
      `- Foto ${formatPhotoNumber(item.index)} (${item.filename}): ${item.reason}`,
  );

  return [...header, ...lines, ""].join("\n");
}

/** Mensagem clara quando todas as fotos do anúncio falham. */
export function formatAllPhotosFailedMessage(
  totalCount: number,
  failures: PhotoZipFailure[],
): string {
  if (totalCount <= 0) {
    return "Este anúncio ainda não tem fotos.";
  }

  if (totalCount === 1) {
    const first = failures[0];
    const detail = first ? ` (${first.filename}: ${first.reason})` : "";
    return `Não foi possível baixar a foto do anúncio${detail}. Tente novamente.`;
  }

  const preview = failures
    .slice(0, 3)
    .map(
      (item) => `foto ${formatPhotoNumber(item.index)}: ${item.reason}`,
    )
    .join("; ");
  const more =
    failures.length > 3 ? `; e mais ${failures.length - 3}` : "";
  const detail = preview ? ` (${preview}${more})` : "";

  return `Não foi possível gerar o ZIP: todas as ${totalCount} fotos falharam${detail}.`;
}

/** Resumo curto para toast quando o ZIP foi gerado com falhas parciais. */
export function formatPartialPhotoZipToast(input: {
  downloadedCount: number;
  totalCount: number;
  failures: PhotoZipFailure[];
}): string {
  const list = input.failures
    .slice(0, 3)
    .map((f) => `#${formatPhotoNumber(f.index)} (${f.reason})`)
    .join(", ");
  const extra =
    input.failures.length > 3 ? ` +${input.failures.length - 3}` : "";
  return `ZIP baixado (${input.downloadedCount}/${input.totalCount} fotos). Falha em: ${list}${extra}. Veja o aviso e o FALHAS.txt.`;
}

const MAX_HEADER_FAILURES = 25;

/** Codifica as falhas em ASCII puro para envio seguro em cabeçalho HTTP. */
export function encodeZipFailuresHeader(failures: PhotoZipFailure[]): string {
  const compact = failures.slice(0, MAX_HEADER_FAILURES).map((item) => ({
    index: item.index,
    filename: item.filename,
    reason: sanitizeFailureReason(item.reason),
  }));
  return encodeURIComponent(JSON.stringify(compact));
}

export function decodeZipFailuresHeader(
  header: string | null | undefined,
): PhotoZipFailure[] {
  if (!header) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(header)) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: PhotoZipFailure[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as PhotoZipFailure).index === "number" &&
        typeof (item as PhotoZipFailure).filename === "string" &&
        typeof (item as PhotoZipFailure).reason === "string"
      ) {
        out.push({
          index: (item as PhotoZipFailure).index,
          filename: (item as PhotoZipFailure).filename,
          reason: sanitizeFailureReason((item as PhotoZipFailure).reason),
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function decodeZipCountsHeader(
  header: string | null | undefined,
): { downloadedCount: number; totalCount: number } | null {
  if (!header) return null;
  const match = header.trim().match(/^(\d+)\/(\d+)$/);
  if (!match) return null;
  const downloadedCount = Number(match[1]);
  const totalCount = Number(match[2]);
  if (!Number.isFinite(downloadedCount) || !Number.isFinite(totalCount)) {
    return null;
  }
  return { downloadedCount, totalCount };
}

/**
 * Monta o ZIP mantendo estritamente a ordem e os nomes originais das fotos,
 * tentando cada foto com retry + timeout, continuando nas demais se alguma falhar
 * e incluindo FALHAS.txt quando houver falha parcial.
 */
export async function buildResilientPhotoZip(input: {
  vehicle: PhotoZipVehicleInfo;
  photos: PhotoZipSourceItem[];
  loadPhoto: (ctx: {
    photo: PhotoZipSourceItem;
    index: number;
    filename: string;
    signal: AbortSignal;
  }) => Promise<PhotoLoadAttemptOutcome>;
  retries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  concurrency?: number;
}): Promise<BuildResilientPhotoZipResult> {
  const { vehicle, photos, loadPhoto } = input;
  const totalCount = photos.length;

  if (totalCount === 0) {
    return {
      ok: false,
      error: "Este anúncio ainda não tem fotos.",
      totalCount: 0,
      failures: [],
    };
  }

  const usedNames = new Set<string>();
  const planned = photos.map((photo, idx) => {
    const index = idx + 1;
    let filename = archivePhotoFilename({
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      index,
      url: photo.url,
    });
    if (usedNames.has(filename)) {
      const suffix = photo.id ? photo.id.slice(-6) : String(index);
      filename = filename.replace(/(\.[a-z0-9]+)$/i, `-${suffix}$1`);
    }
    usedNames.add(filename);
    return { photo, index, filename };
  });

  const outcomes = new Array<PhotoLoadAttemptOutcome>(totalCount);
  const concurrency = Math.max(1, Math.min(totalCount, input.concurrency ?? 1));
  let cursor = 0;

  async function worker() {
    while (cursor < totalCount) {
      const slot = cursor++;
      const item = planned[slot]!;
      outcomes[slot] = await loadPhotoWithRetry(
        (signal) =>
          loadPhoto({
            photo: item.photo,
            index: item.index,
            filename: item.filename,
            signal,
          }),
        {
          retries: input.retries,
          timeoutMs: input.timeoutMs,
          retryDelayMs: input.retryDelayMs,
        },
      );
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const entries: ZipEntry[] = [];
  const failures: PhotoZipFailure[] = [];

  for (let i = 0; i < totalCount; i++) {
    const item = planned[i]!;
    const outcome = outcomes[i]!;
    if (outcome.ok) {
      entries.push({ name: item.filename, data: outcome.bytes });
    } else {
      failures.push({
        index: item.index,
        filename: item.filename,
        reason: outcome.reason,
      });
    }
  }

  const downloadedCount = entries.length;
  if (downloadedCount === 0) {
    return {
      ok: false,
      error: formatAllPhotosFailedMessage(totalCount, failures),
      totalCount,
      failures,
    };
  }

  if (failures.length > 0) {
    const report = formatPhotoZipFailuresReport({
      totalCount,
      downloadedCount,
      failures,
    });
    entries.push({
      name: PHOTO_ZIP_REPORT_FILENAME,
      data: new TextEncoder().encode(report),
    });
  }

  return {
    ok: true,
    zip: buildZipStore(entries),
    zipFilename: archiveZipFilename(vehicle),
    totalCount,
    downloadedCount,
    failures,
  };
}

function reasonFromHttpStatus(status: number): string {
  if (status === 404) return "Foto não encontrada";
  if (status === 401 || status === 403) return "Sessão expirada ou sem permissão";
  if (status === 408 || status === 504) return "Tempo esgotado";
  if (status === 400) return "Endereço de foto inválido";
  if (status >= 500) return `Falha no servidor (${status})`;
  return `Erro HTTP ${status}`;
}

/**
 * Cria o loader de fotos para o browser usando `/api/admin/fotos/jpg`.
 * Aceita `fetcher` injetável para testes unitários sem rede real.
 */
export function createAdminPhotoFetchLoader(
  fetcher: typeof fetch = fetch,
): (ctx: {
  photo: PhotoZipSourceItem;
  index: number;
  filename: string;
  signal: AbortSignal;
}) => Promise<PhotoLoadAttemptOutcome> {
  return async ({ photo, filename, signal }) => {
    const href = adminStorageJpgPath(photo.url, filename);
    const response = await fetcher(href, {
      credentials: "same-origin",
      headers: { [PHOTO_ZIP_BATCH_HEADER]: "1" },
      signal,
    });

    if (!response.ok) {
      let reason = "";
      try {
        const body = (await response.json()) as {
          reason?: string;
          error?: string;
        };
        reason = body.reason || body.error || "";
      } catch {
        // resposta não-JSON
      }
      return {
        ok: false,
        reason: reason
          ? sanitizeFailureReason(reason)
          : reasonFromHttpStatus(response.status),
      };
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      return { ok: false, reason: "Arquivo vazio" };
    }

    return { ok: true, bytes };
  };
}
