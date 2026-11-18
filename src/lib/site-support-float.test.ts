import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileBottomNav } from "@/components/site/MobileBottomNav";
import {
  SiteSupportFloat,
  SiteSupportFloatContent,
  type SiteSupportWhatsAppTarget,
} from "@/components/site/SiteSupportFloat";
import { WhatsAppFloat } from "@/components/site/WhatsAppFloat";
import { setChatVehicleContext } from "@/lib/chat-vehicle-context";
import { SiteLeadHit, catalogParamsFromChatVehicle } from "@/lib/funnel-events";

const VEHICLE_CUID = "cmt0ewzpg0000lc0493fl02h7";

function findElements(
  node: ReactNode,
  predicate: (el: ReactElement<Record<string, unknown>>) => boolean,
): Array<ReactElement<Record<string, unknown>>> {
  const found: Array<ReactElement<Record<string, unknown>>> = [];
  function walk(current: ReactNode) {
    if (!current) return;
    if (Array.isArray(current)) {
      for (const item of current) walk(item);
      return;
    }
    if (!isValidElement(current)) return;
    const el = current as ReactElement<Record<string, unknown>>;
    if (predicate(el)) found.push(el);
    if (typeof el.type === "function" && el.type !== SiteLeadHit) {
      const rendered = (el.type as (props: Record<string, unknown>) => ReactNode)(
        el.props,
      );
      walk(rendered);
      return;
    }
    walk(el.props.children as ReactNode);
  }
  walk(node);
  return found;
}

