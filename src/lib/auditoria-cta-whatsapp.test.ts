import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const favoritesList = readFileSync("src/components/site/FavoritesList.tsx", "utf8");
const sobre = readFileSync("src/app/(site)/sobre/page.tsx", "utf8");
const footer = readFileSync("src/components/site/SiteFooter.tsx", "utf8");
const financiamento = readFileSync("src/app/(site)/financiamento/page.tsx", "utf8");
const comoFunciona = readFileSync("src/app/(site)/como-funciona/page.tsx", "utf8");
const contato = readFileSync("src/app/(site)/contato/page.tsx", "utf8");
const faq = readFileSync("src/app/(site)/faq/page.tsx", "utf8");
const home = readFileSync("src/app/(catalog)/page.tsx", "utf8");

test("FavoritesList exibe CTA de WhatsApp no topo e no final da lista com trackLead", () => {
  const firstCta = favoritesList.indexOf("<TrackedFavoritesWhatsApp");
  const grid = favoritesList.indexOf("<VehicleGrid");
  const secondCta = favoritesList.indexOf("<TrackedFavoritesWhatsApp", grid);

  assert.ok(firstCta > 0, "CTA de WhatsApp deve existir no topo de FavoritesList");
  assert.ok(grid > firstCta, "CTA do topo deve aparecer antes da grade de veículos");
  assert.ok(secondCta > grid, "CTA de WhatsApp também deve permanecer após a grade");
  assert.match(favoritesList, /trackVehiclesWhatsAppLead\([\s\S]*"Favoritos"/);
});

test("Sobre tem CTA de WhatsApp acima da dobra e ambos usam SiteLeadHit", () => {
  const firstWhatsApp = sobre.indexOf("<WhatsAppButton");
  const founder = sobre.indexOf("<FounderSection");
  const secondWhatsApp = sobre.indexOf("<WhatsAppButton", founder);

  assert.ok(firstWhatsApp > 0, "Deve haver WhatsAppButton acima da dobra em /sobre");
  assert.ok(firstWhatsApp < founder, "CTA de WhatsApp deve ficar antes de FounderSection");
  assert.ok(secondWhatsApp > founder, "CTA final de WhatsApp deve permanecer em /sobre");
  assert.equal((sobre.match(/<SiteLeadHit/g) ?? []).length, 2);
});

test("SiteFooter mobile inclui botão de WhatsApp antes dos telefones", () => {
  const mobileBlockStart = footer.indexOf("sm:hidden");
  assert.ok(mobileBlockStart > 0);

  const mobileBlock = footer.slice(mobileBlockStart);
  const whatsIndex = mobileBlock.indexOf("<WhatsAppButton");
  const phonesIndex = mobileBlock.indexOf("{PHONES.map(");

  assert.ok(whatsIndex > 0, "Rodapé mobile deve ter WhatsAppButton");
  assert.ok(whatsIndex < phonesIndex, "WhatsAppButton deve vir antes dos telefones no mobile");
  assert.match(mobileBlock, /<SiteLeadHit/);
});

test("Páginas institucionais e Home envolvem cada WhatsAppButton em SiteLeadHit", () => {
  const pages = [
    { name: "financiamento", source: financiamento },
    { name: "como-funciona", source: comoFunciona },
    { name: "contato", source: contato },
    { name: "faq", source: faq },
    { name: "home", source: home },
  ];

  for (const { name, source } of pages) {
    const buttons = (source.match(/<WhatsAppButton/g) ?? []).length;
    const leadHits = (source.match(/<SiteLeadHit/g) ?? []).length;
    assert.ok(buttons > 0, `${name} deve ter ao menos um WhatsAppButton`);
    assert.equal(
      leadHits,
      buttons,
      `${name}: cada WhatsAppButton (${buttons}) deve estar envolvido em SiteLeadHit (${leadHits})`,
    );
  }
});
