import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { site, whatsappUrl } from "./site";
import {
  DEFAULT_LINKS,
  MAX_SITE_LINKS,
  isSafeLinkHref,
  parseSiteLinks,
  publicSiteLinks,
  resolveSiteLinks,
  siteLinkHref,
  siteLinkKind,
  validateSiteLinks,
} from "./site-links";

test("padrão: 5 links na ordem pedida, com os destinos oficiais", () => {
  assert.deepEqual(
    DEFAULT_LINKS.map((link) => [link.label, link.href]),
    [
      ["Ver estoque", "/estoque"],
      ["WhatsApp", "https://wa.me/5527996330706"],
      [
        "Marketplace da loja",
        "https://www.facebook.com/marketplace/profile/100088276301643/",
      ],
      ["OLX", "https://www.olx.com.br/perfil/garagem-motors-0b087f65"],
      ["Instagram", site.instagramUrl],
    ],
  );
  assert.ok(DEFAULT_LINKS.every((link) => link.visible));
});

test("sem linksJson (null/ausente/não-lista) usa o padrão; lista vazia é respeitada", () => {
  for (const raw of [null, undefined, "x", {}, 3]) {
    assert.deepEqual(resolveSiteLinks(raw), [...DEFAULT_LINKS]);
  }
  assert.deepEqual(resolveSiteLinks([]), []);
});

test("não publica link escondido, sem rótulo, sem href ou com href inseguro", () => {
  const links = parseSiteLinks([
    { label: "Ok", href: "/estoque", visible: true },
    { label: "Escondido", href: "/sobre", visible: false },
    { label: "Sem href", href: "", visible: true },
    { label: "", href: "/faq", visible: true },
    { label: "Mau", href: "javascript:alert(1)", visible: true },
  ]);
  assert.ok(links);
  assert.deepEqual(
    publicSiteLinks(links).map((link) => link.label),
    ["Ok"],
  );
});

test("isSafeLinkHref aceita só /caminho e http(s)", () => {
  for (const ok of [
    "/estoque",
    "/estoque?q=civic",
    "https://www.olx.com.br/perfil/x",
    "http://example.com",
  ]) {
    assert.equal(isSafeLinkHref(ok), true, ok);
  }
  for (const bad of [
    "",
    "   ",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<b>x</b>",
    "mailto:a@b.com",
    "tel:+5527996330706",
    "//evil.com",
    "/\\evil.com",
    "estoque",
    "www.instagram.com/x",
    "ftp://x.com/a",
    "https://user:pass@evil.com",
    "https://",
    "https://a b.com",
    `https://x.com/${"a".repeat(600)}`,
  ]) {
    assert.equal(isSafeLinkHref(bad), false, bad);
  }
});

test("validateSiteLinks rejeita javascript:, vazio visível, rótulo longo e excesso", () => {
  const bad = (raw: unknown) => {
    const result = validateSiteLinks(raw);
    assert.equal(result.ok, false);
    return result.ok ? "" : result.error;
  };
  assert.match(bad([{ label: "X", href: "javascript:alert(1)", visible: true }]), /http/);
  assert.match(bad([{ label: "X", href: "javascript:alert(1)", visible: false }]), /http/);
  assert.match(bad([{ label: "X", href: "mailto:a@b.com", visible: true }]), /http/);
  assert.match(bad([{ label: "X", href: "", visible: true }]), /endereço/);
  assert.match(bad([{ label: "", href: "/estoque", visible: true }]), /rótulo/);
  assert.match(bad([{ label: "a".repeat(41), href: "/x", visible: true }]), /40/);
  assert.match(
    bad(Array.from({ length: MAX_SITE_LINKS + 1 }, (_, i) => ({ label: `L${i}`, href: "/x", visible: true }))),
    /20/,
  );
  assert.match(bad("não é lista"), /inválida/);
});

test("validateSiteLinks aceita escondido sem href, apara espaços e ignora linhas vazias", () => {
  const result = validateSiteLinks([
    { label: "  Estoque  ", href: " /estoque ", visible: true },
    { label: "Rascunho", href: "", visible: false },
    { label: "", href: "", visible: true },
    null,
  ]);
  assert.deepEqual(result, {
    ok: true,
    links: [
      { label: "Estoque", href: "/estoque", visible: true },
      { label: "Rascunho", href: "", visible: false },
    ],
  });
  assert.deepEqual(validateSiteLinks([]), { ok: true, links: [] });
});

test("ícone vem do destino, não do rótulo", () => {
  assert.equal(siteLinkKind("/estoque"), "estoque");
  assert.equal(siteLinkKind("/estoque/civic-2020"), "estoque");
  assert.equal(siteLinkKind("/sobre"), "generic");
  assert.equal(siteLinkKind("https://wa.me/5527996330706"), "whatsapp");
  assert.equal(siteLinkKind("https://www.facebook.com/marketplace/profile/1/"), "facebook");
  assert.equal(siteLinkKind("https://www.olx.com.br/perfil/x"), "olx");
  assert.equal(siteLinkKind("https://instagram.com/suagaragem1"), "instagram");
  assert.equal(siteLinkKind("https://evil.com/instagram.com"), "generic");
  assert.equal(siteLinkKind("https://notinstagram.com/x"), "generic");
});

test("wa.me oficial vira o link padrão com UTM links; outro URL fica como salvo", () => {
  const official = siteLinkHref({ href: "https://wa.me/5527996330706" });
  assert.equal(official, whatsappUrl(undefined, { campaign: "links" }));
  assert.ok(official.startsWith("https://wa.me/5527996330706"));
  assert.match(official, /utm_campaign=links/);
  const other = "https://wa.me/5511999999999";
  assert.equal(siteLinkHref({ href: other }), other);
  const custom = "https://wa.me/5527996330706?text=Oi";
  assert.equal(siteLinkHref({ href: custom }), custom);
  assert.equal(siteLinkHref({ href: "/estoque" }), "/estoque");
});

test("rodapé aponta para /links, sitemap lista /links e o menu do topo não", () => {
  const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const siteTs = src("lib/site.ts");
  assert.match(siteTs, /SECONDARY_LINKS = \[[^\]]*href: "\/links"/);
  assert.doesNotMatch(siteTs, /NAV_LINKS = \[[^\]]*\/links/);
  assert.match(src("app/sitemap.ts"), /path: "\/links"/);
});

test("updateSiteSettings valida, grava linksJson e revalida /links", () => {
  const action = readFileSync(new URL("../app/admin/site/actions.ts", import.meta.url), "utf8");
  assert.match(action, /validateSiteLinks/);
  assert.match(action, /linksJson/);
  assert.match(action, /updateTag\("site-settings"\)/);
  assert.match(action, /revalidatePath\("\/links"\)/);
});
