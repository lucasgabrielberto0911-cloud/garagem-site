export const STOCK_RETURN_KEY = "garagem:estoque-volta";
export const STOCK_SCROLL_KEY = "garagem:estoque-scroll";
export const STOCK_POSITION_KEY = "garagem:estoque-posicao";

export type StockPosition = {
  version: 1;
  path: string;
  href: string;
  index: number;
  page: number;
  offset: number;
  scroll: number;
  savedAt: number;
};

function stockLocation(path: string) {
  if (!path.startsWith("/estoque") || path.includes("\\")) return null;
  try {
    const url = new URL(path, "https://www.suagaragem.net");
    if (url.pathname !== "/estoque" || url.origin !== "https://www.suagaragem.net") return null;
    url.searchParams.sort();
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/** Uma posição só pertence à mesma busca e ordenação, independente da ordem da query. */
export function parseStockPosition(raw: string | null, path: string): StockPosition | null {
  try {
    if (!raw) return null;
    const value = JSON.parse(raw) as StockPosition;
    if (!value || value.version !== 1 || typeof value.path !== "string" || !stockLocation(path) ||
      stockLocation(value.path) !== stockLocation(path) ||
      typeof value.href !== "string" || !value.href.startsWith("/estoque/") || value.href.includes("\\") ||
      !Number.isInteger(value.index) || value.index < 0 ||
      !Number.isInteger(value.page) || value.page < 1 ||
      !Number.isFinite(value.offset) || !Number.isFinite(value.scroll) || value.scroll < 0 ||
      !Number.isFinite(value.savedAt)) return null;
    return value;
  } catch {
    return null;
  }
}

export function readStockPosition(path: string) {
  try {
    return parseStockPosition(sessionStorage.getItem(STOCK_POSITION_KEY), path);
  } catch {
    return null;
  }
}

/** A listagem rola a janela. Se [data-stock-scroll] for o scrollport, usa ele. */
export function stockScrollRoot() {
  if (typeof document === "undefined") return null;
  const shell = document.querySelector("[data-stock-scroll]");
  if (!(shell instanceof HTMLElement)) return null;
  const overflow = getComputedStyle(shell).overflowY;
  if (overflow === "auto" || overflow === "scroll") return shell;
  return null;
}

export function rememberStockPosition(path: string, page: number, link: HTMLAnchorElement, list: HTMLElement) {
  try {
    if (!stockLocation(path)) return;
    const root = stockScrollRoot();
    const card = link.closest(".listing-card") ?? link;
    const position: StockPosition = {
      version: 1,
      path,
      href: link.getAttribute("href") ?? "",
      index: Array.from(list.querySelectorAll("a[data-stock-card]")).indexOf(link),
      page,
      offset: card.getBoundingClientRect().top - (root?.getBoundingClientRect().top ?? 0),
      scroll: root ? root.scrollTop : window.scrollY,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(STOCK_POSITION_KEY, JSON.stringify(position));
    sessionStorage.setItem(STOCK_SCROLL_KEY, String(position.scroll));
  } catch {
    // private mode / storage blocked
  }
}

export function clearStockPosition(position?: StockPosition) {
  try {
    if (position) {
      const saved = readStockPosition(position.path);
      if (saved?.savedAt !== position.savedAt || saved.href !== position.href) return;
    }
    sessionStorage.removeItem(STOCK_POSITION_KEY);
    sessionStorage.removeItem(STOCK_SCROLL_KEY);
  } catch {
    // private mode
  }
}

/** A lista já está pronta. Ajusta pela linha do carro, incluindo alterações de fonte. */
export function restoreStockPosition(position: StockPosition, list: HTMLElement, done: () => void) {
  const root = stockScrollRoot();
  const links = Array.from(list.querySelectorAll<HTMLAnchorElement>("a[data-stock-card]"));
  const link = links.find((item) => item.getAttribute("href") === position.href) ?? links[Math.min(position.index, links.length - 1)];
  const card = link?.closest(".listing-card") ?? link;
  let frame = 0;
  let stableSince = 0;
  const started = performance.now();
  const fit = (now: number) => {
    const current = root ? root.scrollTop : window.scrollY;
    const top = card
      ? current + card.getBoundingClientRect().top - (root?.getBoundingClientRect().top ?? 0) - position.offset
      : position.scroll;
    const max = root ? root.scrollHeight - root.clientHeight : document.documentElement.scrollHeight - window.innerHeight;
    const target = Math.max(0, Math.min(max, top));
    if (Math.abs(current - target) > 1) {
      stableSince = 0;
      if (root) root.scrollTo({ top: target, behavior: "instant" });
      else window.scrollTo({ top: target, behavior: "instant" });
    } else if (!stableSince) stableSince = now;
    if ((stableSince && now - stableSince >= 200 && document.fonts.status !== "loading") || now - started >= 1500) {
      done();
      return;
    }
    frame = requestAnimationFrame(fit);
  };
  frame = requestAnimationFrame(fit);
  return () => cancelAnimationFrame(frame);
}

export function rememberStockReturn(path?: string) {
  try {
    if (!path || !path.startsWith("/estoque")) {
      sessionStorage.removeItem(STOCK_RETURN_KEY);
      return;
    }
    sessionStorage.setItem(STOCK_RETURN_KEY, path);
  } catch {
    // private mode / storage blocked
  }
}

export function readStockReturn() {
  try {
    const value = sessionStorage.getItem(STOCK_RETURN_KEY);
    if (
      !value ||
      !value.startsWith("/estoque") ||
      value.startsWith("//") ||
      value.includes("\\")
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}
