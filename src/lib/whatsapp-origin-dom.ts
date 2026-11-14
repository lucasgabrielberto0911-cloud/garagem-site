import { applyWhatsAppOrigin, type LeadOrigin } from "./lead-origin";

const SITE_WHATSAPP_RE = /[?&]utm_source=site(?:&|$)/;

/** Identifica links wa.me com utm_source=site (CTAs públicos da loja), deixando compartilhamentos bare intactos. */
export function isSiteWhatsAppHref(href: string): boolean {
  return Boolean(href) && SITE_WHATSAPP_RE.test(href);
}

/** Atualiza o href de um link wa.me do site quando a origem muda (ou remove quando origin é null). */
export function enrichWhatsAppAnchor(anchor: { href: string }, origin: LeadOrigin | null): boolean {
  if (!isSiteWhatsAppHref(anchor.href)) return false;
  const updated = applyWhatsAppOrigin(anchor.href, origin);
  if (updated === anchor.href) return false;
  anchor.href = updated;
  return true;
}

/** Percorre todos os links fornecidos e atualiza os elegíveis de forma idempotente. */
export function enrichWhatsAppAnchors(anchors: Iterable<{ href: string }>, origin: LeadOrigin | null): number {
  let count = 0;
  for (const anchor of anchors) {
    if (enrichWhatsAppAnchor(anchor, origin)) count += 1;
  }
  return count;
}