function withMockAnalytics(run: (events: { fbq: unknown[][]; gtag: unknown[][] }) => void) {
  const prevWindow = (globalThis as { window?: unknown }).window;
  const fbqCalls: unknown[][] = [];
  const gtagCalls: unknown[][] = [];

  (globalThis as { window?: unknown }).window = {
    location: { search: "", pathname: "/estoque" },
    fbq: (...args: unknown[]) => {
      fbqCalls.push(args);
    },
    gtag: (...args: unknown[]) => {
      gtagCalls.push(args);
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
  };

  try {
    run({ fbq: fbqCalls, gtag: gtagCalls });
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  }
}

test("SiteSupportFloat no desktop exibe botão verde direto do WhatsApp + pílula vermelha discreta sem menu de 2 cliques", () => {
  setChatVehicleContext(null);
  const html = renderToStaticMarkup(
    createElement(SiteSupportFloat, { onOpenAssistant: () => {} }),
  );

  // Sem menu suspenso intermediário de 2 cliques
  assert.doesNotMatch(html, /role="menu"/);
  assert.doesNotMatch(html, /role="menuitem"/);
  assert.doesNotMatch(html, /aria-haspopup/);
  assert.doesNotMatch(html, /Opções de atendimento/);

  // Escopo só desktop (no celular fica oculto; MobileBottomNav segue com lg:hidden)
  assert.match(html, /\bhidden\b[^"]*?\blg:flex\b/);

  // Ação primária: link direto wa.me em 1 clique envolvido em SiteLeadHit (span.contents)
  assert.match(html, /<span class="contents"><a[^>]*data-support-whatsapp=""/);
  assert.match(html, /aria-label="Falar no WhatsApp"/);
  assert.match(html, /href="https:\/\/wa\.me\//);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);

  // Pílula secundária discreta "Tirar dúvida rápida" no estilo vermelho do site (alvo >= 44px e texto >= 16px)
  const buttonMatch = html.match(/<button[^>]*class="([^"]*)"[^>]*>[\s\S]*?<\/button>/);
  assert.ok(buttonMatch, "pílula do assistente deve existir");
  const buttonHtml = buttonMatch[0];
  const buttonClass = buttonMatch[1];
  assert.match(buttonHtml, /Tirar dúvida rápida/);
  assert.match(buttonClass, /\bsite-chat-launcher\b/);
  assert.match(buttonClass, /\bmin-h-11\b/);
  assert.match(buttonClass, /\btext-base\b/);
  assert.match(buttonClass, /\bfont-display\b/);
  assert.match(buttonClass, /\bborder-brand\/50\b/);
  assert.match(buttonClass, /\bhover:bg-brand-dark\b/);
  assert.match(buttonHtml, /\btext-brand-light\b/);

  // Verde do WhatsApp (#25D366) só no botão do WhatsApp (alvo 56x56 >= 44px); nunca na pílula do assistente
  assert.doesNotMatch(buttonHtml, /#25D366|emerald|green/i);
  const whatsappMatch = html.match(/<a[^>]*data-support-whatsapp=""[^>]*>/);
  assert.ok(whatsappMatch, "link do WhatsApp deve existir");
  assert.match(whatsappMatch[0], /bg-\[#25D366\]/);
  assert.match(whatsappMatch[0], /\bh-14\b/);
  assert.match(whatsappMatch[0], /\bw-14\b/);

  // Sem dourado/amarelo
  assert.doesNotMatch(html, /gold|amber|yellow|#FFC72C/i);
});

test("celular mantém barra fixa do WhatsApp intacta (lg:hidden) e WhatsAppFloat usa SiteLeadHit no desktop", () => {
  setChatVehicleContext(null);
  const mobileNavHtml = renderToStaticMarkup(createElement(MobileBottomNav));
  assert.match(mobileNavHtml, /data-mobile-bottom-nav/);
  assert.match(mobileNavHtml, /\blg:hidden\b/);
  assert.match(mobileNavHtml, /bg-\[#25D366\]/);
  assert.match(mobileNavHtml, /WhatsApp/);

  const floatHtml = renderToStaticMarkup(createElement(WhatsAppFloat));
  assert.match(floatHtml, /<span class="contents"><a[^>]*class="whatsapp-float[^"]*\bhidden\b[^"]*\blg:flex\b"/);
  assert.match(floatHtml, /bg-\[#25D366\]/);
});

test("pílula 'Tirar dúvida rápida' abre o assistente em 1 clique e reflete estado busy", () => {
  let opened = 0;
  const target: SiteSupportWhatsAppTarget = {
    href: "https://wa.me/5500000000000?text=Oi",
    vehicleId: undefined,
    catalogParams: undefined,
    slug: undefined,
  };

  const tree = SiteSupportFloatContent({
    whatsapp: target,
    busy: true,
    onOpenAssistant: () => {
      opened += 1;
    },
  });

  const buttons = findElements(tree, (el) => el.type === "button");
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props["aria-busy"], true);

  const onClick = buttons[0].props.onClick as () => void;
  onClick();
  assert.equal(opened, 1);
});

test("clique no WhatsApp flutuante dispara SiteLeadHit fora da ficha, catálogo com veículo disponível e omite valor em vendido", () => {
  // 1. Fora da ficha: SiteLeadHit dispara Lead institucional + WhatsAppClick sem PII
  withMockAnalytics(({ fbq, gtag }) => {
    const target: SiteSupportWhatsAppTarget = {
      href: "https://wa.me/5500000000000?text=Oi",
      vehicleId: undefined,
      catalogParams: undefined,
      slug: undefined,
    };
    const tree = SiteSupportFloatContent({
      whatsapp: target,
      onOpenAssistant: () => {},
    });

    const leadWrappers = findElements(tree, (el) => el.type === SiteLeadHit);
    assert.equal(leadWrappers.length, 1);
    assert.equal(leadWrappers[0].props.contentName, "WhatsApp flutuante");

    // Renderiza SiteLeadHit para acionar onClickCapture real
    const renderedHit = SiteLeadHit(
      leadWrappers[0].props as Parameters<typeof SiteLeadHit>[0],
    );
    (renderedHit.props.onClickCapture as () => void)();

    const links = findElements(tree, (el) => el.type === "a");
    assert.equal(links.length, 1);
    (links[0].props.onClick as () => void)();

    const leadEvents = fbq.filter((call) => call[0] === "track" && call[1] === "Lead");
    assert.equal(leadEvents.length, 1);
    assert.deepEqual(leadEvents[0][2], {
      content_ids: [],
      content_type: "vehicle",
      country: "Brazil",
      content_name: "WhatsApp flutuante",
    });

    const customEvents = fbq.filter(
      (call) => call[0] === "trackCustom" && call[1] === "WhatsAppClick",
    );
    assert.equal(customEvents.length, 1);
    assert.deepEqual(customEvents[0][2], { label: "float" });
    assert.ok(gtag.some((call) => call[0] === "event" && call[1] === "generate_lead"));
    assert.ok(gtag.some((call) => call[0] === "event" && call[1] === "whatsapp_click"));
  });

  // 2. Com veículo disponível: dispara Lead + AddToCart com CUID do catálogo (sem duplicar SiteLeadHit vazio)
  withMockAnalytics(({ fbq }) => {
    const target: SiteSupportWhatsAppTarget = {
      href: "https://wa.me/5500000000000?text=Oi",
      vehicleId: VEHICLE_CUID,
      slug: `honda-civic-2020-${VEHICLE_CUID}`,
      catalogParams: catalogParamsFromChatVehicle({
        id: VEHICLE_CUID,
        label: "Honda Civic 2020",
        brand: "Honda",
        model: "Civic",
        year: 2020,
        price: 89900,
      }),
    };
    const tree = SiteSupportFloatContent({
      whatsapp: target,
      onOpenAssistant: () => {},
    });

    const leadWrappers = findElements(tree, (el) => el.type === SiteLeadHit);
    assert.equal(leadWrappers.length, 0);

    const links = findElements(tree, (el) => el.type === "a");
    (links[0].props.onClick as () => void)();

    const leadEvents = fbq.filter((call) => call[0] === "track" && call[1] === "Lead");
    const cartEvents = fbq.filter((call) => call[0] === "track" && call[1] === "AddToCart");
    assert.equal(leadEvents.length, 1);
    assert.equal(cartEvents.length, 1);
    assert.deepEqual(
      (leadEvents[0][2] as { content_ids: string[] }).content_ids,
      [VEHICLE_CUID],
    );
  });

  // 3. Veículo vendido: catalogParams é undefined -> sem AddToCart e sem preço
  withMockAnalytics(({ fbq }) => {
    setChatVehicleContext({
      id: VEHICLE_CUID,
      label: "Honda Civic 2020",
      brand: "Honda",
      model: "Civic",
      year: 2020,
      price: 89900,
      sold: true,
    });
    try {
      const html = renderToStaticMarkup(
        createElement(SiteSupportFloat, { onOpenAssistant: () => {} }),
      );
      assert.doesNotMatch(html, /89\.?900/);

      const target: SiteSupportWhatsAppTarget = {
        href: "https://wa.me/5500000000000?text=Oi",
        vehicleId: VEHICLE_CUID,
        slug: `honda-civic-2020-${VEHICLE_CUID}`,
        catalogParams: undefined,
      };
      const tree = SiteSupportFloatContent({
        whatsapp: target,
        onOpenAssistant: () => {},
      });
      const leadWrappers = findElements(tree, (el) => el.type === SiteLeadHit);
      assert.equal(leadWrappers.length, 1);
      const renderedHit = SiteLeadHit(
        leadWrappers[0].props as Parameters<typeof SiteLeadHit>[0],
      );
      (renderedHit.props.onClickCapture as () => void)();
      const links = findElements(tree, (el) => el.type === "a");
      (links[0].props.onClick as () => void)();

      const cartEvents = fbq.filter((call) => call[0] === "track" && call[1] === "AddToCart");
      assert.equal(cartEvents.length, 0);
      assert.doesNotMatch(JSON.stringify(fbq), /89900/);
    } finally {
      setChatVehicleContext(null);
    }
  });
});
