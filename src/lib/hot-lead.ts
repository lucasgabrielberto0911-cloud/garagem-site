import { site } from "./site";
import { extractVehicleIdFromParam } from "./vehicle-slug";

export const HOT_LEAD_STORAGE_KEY = "garagem:ultimos-carros-vistos";
export const HOT_LEAD_CHANGE_EVENT = "garagem:ultimos-carros-vistos-alterados";
export const HOT_LEAD_STORAGE_LIMIT = 5;
export const HOT_LEAD_MESSAGE_LIMIT = 2;

const ALSO_VIEWED_PREFIX = "Também olhei: ";
const ORIGIN_TAG_LINE_RE = /^\[origem:\s*.+\]$/i;
const ESTOQUE_URL_LINE_RE = /^https?:\/\/\S+\/estoque\/([^/?#\s]+)/i;

/**
 * Carro visto salvo apenas no localStorage do navegador.
 * Nunca inclui preço nem dados pessoais, e nada é enviado ao servidor, Meta ou GA4.
 */
export type HotLeadViewedCar = {
  slug: string;
  name: string;
  year: number;
  link: string;
};

export type HotLeadCarInput = {
  slug: string;
  name?: string | null;
  nome?: string | null;
  year?: number | null;
  ano?: number | null;
  link: string;
  sold?: boolean;
  status?: string | null;
};

export type HotLeadCurrentVehicleRef = {
  id?: string | null;
  slug?: string | null;
  path?: string | null;
  link?: string | null;
};

export type HotLeadStorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export const EMPTY_HOT_LEAD_CARS: readonly HotLeadViewedCar[] = Object.freeze(
  [],
);

function collapseSpaces(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

export function isHotLeadCarSold(
  input?: { sold?: boolean | null; status?: string | null } | null,
): boolean {
  if (!input) return false;
  if (input.sold === true) return true;
  return (input.status ?? "").trim().toLowerCase() === "vendido";
}

function cleanSlug(rawSlug: string): string {
  const trimmed = rawSlug.trim();
  if (!trimmed) return "";
  const withoutPrefix = trimmed.startsWith("/estoque/")
    ? trimmed.slice("/estoque/".length)
    : trimmed.replace(/^\/+/, "");
  const slug = withoutPrefix.split(/[/?#\s]/)[0]?.trim() ?? "";
  return slug;
}

function extractSlugFromPathOrUrl(value?: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/estoque/")) {
        return cleanSlug(parsed.pathname);
      }
    } catch {
      return "";
    }
    return "";
  }
  if (raw.startsWith("/estoque/")) {
    return cleanSlug(raw);
  }
  return cleanSlug(raw);
}

function normalizeFichaLink(rawLink: string, fallbackSlug: string): string {
  const baseOrigin = site.url.replace(/\/+$/, "");
  const candidate = rawLink.trim() || (fallbackSlug ? `/estoque/${fallbackSlug}` : "");
  if (!candidate) return "";

  const fullCandidate = candidate.startsWith("/")
    ? `${baseOrigin}${candidate}`
    : candidate;

  try {
    const parsed = new URL(fullCandidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    const pathname = parsed.pathname.replace(/\/+$/, "");
    if (!pathname.startsWith("/estoque/") || pathname === "/estoque") return "";
    return `${parsed.origin}${pathname}`;
  } catch {
    return "";
  }
}

function sanitizeCarName(rawName: string, year: number): string {
  let clean = collapseSpaces(rawName);
  if (!clean) return "";
  // Garante que nunca entre preço do outro carro no nome salvo ou exibido.
  clean = collapseSpaces(
    clean.replace(/\bpor\s+R\$\s*[\d.,]+/gi, " ").replace(/R\$\s*[\d.,]+/gi, " "),
  );
  // Evita repetir o ano caso o nome recebido já termine com o mesmo ano.
  const trailingYearRe = new RegExp(`(?:\\s*·\\s*|\\s+)${year}$`);
  clean = collapseSpaces(clean.replace(trailingYearRe, ""));
  if (!clean || /^\d{4}$/.test(clean)) return "";
  return clean;
}

export function normalizeHotLeadCar(
  raw: unknown,
): HotLeadViewedCar | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<HotLeadCarInput> & Record<string, unknown>;
  if (isHotLeadCarSold(candidate)) return null;

  const rawSlug = typeof candidate.slug === "string" ? candidate.slug : "";
  const rawLink = typeof candidate.link === "string" ? candidate.link : "";
  const slug = cleanSlug(rawSlug);
  if (!slug) return null;

  const rawYear = candidate.year ?? candidate.ano;
  if (
    typeof rawYear !== "number" ||
    !Number.isInteger(rawYear) ||
    rawYear < 1900 ||
    rawYear > 2100
  ) {
    return null;
  }

  const rawName =
    typeof candidate.name === "string"
      ? candidate.name
      : typeof candidate.nome === "string"
        ? candidate.nome
        : "";
  const name = sanitizeCarName(rawName, rawYear);
  if (!name) return null;

  const link = normalizeFichaLink(rawLink, "");
  if (!link) return null;

  return {
    slug,
    name,
    year: rawYear,
    link,
  };
}

function matchesVehicleIdentity(
  car: HotLeadViewedCar,
  target: { slug: string; id: string | null; link: string },
): boolean {
  if (target.slug && car.slug.toLowerCase() === target.slug.toLowerCase()) {
    return true;
  }
  if (target.link && car.link.toLowerCase() === target.link.toLowerCase()) {
    return true;
  }
  const carId = extractVehicleIdFromParam(car.slug);
  if (target.id && carId && carId.toLowerCase() === target.id.toLowerCase()) {
    return true;
  }
  return false;
}

function resolveIdentity(ref?: HotLeadCurrentVehicleRef | null): {
  slug: string;
  id: string | null;
  link: string;
} {
  const slug =
    cleanSlug(ref?.slug ?? "") ||
    extractSlugFromPathOrUrl(ref?.path) ||
    extractSlugFromPathOrUrl(ref?.link);
  const explicitId = (ref?.id ?? "").trim();
  const id =
    explicitId ||
    (slug ? extractVehicleIdFromParam(slug) : null);
  const link = ref?.link
    ? normalizeFichaLink(ref.link, slug)
    : ref?.path
      ? normalizeFichaLink(ref.path, slug)
      : "";
  return { slug, id: id || null, link };
}

/** Lê e higieniza o JSON do localStorage (até 5, sem duplicar, sem vendidos). */
export function parseHotLeadViewedCars(raw: string | null): HotLeadViewedCar[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: HotLeadViewedCar[] = [];
    for (const item of parsed) {
      const normalized = normalizeHotLeadCar(item);
      if (!normalized) continue;
      const identity = resolveIdentity({
        slug: normalized.slug,
        link: normalized.link,
      });
      if (result.some((existing) => matchesVehicleIdentity(existing, identity))) {
        continue;
      }
      result.push(normalized);
      if (result.length >= HOT_LEAD_STORAGE_LIMIT) break;
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Atualiza a lista de carros vistos (mais recente primeiro, sem duplicar, até 5).
 * Se o carro informado estiver vendido, não adiciona e remove eventual registro anterior dele.
 */
export function withHotLeadViewedCar(
  current: readonly HotLeadViewedCar[],
  input: HotLeadCarInput,
): HotLeadViewedCar[] {
  const base = parseHotLeadViewedCars(JSON.stringify(current ?? []));
  const targetIdentity = resolveIdentity({
    slug: input.slug,
    link: input.link,
  });

  if (isHotLeadCarSold(input)) {
    return base
      .filter((item) => !matchesVehicleIdentity(item, targetIdentity))
      .slice(0, HOT_LEAD_STORAGE_LIMIT);
  }

  const normalized = normalizeHotLeadCar(input);
  if (!normalized) return base.slice(0, HOT_LEAD_STORAGE_LIMIT);

  const normalizedIdentity = resolveIdentity({
    slug: normalized.slug,
    link: normalized.link,
  });

  return [
    normalized,
    ...base.filter((item) => !matchesVehicleIdentity(item, normalizedIdentity)),
  ].slice(0, HOT_LEAD_STORAGE_LIMIT);
}

/**
 * Seleciona até 2 outros carros vistos para incluir depois do carro atual na mensagem da ficha.
 * Exclui o próprio carro atual, carros vendidos e duplicados.
 */
export function selectOtherViewedCars(
  cars: readonly (HotLeadViewedCar | HotLeadCarInput)[] | null | undefined,
  current?: HotLeadCurrentVehicleRef | null,
): HotLeadViewedCar[] {
  if (!cars || cars.length === 0) return [];
  const currentIdentity = resolveIdentity(current);
  const selected: HotLeadViewedCar[] = [];

  for (const raw of cars) {
    const normalized = normalizeHotLeadCar(raw);
    if (!normalized) continue;
    if (matchesVehicleIdentity(normalized, currentIdentity)) continue;
    const itemIdentity = resolveIdentity({
      slug: normalized.slug,
      link: normalized.link,
    });
    if (selected.some((existing) => matchesVehicleIdentity(existing, itemIdentity))) {
      continue;
    }
    selected.push(normalized);
    if (selected.length >= HOT_LEAD_MESSAGE_LIMIT) break;
  }

  return selected;
}

/** Formata um outro carro visto sem preço: `'Também olhei: <nome> <ano> <link>'`. */
export function formatAlsoViewedCarLine(car: HotLeadViewedCar): string {
  return `${ALSO_VIEWED_PREFIX}${car.name} ${car.year} ${car.link}`;
}

/**
 * Insere de forma idempotente até 2 linhas `'Também olhei: <nome> <ano> <link>'`
 * depois do carro atual (e antes da tag `[origem: ...]` no fim, quando presente).
 */
export function withHotLeadAlsoViewed(
  text: string,
  alsoViewed?: readonly (HotLeadViewedCar | HotLeadCarInput)[] | null,
  current?: HotLeadCurrentVehicleRef | null,
): string {
  const baseLines = text
    .split("\n")
    .filter((line) => !line.startsWith(ALSO_VIEWED_PREFIX));

  const fichaUrlLine = baseLines.find((line) =>
    ESTOQUE_URL_LINE_RE.test(line.trim()),
  );
  const resolvedCurrent: HotLeadCurrentVehicleRef = {
    ...current,
    link: current?.link || fichaUrlLine?.trim() || undefined,
  };

  const others = selectOtherViewedCars(alsoViewed, resolvedCurrent);
  if (others.length === 0) {
    return baseLines.join("\n");
  }

  const extraLines = others.map(formatAlsoViewedCarLine);
  const lastLine = baseLines[baseLines.length - 1]?.trim() ?? "";
  if (ORIGIN_TAG_LINE_RE.test(lastLine)) {
    return [
      ...baseLines.slice(0, -1),
      ...extraLines,
      baseLines[baseLines.length - 1]!,
    ].join("\n");
  }

  return [...baseLines, ...extraLines].join("\n");
}

/** Atualiza o parâmetro `text` de um link `wa.me` preservando `%20` e UTMs. */
export function applyHotLeadAlsoViewed(
  href: string,
  alsoViewed?: readonly (HotLeadViewedCar | HotLeadCarInput)[] | null,
  current?: HotLeadCurrentVehicleRef | null,
): string {
  try {
    const url = new URL(href);
    if (url.hostname !== "wa.me") return href;
    const text = url.searchParams.get("text");
    if (!text) return href;
    const updated = withHotLeadAlsoViewed(text, alsoViewed, current);
    if (updated === text) return href;
    return href.replace(
      /([?&]text=)[^&#]*/,
      (_, prefix: string) => prefix + encodeURIComponent(updated),
    );
  } catch {
    return href;
  }
}

function getSafeBrowserStorage(
  explicitStorage?: HotLeadStorageLike | null,
): HotLeadStorageLike | null {
  if (explicitStorage !== undefined) return explicitStorage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function notifyHotLeadChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(HOT_LEAD_CHANGE_EVENT));
  } catch {
    /* Ambiente sem CustomEvent/Event ou bloqueado */
  }
}

export function readHotLeadViewedCars(
  explicitStorage?: HotLeadStorageLike | null,
): HotLeadViewedCar[] {
  const storage = getSafeBrowserStorage(explicitStorage);
  if (!storage) return [];
  try {
    return parseHotLeadViewedCars(storage.getItem(HOT_LEAD_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function rememberHotLeadViewedCar(
  input: HotLeadCarInput,
  explicitStorage?: HotLeadStorageLike | null,
): HotLeadViewedCar[] {
  const storage = getSafeBrowserStorage(explicitStorage);
  if (!storage) return [];
  try {
    const current = parseHotLeadViewedCars(
      storage.getItem(HOT_LEAD_STORAGE_KEY),
    );
    const next = withHotLeadViewedCar(current, input);
    storage.setItem(HOT_LEAD_STORAGE_KEY, JSON.stringify(next));
    if (explicitStorage === undefined) {
      notifyHotLeadChanged();
    }
    return next;
  } catch {
    /* Modo privado / QuotaExceededError / SecurityError: falha silenciosa sem quebrar a ficha */
    return [];
  }
}

export function clearHotLeadViewedCars(
  explicitStorage?: HotLeadStorageLike | null,
): void {
  const storage = getSafeBrowserStorage(explicitStorage);
  if (!storage) return;
  try {
    storage.removeItem(HOT_LEAD_STORAGE_KEY);
    if (explicitStorage === undefined) {
      notifyHotLeadChanged();
    }
  } catch {
    /* Ignora bloqueio de armazenamento */
  }
}

let snapshotCachedRaw: string | null | undefined = undefined;
let snapshotCachedCars: readonly HotLeadViewedCar[] = EMPTY_HOT_LEAD_CARS;

export function getHotLeadCarsSnapshot(): readonly HotLeadViewedCar[] {
  const storage = getSafeBrowserStorage();
  if (!storage) return EMPTY_HOT_LEAD_CARS;
  try {
    const raw = storage.getItem(HOT_LEAD_STORAGE_KEY);
    if (raw === snapshotCachedRaw) {
      return snapshotCachedCars;
    }
    snapshotCachedRaw = raw;
    const parsed = parseHotLeadViewedCars(raw);
    snapshotCachedCars = parsed.length > 0 ? parsed : EMPTY_HOT_LEAD_CARS;
    return snapshotCachedCars;
  } catch {
    return EMPTY_HOT_LEAD_CARS;
  }
}

export function getHotLeadServerSnapshot(): readonly HotLeadViewedCar[] {
  return EMPTY_HOT_LEAD_CARS;
}

export function subscribeHotLeadCars(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(HOT_LEAD_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(HOT_LEAD_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
