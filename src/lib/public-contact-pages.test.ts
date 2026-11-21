import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { FounderSection } from "@/components/site/FounderSection";
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

  // /contato: Horário e endereço/atendimento sem duplicação na mesma tela
  assert.equal((contato.match(/label="Horário"/g) ?? []).length, 1);
  assert.equal((contato.match(/publicSite\.address/g) ?? []).length, 2); // só isPhysicalAddress(...) + 1 exibição
  assert.doesNotMatch(contato, /border border-white\/20/);

  // SiteFooter: WhatsApp na coluna Contato tem ícone e navegação desktop usa 2 colunas
  assert.match(footer, /<TrackedWhatsAppLink[\s\S]*?<IconWhatsApp/);
  assert.match(footer, /grid grid-cols-2/);
  assert.doesNotMatch(footer, /Seminovos com procedência em \{/);
});

test("FounderSection sem foto colapsa sem img nem coluna preta; parseFounderPhotoUrl aceita R2, Blob, Storage e /branding", () => {
  const withoutPhoto = renderToStaticMarkup(createElement(FounderSection, { photoUrl: null }));
  assert.doesNotMatch(withoutPhoto, /<img\b/);
  assert.doesNotMatch(withoutPhoto, /bg-black/);
  assert.match(withoutPhoto, /Elias Clovis Gonçalves dos Santos Neto/);

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
});
