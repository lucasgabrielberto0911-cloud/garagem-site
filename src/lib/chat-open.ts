export const SITE_CHAT_OPEN_EVENT = "garagem:open-chat";

/** Texto visível e aria-label do botão que abre o chat. Nunca “pra”. */
export const CHAT_HELP_LABEL = "Ajuda para escolher";

export type SiteChatOpenRequest = {
  source: string;
  prompt?: string;
};

declare global {
  interface Window {
    __garagemChatOpenRequest?: SiteChatOpenRequest;
  }
}

export function requestSiteChat(request: SiteChatOpenRequest) {
  if (typeof window === "undefined") return;
  window.__garagemChatOpenRequest = request;
  window.dispatchEvent(
    new CustomEvent<SiteChatOpenRequest>(SITE_CHAT_OPEN_EVENT, {
      detail: request,
    }),
  );
}

export function consumeSiteChatOpenRequest() {
  if (typeof window === "undefined") return null;
  const request = window.__garagemChatOpenRequest ?? null;
  delete window.__garagemChatOpenRequest;
  return request;
}
