/**
 * Funções puras para parsing seguro de parâmetros de paginação do painel admin.
 * Aceita string, string[] (usa o primeiro elemento), undefined ou outros tipos.
 * Valores inválidos (NaN, Infinity, negativos, zero, decimais e vazio) viram
 * inteiros positivos válidos (trunca decimais, aplica default e teto).
 */

function extractFirstValue(raw: unknown): unknown {
  if (Array.isArray(raw)) {
    return raw.length > 0 ? raw[0] : undefined;
  }
  return raw;
}

function parsePositiveInteger(raw: unknown): number | null {
  const value = extractFirstValue(raw);
  if (value === null || value === undefined) return null;

  let num: number;
  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    num = Number(trimmed);
  } else {
    return null;
  }

  if (!Number.isFinite(num) || Number.isNaN(num)) return null;

  const truncated = Math.trunc(num);
  if (truncated <= 0) return null;

  return truncated;
}

/**
 * Converte parâmetro de página em inteiro positivo finito (default 1).
 */
export function parseAdminPage(raw: unknown, max?: number): number {
  const page = parsePositiveInteger(raw) ?? 1;
  if (typeof max === "number" && Number.isFinite(max) && max > 0) {
    return Math.min(page, Math.trunc(max));
  }
  return page;
}

/**
 * Converte parâmetro de tamanho de página em inteiro positivo finito.
 * Aplica fallback em caso inválido e limita ao teto (max).
 */
export function parseAdminPageSize(raw: unknown, fallback: number, max: number): number {
  const safeMax = typeof max === "number" && Number.isFinite(max) && max > 0 ? Math.trunc(max) : 100;
  const safeFallback = Math.min(
    Math.max(1, typeof fallback === "number" && Number.isFinite(fallback) ? Math.trunc(fallback) : 20),
    safeMax,
  );

  const parsed = parsePositiveInteger(raw);
  if (parsed === null) {
    return safeFallback;
  }

  return Math.min(parsed, safeMax);
}
