/** Chave da conversa: anúncio isolado vs resto do site. */

export function chatPageKey(pathname: string | null | undefined): string {
  if (!pathname) return "site";
  const path = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
  if (path.startsWith("/estoque/") && path !== "/estoque") {
    return `vehicle:${path}`;
  }
  return "site";
}

export function isVehicleChatPage(pathname: string | null | undefined): boolean {
  return chatPageKey(pathname).startsWith("vehicle:");
}
