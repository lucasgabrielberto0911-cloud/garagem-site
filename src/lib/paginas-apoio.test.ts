import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SECONDARY_LINKS, SERVICES } from "./site";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("links secundários trazem as páginas de apoio e o topo (desktop) não muda", async () => {
  const hrefs: string[] = SECONDARY_LINKS.map((l) => l.href);
  for (const h of ["/vendidos", "/como-funciona", "/financiamento"]) assert.ok(hrefs.includes(h), h);
  const labels: Record<string, string> = Object.fromEntries(SECONDARY_LINKS.map((l) => [l.href, l.label]));
  assert.equal(labels["/vendidos"], "Vendidos e entregas");
  const { DESKTOP_NAV_LINKS } = await import("./site");
  for (const h of ["/vendidos", "/como-funciona", "/financiamento"])
    assert.ok(!DESKTOP_NAV_LINKS.some((l) => l.href === h), `${h} fora do topo`);
});

test("serviço Financiamento aponta para /financiamento", () => {
  assert.equal(SERVICES.find((s) => s.label === "Financiamento")?.href, "/financiamento");
});

test("sitemap lista as três rotas novas", () => {
  const src = read("src/app/sitemap.ts");
  for (const p of ["/vendidos", "/como-funciona", "/financiamento"]) assert.ok(src.includes(`path: "${p}"`), p);
});

test("subdomínios redirecionam permanente na borda (vercel.json) e no Next", () => {
  const vercel = JSON.parse(read("vercel.json")) as {
    redirects: { source: string; has?: { value: string }[]; destination: string; permanent?: boolean }[];
  };
  for (const sub of ["vendidos", "vender", "links"]) {
    const rule = vercel.redirects.find((r) => r.has?.some((h) => h.value === `${sub}.suagaragem.net`));
    assert.ok(rule, sub);
    assert.equal(rule.destination, `https://www.suagaragem.net/${sub}`);
    assert.equal(rule.permanent, true);
  }
  const next = read("next.config.mjs");
  assert.ok(next.includes('["vendidos", "vender", "links"]'));
});

test("páginas de apoio usam ISR de 1 h, metadata e breadcrumb", () => {
  for (const [dir, path] of [["como-funciona", "/como-funciona"], ["financiamento", "/financiamento"]]) {
    const src = read(`src/app/(site)/${dir}/page.tsx`);
    assert.match(src, /export const revalidate = 3600/);
    assert.ok(src.includes(`path: "${path}"`));
    assert.ok(src.includes("breadcrumbJsonLd"));
    assert.ok(!src.includes('"use client"'));
  }
});
