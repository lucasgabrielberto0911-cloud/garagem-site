export const STOCK_RETURN_KEY = "garagem:estoque-volta";

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
