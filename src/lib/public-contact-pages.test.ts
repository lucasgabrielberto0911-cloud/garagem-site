import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { FounderSection } from "@/components/site/FounderSection";
import tailwindConfig, { siteBrandColors } from "../../tailwind.config";
import { PHOTO_BLOB_ORIGIN, PHOTO_R2_ORIGIN, PHOTO_STORAGE_ORIGIN } from "./public-photo-url";
import { sellReceivedLine } from "./sell-receipt";
import { parseFounderPhotoUrl } from "./site-content";

const contato = readFileSync("src/app/(site)/contato/page.tsx", "utf8");
const sobre = readFileSync("src/app/(site)/sobre/page.tsx", "utf8");
const footer = readFileSync("src/components/site/SiteFooter.tsx", "utf8");
const vender = readFileSync("src/app/(site)/vender/page.tsx", "utf8");
const sell = readFileSync("src/components/site/SellForm.tsx", "utf8");
const honeypot = readFileSync("src/components/site/HoneypotWebsiteField.tsx", "utf8");
const photos = readFileSync("src/components/site/SellPhotoUpload.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

type Rgb = readonly [number, number, number];

function parseHexColor(hex: string): Rgb {
  const normalized = hex.replace(/^#/, "");
  assert.match(normalized, /^[0-9a-fA-F]{6}$/, `Hex inválido: ${hex}`);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function blendOver(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [
    fg[0] * alpha + bg[0] * (1 - alpha),
    fg[1] * alpha + bg[1] * (1 - alpha),
    fg[2] * alpha + bg[2] * (1 - alpha),
  ];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const linearize = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractOpeningTag(
  source: string,
  marker: string,
  direction: "enclosing" | "before" = "enclosing",
  tagPrefix = "<",
): string {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Marcador não encontrado: ${marker}`);
  const tagStart =
    direction === "enclosing"
      ? source.lastIndexOf(tagPrefix, markerIndex)
      : source.lastIndexOf(tagPrefix, markerIndex - 1);
  assert.notEqual(tagStart, -1, `Tag não encontrada para: ${marker}`);
  let braceDepth = 0;
  let quote: '"' | "'" | "`" | null = null;
  for (let i = tagStart + 1; i < source.length; i += 1) {
    const ch = source[i];
    const prev = source[i - 1];
    if (quote) {
      if (ch === quote && prev !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") {
      braceDepth += 1;
      continue;
    }
    if (ch === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }
    if (ch === ">" && braceDepth === 0) {
      return source.slice(tagStart, i + 1);
    }
  }
  throw new Error(`Tag não fechada para: ${marker}`);
}

function classTokens(snippet: string): string[] {
  return snippet.split(/[\s"'`{}()]+/).filter(Boolean);
}

function hasBorderClass(tokens: string[]): boolean {
  return tokens.some(
    (token) =>
      token === "border" ||
      token.startsWith("border-") ||
      token.includes(":border"),
  );
}

test("contato mostra o telefone da loja e um WhatsApp", () => {
  assert.equal((contato.match(/<WhatsAppButton/g) ?? []).length, 1);
  assert.match(contato, /telUrl\(\)/);
  assert.match(contato, /PHONES\[0\]/);
  assert.match(contato, /Não temos showroom físico/);
  assert.match(contato, /data-clear-fab/);
  assert.match(contato, /clear-fab-screen/);
  assert.match(contato, /Horário/);
  assert.doesNotMatch(contato, /whatsappUrl\(|#25D366|setTimeout|setInterval/);
  assert.doesNotMatch(
    contato,
    /StockFilters|VehicleMobileDossier|SiteChat|seminovos\/|InstallPrompt/,
  );
  assert.doesNotMatch(contato, /\(\d{2}\) \d{4,5}-\d{4}/);
});

test("vender explica os passos, com um único atalho de WhatsApp antes do formulário e sem carrossel", () => {
  assert.equal((vender.match(/<WhatsAppButton/g) ?? []).length, 1);
  assert.match(vender, /Mandar fotos e dados pelo WhatsApp/);
  assert.ok(vender.indexOf("<WhatsAppButton") < vender.indexOf("<SellForm"));
  assert.match(vender, /Como funciona/);
  assert.match(vender, /Você manda os dados/);
  assert.match(vender, /A gente avalia/);
  assert.match(vender, /Fechamos o negócio/);
  assert.match(vender, /retornamos no WhatsApp, das 8h às 23h, sem taxa e sem compromisso/);
  assert.match(vender, /data-clear-fab/);
  assert.match(vender, /clear-fab-screen/);
  assert.doesNotMatch(vender, /step-scroll|setTimeout|setInterval/);
  assert.doesNotMatch(
    vender,
    /StockFilters|SiteChat|VehicleMobileDossier|seminovos\/|InstallPrompt/,
  );
});

test("o formulário de venda mantém os campos e o envio de hoje", () => {
  for (const name of [
    "name",
    "phone",
    "brand",
    "model",
    "year",
    "plate",
    "km",
    "notes",
    "photoUrls",
    "source",
    "interestVehicleId",
  ]) {
    assert.match(name === "photoUrls" ? photos : sell, new RegExp(`name="${name}"`));
  }
  assert.match(sell, /<HoneypotWebsiteField id="website"/);
  assert.match(honeypot, /name="website"/);
  assert.match(honeypot, /hidden/);
  assert.match(sell, /<SellPhotoUpload/);
  assert.doesNotMatch(photos, /prepareMasterForUpload|master: true/);
  assert.match(sell, /createSellLead\(data\)/);
  assert.match(sell, /sellReceivedLine\(photoCount\)/);
  assert.match(sell, /setSentPhotoCount\(photoUrls\.length\)/);
  assert.match(sell, /telefone informado/);
  assert.match(sell, /8h às 23h/);
  assert.match(sell, /site\.phoneLabel/);
  assert.match(sell, /Sem conexão\. Guardamos a avaliação e enviamos quando a internet voltar\./);
  assert.doesNotMatch(sell, /setTimeout|setInterval|prepareMasterForUpload|master: true/);
  assert.equal((sell.match(/<WhatsAppButton/g) ?? []).length, 2);
  assert.deepEqual(sell.match(/\(\d{2}\) \d{4,5}-\d{4}/g), ["(00) 00000-0000"]);

  const okAt = sell.indexOf("if (result.ok)");
  const elseAt = sell.indexOf("} else {", okAt);
  const catchAt = sell.indexOf("} catch", elseAt);
  assert.ok(okAt > 0 && elseAt > okAt && catchAt > elseAt);
  assert.match(sell.slice(okAt, elseAt), /setOutcome\("sent"\)/);
  assert.doesNotMatch(sell.slice(elseAt, catchAt), /setOutcome\("sent"\)/);
  assert.doesNotMatch(sell.slice(catchAt), /setOutcome\("sent"\)/);
  assert.equal((sell.match(/setOutcome\("sent"\)/g) ?? []).length, 1);
});

test("a confirmação da venda só cita fotos quando houve anexo", () => {
  assert.equal(sellReceivedLine(0), "Contato e dados informados do veículo. Placa e outros detalhes podem ser combinados no atendimento.");
  assert.equal(
    sellReceivedLine(2),
    "Contato e dados informados do veículo, com as fotos que você mandou.",
  );
  assert.doesNotMatch(sellReceivedLine(0), /foto/i);
});

test("contato e vender reservam apenas a altura da bottom nav sem padding morto do FAB oculto", () => {
  assert.match(css, /\.clear-fab-screen/);
  assert.match(
    css,
    /\.clear-fab-screen\s*\{[\s\S]*padding-bottom:\s*calc\(4\.25rem \+ env\(safe-area-inset-bottom, 0px\)\)/,
  );
  assert.doesNotMatch(css, /4\.5rem \+ 0\.75rem \+ 2\.75rem/);
});

test("polimento em /sobre, /contato e SiteFooter evita repetições, filtros inexistentes e linha solta de WhatsApp", () => {
  // /sobre: sem retângulo 16:9 com hero-bg, sem "filtre por marca, ano e valor", com região padronizada
  assert.doesNotMatch(sobre, /hero-bg\.webp/);
  assert.doesNotMatch(sobre, /filtre por marca/i);
  assert.match(sobre, /Procedência\. Clareza\. Resultado\./);
  assert.match(sobre, /Atendemos Linhares, Aracruz e Grande Vitória/);
  assert.doesNotMatch(sobre, /publicSite\.region/);

  // /contato: Horário e endereço/atendimento sem duplicação na mesma tela e sem vão forçado de 100dvh entre seções
  assert.equal((contato.match(/label="Horário"/g) ?? []).length, 1);
  assert.equal((contato.match(/publicSite\.address/g) ?? []).length, 2); // só isPhysicalAddress(...) + 1 exibição
  assert.doesNotMatch(contato, /border border-white\/20/);
  assert.match(contato, /<div data-clear-fab="" className="clear-fab-screen lg:py-12">/);

  // SiteFooter: WhatsApp na coluna Contato tem ícone e navegação desktop usa 2 colunas
  assert.match(footer, /<TrackedWhatsAppLink[\s\S]*?<IconWhatsApp/);
  assert.match(footer, /grid grid-cols-2/);
  assert.doesNotMatch(footer, /Seminovos com procedência em \{/);
});

test("FounderSection sem foto ou com URL legada inválida colapsa sem img nem coluna preta; parseFounderPhotoUrl valida origens e caminhos", () => {
  const withoutPhoto = renderToStaticMarkup(createElement(FounderSection, { photoUrl: null }));
  assert.doesNotMatch(withoutPhoto, /<img\b/);
  assert.doesNotMatch(withoutPhoto, /bg-black/);
  assert.match(withoutPhoto, /Elias Clovis Gonçalves dos Santos Neto/);

  const invalidLegacy = renderToStaticMarkup(
    createElement(FounderSection, {
      photoUrl: `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/outro-bucket/foto.webp`,
    }),
  );
  assert.doesNotMatch(invalidLegacy, /<img\b/);
  assert.doesNotMatch(invalidLegacy, /bg-black/);
  assert.doesNotMatch(invalidLegacy, /placeholder-car\.png/);

  assert.equal(parseFounderPhotoUrl("/branding/elias.webp"), "/branding/elias.webp");
  assert.equal(
    parseFounderPhotoUrl(`${PHOTO_R2_ORIGIN}/1790-elias.webp`),
    `${PHOTO_R2_ORIGIN}/1790-elias.webp`,
  );
  assert.equal(
    parseFounderPhotoUrl(`${PHOTO_BLOB_ORIGIN}/elias.webp`),
    `${PHOTO_BLOB_ORIGIN}/elias.webp`,
  );
  assert.equal(
    parseFounderPhotoUrl(`${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/elias.webp`),
    `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/elias.webp`,
  );
  assert.equal(parseFounderPhotoUrl("https://evil.example/foto.webp"), null);
  assert.equal(parseFounderPhotoUrl("https://pub-outro-bucket.r2.dev/foto.webp"), null);
  assert.equal(
    parseFounderPhotoUrl(`${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/outro-bucket/foto.webp`),
    null,
  );
  assert.equal(parseFounderPhotoUrl(`${PHOTO_STORAGE_ORIGIN}/rest/v1/site_settings`), null);
  assert.equal(
    parseFounderPhotoUrl(`${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/elias.webp?download=1`),
    null,
  );
  assert.equal(
    parseFounderPhotoUrl(`${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/elias.webp#frag`),
    null,
  );
  assert.equal(
    parseFounderPhotoUrl("https://user:pass@vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/elias.webp"),
    null,
  );
  assert.equal(
    parseFounderPhotoUrl(`${PHOTO_STORAGE_ORIGIN}:8443/storage/v1/object/public/veiculos/elias.webp`),
    null,
  );
  assert.equal(
    parseFounderPhotoUrl(`${PHOTO_R2_ORIGIN}/${"a".repeat(500)}.webp`),
    null,
  );
  assert.equal(
    parseFounderPhotoUrl(`/branding/${"a".repeat(300)}.webp`),
    null,
  );
});

test("formulário /vender mantém contraste WCAG AA, tokens da marca e separação por superfície sem borda em blocos estáticos", () => {
  const extendColors = tailwindConfig.theme?.extend?.colors as Record<string, unknown>;
  const asphalt = parseHexColor(String(extendColors.asphalt));
  const ink = parseHexColor(String(extendColors.ink));
  const cream = parseHexColor(String(extendColors.cream));
  const brand = parseHexColor(siteBrandColors.DEFAULT);
  const brandLight = parseHexColor(siteBrandColors.light);
  const white: Rgb = [255, 255, 255];
  const draftSurface = blendOver(white, asphalt, 0.04);

  const resolveCreamOrWhite = (token: string, bg: Rgb): Rgb => {
    if (token === "white") return white;
    if (token === "cream") return cream;
    const match = /^(cream|white)\/(\d+)$/.exec(token);
    assert.ok(match, `Token de cor inesperado: ${token}`);
    const base = match[1] === "white" ? white : cream;
    return blendOver(base, bg, Number(match[2]) / 100);
  };

  // 1. Sem cores Tailwind genéricas (red-*) nem bordas/fundos antigos de baixo contraste.
  for (const [name, source] of [
    ["SellForm.tsx", sell],
    ["SellPhotoUpload.tsx", photos],
    ["vender/page.tsx", vender],
  ] as const) {
    assert.doesNotMatch(source, /\b(?:text|border|bg)-red-\d+\b/, `${name} não deve usar red-* padrão`);
  }
  assert.doesNotMatch(sell, /border-white\/20|border-white\/25/);
  assert.doesNotMatch(photos, /border-white\/20|border-white\/25|bg-asphalt\/50/);

  // 2. Blocos estáticos separados por superfície sutil, sem bordas fortes e sem borda dupla.
  const venderFormSection = vender.slice(vender.indexOf('<section className="lg:mt-10">'));
  const venderWhatsappBox = extractOpeningTag(
    venderFormSection,
    "Prefere falar direto no WhatsApp?",
    "before",
    "<div",
  );
  const venderBoxTokens = classTokens(venderWhatsappBox);
  assert.ok(venderBoxTokens.includes("bg-ink"));
  assert.equal(hasBorderClass(venderBoxTokens), false);

  const draftTag = extractOpeningTag(sell, 'data-sell-draft=""');
  const draftTokens = classTokens(draftTag);
  assert.ok(draftTokens.includes("bg-white/[0.04]"));
  assert.equal(hasBorderClass(draftTokens), false);

  const detailsTag = extractOpeningTag(sell, "open={Boolean(errors.plate)}");
  const detailsTokens = classTokens(detailsTag);
  assert.ok(detailsTokens.includes("bg-ink"));
  assert.equal(hasBorderClass(detailsTokens), false);

  const formBlockBody = sell.slice(sell.indexOf("function FormBlock("), sell.indexOf("function Field("));
  const formBlockSectionTag = extractOpeningTag(formBlockBody, "<section");
  const formBlockTokens = classTokens(formBlockSectionTag);
  assert.ok(formBlockTokens.includes("bg-ink"));
  assert.equal(hasBorderClass(formBlockTokens), false);

  const submitFooterTag = extractOpeningTag(sell, "Este é o contato inicial.", "before", "<div");
  const submitFooterTokens = classTokens(submitFooterTag);
  assert.ok(submitFooterTokens.includes("bg-ink"));
  assert.equal(hasBorderClass(submitFooterTokens), false);

  const afterSendBody = sell.slice(sell.indexOf("function AfterSend("), sell.indexOf("function FormBlock("));
  const afterSendRootTag = extractOpeningTag(afterSendBody, 'aria-labelledby="sell-form-receipt-heading"');
  const afterSendRootTokens = classTokens(afterSendRootTag);
  assert.ok(afterSendRootTokens.includes("bg-ink"));
  assert.equal(hasBorderClass(afterSendRootTokens), false);

  const afterSendLiMatches = afterSendBody.match(/<li\b[^>]*>/g) ?? [];
  assert.equal(afterSendLiMatches.length, 3);
  for (const liTag of afterSendLiMatches) {
    const tokens = classTokens(liTag);
    assert.ok(tokens.includes("bg-asphalt"));
    assert.equal(hasBorderClass(tokens), false);
  }

  const photoItemTag = extractOpeningTag(photos, "data-photo-phase={job.phase}");
  const photoItemTokens = classTokens(photoItemTag);
  assert.ok(photoItemTokens.includes("bg-asphalt"));
  assert.equal(hasBorderClass(photoItemTokens), false);

  // 3. Controles interativos com borda, foco e contraste WCAG AA reais.
  const inputDefs = sell.slice(sell.indexOf("const inputBaseClass"), sell.indexOf("export function SellForm("));
  const inputTokens = classTokens(inputDefs);
  assert.ok(inputTokens.includes("bg-asphalt"));
  assert.ok(inputTokens.includes("text-cream"));
  assert.ok(inputTokens.includes("focus:border-brand-light"));
  assert.ok(inputTokens.includes("focus:ring-brand-light"));
  assert.ok(inputTokens.includes("border-brand-light"));
  assert.ok(inputTokens.includes("ring-brand-light"));

  const placeholderToken = inputTokens.find((t) => t.startsWith("placeholder:text-"));
  assert.ok(placeholderToken, "Placeholder precisa de classe de cor explícita");
  const placeholderColor = resolveCreamOrWhite(placeholderToken.replace("placeholder:text-", ""), asphalt);
  assert.ok(
    contrastRatio(placeholderColor, asphalt) >= 4.5,
    `Placeholder ${placeholderToken} precisa de >= 4.5:1 sobre asphalt`,
  );
  assert.ok(
    contrastRatio(cream, placeholderColor) >= 2.0,
    "Valor digitado precisa se distinguir claramente do placeholder",
  );

  const inputBorderToken = inputTokens.find((t) => /^border-white\/\d+$/.test(t));
  assert.ok(inputBorderToken, "Input precisa de borda com contraste explícito");
  const inputBorderColor = resolveCreamOrWhite(inputBorderToken.replace("border-", ""), asphalt);
  assert.ok(contrastRatio(inputBorderColor, asphalt) >= 3.0);
  assert.ok(contrastRatio(resolveCreamOrWhite(inputBorderToken.replace("border-", ""), ink), ink) >= 3.0);
  assert.ok(contrastRatio(brandLight, asphalt) >= 3.0);
  assert.ok(contrastRatio(brandLight, ink) >= 3.0);

  const submitButtonTag = extractOpeningTag(sell, 'type="submit"');
  const submitTokens = classTokens(submitButtonTag);
  assert.ok(submitTokens.includes("bg-brand"));
  assert.ok(submitTokens.includes("text-white"));
  assert.ok(submitTokens.includes("focus-visible:ring-white"));
  assert.ok(contrastRatio(white, brand) >= 4.5, "Texto branco no botão bg-brand precisa de >= 4.5:1");

  const outlineWhatsAppTag = extractOpeningTag(sell, 'variant="outline"');
  assert.ok(classTokens(outlineWhatsAppTag).includes("border-white/45"));

  const sendAnotherButtonTag = extractOpeningTag(sell, "onClick={onAnother}");
  const sendAnotherTokens = classTokens(sendAnotherButtonTag);
  assert.ok(sendAnotherTokens.includes("border-white/45"));
  assert.ok(sendAnotherTokens.includes("focus-visible:ring-brand-light"));

  const dropzoneTag = extractOpeningTag(photos, "Escolher fotos", "before", "<span");
  const dropzoneTokens = classTokens(dropzoneTag);
  assert.ok(dropzoneTokens.includes("border-dashed"));
  assert.ok(dropzoneTokens.includes("border-white/45"));
  assert.ok(dropzoneTokens.includes("bg-asphalt"));

  const photoButtonDef = photos.slice(photos.indexOf("const buttonClass"), photos.indexOf("function createPreviewUrl"));
  const photoButtonTokens = classTokens(photoButtonDef);
  assert.ok(photoButtonTokens.includes("border-white/45"));
  assert.ok(photoButtonTokens.includes("focus-visible:ring-brand-light"));

  // 4. Textos e destaques da marca sobre superfícies escuras cumprem WCAG AA (>= 4.5:1).
  assert.ok(contrastRatio(brandLight, ink) >= 4.5, "text-brand-light sobre ink precisa de >= 4.5:1");
  assert.ok(contrastRatio(brandLight, asphalt) >= 4.5, "text-brand-light sobre asphalt precisa de >= 4.5:1");
  assert.ok(contrastRatio(brandLight, draftSurface) >= 4.5, "text-brand-light sobre rascunho precisa de >= 4.5:1");

  const formBlockHeadingTag = extractOpeningTag(formBlockBody, "<h3");
  assert.ok(classTokens(formBlockHeadingTag).includes("text-brand-light"));
  const fieldBody = sell.slice(sell.indexOf("function Field("));
  const fieldLabelTag = extractOpeningTag(fieldBody, "<label");
  assert.ok(classTokens(fieldLabelTag).includes("text-cream"));
  const fieldErrorTag = extractOpeningTag(fieldBody, 'role="alert"');
  assert.ok(classTokens(fieldErrorTag).includes("text-brand-light"));

  for (const source of [sell, photos, venderFormSection]) {
    const textTokens = classTokens(source).filter(
      (t) => /^text-cream(?:\/\d+)?$/.test(t),
    );
    for (const token of textTokens) {
      const colorOnInk = resolveCreamOrWhite(token.replace("text-", ""), ink);
      const ratio = contrastRatio(colorOnInk, ink);
      assert.ok(ratio >= 4.5, `${token} sobre ink tem contraste ${ratio.toFixed(2)}:1 (< 4.5:1)`);
    }
  }
});
