export const STOCK_RETURN_KEY = "garagem:estoque-volta";
export const STOCK_SCROLL_KEY = "garagem:estoque-scroll";

/** A listagem rola a janela. Se [data-stock-scroll] for o scrollport, usa ele. */
export function stockScrollRoot() {
  if (typeof document === "undefined") return null;
  const shell = document.querySelector("[data-stock-scroll]");
  if (!(shell instanceof HTMLElement)) return null;
  const overflow = getComputedStyle(shell).overflowY;
  if (overflow === "auto" || overflow === "scroll") return shell;
  return null;
}

export function rememberStockScroll() {
  try {
    const root = stockScrollRoot();
    const top = root ? root.scrollTop : window.scrollY;
    sessionStorage.setItem(STOCK_SCROLL_KEY, String(top));
  } catch {
    // private mode
  }
}

export function restoreStockScroll() {
  try {
    const saved = sessionStorage.getItem(STOCK_SCROLL_KEY);
    if (!saved) return;
    sessionStorage.removeItem(STOCK_SCROLL_KEY);
    const top = Number(saved);
    if (!Number.isFinite(top) || top <= 0) return;
    window.requestAnimationFrame(() => {
      const root = stockScrollRoot();
      if (root) root.scrollTop = top;
      else window.scrollTo(0, top);
    });
  } catch {
    // private mode
  }
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
