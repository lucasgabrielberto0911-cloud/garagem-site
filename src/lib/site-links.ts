import { WHATSAPP_MESSAGES, site, whatsappUrl } from "@/lib/site";

/** Botão da página pública /links, editável em /admin/site. */
export type SiteLink = {
  label: string;
  href: string;
  visible: boolean;
};

export const MAX_SITE_LINKS = 20;
export const MAX_SITE_LINK_LABEL = 40;
export const MAX_SITE_LINK_HREF = 500;

/** Usados quando `SiteSettings.linksJson` ainda não existe ou nunca foi salvo. */
export const DEFAULT_LINKS: readonly SiteLink[] = [
  { label: "Ver estoque", href: "/estoque", visible: true },
  {
    label: "WhatsApp",
    href: `https://wa.me/${site.whatsappNumber}`,
    visible: true,
  },
  {
    label: "Marketplace da loja",
    href: "https://www.facebook.com/marketplace/profile/100088276301643/",
    visible: true,
  },
  {
    label: "OLX",
    href: "https://www.olx.com.br/perfil/garagem-motors-0b087f65",
    visible: true,
  },
  { label: "Instagram", href: site.instagramUrl, visible: true },
];

export type SiteLinkKind =
  | "estoque"
  | "whatsapp"
  | "facebook"
  | "olx"
  | "instagram"
  | "generic";

export function isInternalHref(href: string) {
  return href.startsWith("/");
}

/**
 * Caminho interno (`/x`, nunca `//x` nem `/\x`) ou URL http(s) completa, sem
 * credenciais. Barra `javascript:`, `data:`, `mailto:`, `tel:` e similares.
 */
export function isSafeLinkHref(raw: string): boolean {
  const href = raw.trim();
  if (!href || href.length > MAX_SITE_LINK_HREF) return false;
  // Espaço, controle e barra invertida: o navegador reinterpreta (`/\x` vira `//x`).
  if (/[\s\\\u0000-\u001f\u007f]/.test(href)) return false;
  if (href.startsWith("/")) return !href.startsWith("//");
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!url.hostname || url.username || url.password) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Leitura tolerante (banco → tela). `null` = valor ausente ou que não é lista,
 * e quem chama usa DEFAULT_LINKS. Linhas totalmente vazias somem.
 */
export function parseSiteLinks(raw: unknown): SiteLink[] | null {
  if (!Array.isArray(raw)) return null;
  const links: SiteLink[] = [];
  for (const entry of raw.slice(0, MAX_SITE_LINKS)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const label =
      typeof row.label === "string"
        ? row.label.trim().slice(0, MAX_SITE_LINK_LABEL)
        : "";
    const href = typeof row.href === "string" ? row.href.trim() : "";
    if (!label && !href) continue;
    links.push({ label, href, visible: row.visible !== false });
  }
  return links;
}

export function resolveSiteLinks(raw: unknown): SiteLink[] {
  return parseSiteLinks(raw) ?? DEFAULT_LINKS.map((link) => ({ ...link }));
}

/** O que a /links mostra: visível, com rótulo e com destino seguro. */
export function publicSiteLinks(links: readonly SiteLink[]): SiteLink[] {
  return links.filter(
    (link) =>
      link.visible && link.label.trim() !== "" && isSafeLinkHref(link.href),
  );
}

export type SiteLinksValidation =
  | { ok: true; links: SiteLink[] }
  | { ok: false; error: string };

/** Validação estrita do que o admin envia (mensagem em português para o painel). */
export function validateSiteLinks(raw: unknown): SiteLinksValidation {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Lista de links inválida. Recarregue a página." };
  }
  const links: SiteLink[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const href = typeof row.href === "string" ? row.href.trim() : "";
    const visible = row.visible !== false;
    if (!label && !href) continue;
    const name = label ? `“${label}”` : "Link sem rótulo";
    if (label.length > MAX_SITE_LINK_LABEL) {
      return {
        ok: false,
        error: `${name}: o rótulo tem no máximo ${MAX_SITE_LINK_LABEL} caracteres.`,
      };
    }
    if (visible && !label) {
      return { ok: false, error: "Todo link visível precisa de rótulo." };
    }
    if (visible && !href) {
      return {
        ok: false,
        error: `${name}: informe o endereço ou esconda o link.`,
      };
    }
    if (href && !isSafeLinkHref(href)) {
      return {
        ok: false,
        error: `${name}: use um caminho do site (ex.: /estoque) ou uma URL completa começando com http:// ou https://.`,
      };
    }
    links.push({ label, href, visible });
  }
  if (links.length > MAX_SITE_LINKS) {
    return {
      ok: false,
      error: `Use no máximo ${MAX_SITE_LINKS} links.`,
    };
  }
  return { ok: true, links };
}

function hostMatches(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** Ícone por destino (pela URL, não pelo rótulo, para sobreviver a edições). */
export function siteLinkKind(href: string): SiteLinkKind {
  if (href === "/estoque" || href.startsWith("/estoque/") || href.startsWith("/estoque?")) {
    return "estoque";
  }
  if (isInternalHref(href)) return "generic";
  try {
    const host = new URL(href).hostname.toLowerCase();
    if (host === "wa.me" || hostMatches(host, "whatsapp.com")) return "whatsapp";
    if (hostMatches(host, "facebook.com") || host === "fb.com" || host === "fb.me") {
      return "facebook";
    }
    if (hostMatches(host, "olx.com.br")) return "olx";
    if (hostMatches(host, "instagram.com")) return "instagram";
  } catch {
    // href inválido cai no ícone genérico (e nem chega ao público).
  }
  return "generic";
}

/** `https://wa.me/<número da loja>` puro, sem `?text=`. */
function isOfficialWhatsAppHref(href: string) {
  try {
    const url = new URL(href);
    return (
      url.hostname.toLowerCase() === "wa.me" &&
      url.pathname.replace(/\/+$/, "") === `/${site.whatsappNumber}` &&
      !url.searchParams.has("text")
    );
  } catch {
    return false;
  }
}

/**
 * Destino final do botão. O wa.me oficial vira o link padrão do site (mensagem
 * pronta + UTM `links`); qualquer outro URL salvo no painel é usado como está.
 */
export function siteLinkHref(link: Pick<SiteLink, "href">): string {
  if (isOfficialWhatsAppHref(link.href)) {
    return whatsappUrl(WHATSAPP_MESSAGES.general, { campaign: "links" });
  }
  return link.href;
}
