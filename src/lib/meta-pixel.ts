export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";

export type ViewContentParams = {
  content_ids: string[];
  content_name: string;
  content_type: "vehicle" | "product";
  value: number;
  currency: "BRL";
};

export type ContactParams = {
  content_ids: string[];
  content_name: string;
};

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded?: boolean;
  version?: string;
  push: Fbq;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

function getFbq() {
  if (typeof window === "undefined") return undefined;
  return window.fbq;
}

export function trackPageView() {
  const fbq = getFbq();
  if (!fbq) return;
  fbq("track", "PageView");
}

export function trackViewContent(params: ViewContentParams) {
  const fbq = getFbq();
  if (!fbq) return;
  fbq("track", "ViewContent", {
    content_ids: params.content_ids,
    content_name: params.content_name,
    content_type: params.content_type,
    value: params.value,
    currency: params.currency,
  });
}

export function trackContact(params: ContactParams) {
  const fbq = getFbq();
  if (!fbq) return;
  fbq("track", "Contact", {
    content_ids: params.content_ids,
    content_name: params.content_name,
  });
}
