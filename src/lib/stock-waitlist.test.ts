import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { WHATSAPP_MESSAGES, whatsappCampaignFromLabel, whatsappUrl } from "./site";
import { formatStockWaitlistQuery, stockEmptyWhatsAppCta } from "./stock-waitlist";

test("lista de espera prefere a busca livre", () => {
  assert.equal(
    formatStockWaitlistQuery({ q: "  fox automático  ", brand: "Volkswagen" }),
    "fox automático",
  );
});

test("filtros viram frase natural para o WhatsApp", () => {
  assert.match(
    formatStockWaitlistQuery({
      brand: "Hyundai",
      transmission: "Automático",
      maxPrice: "50000",
    }),
    /Hyundai, automático, até R\$\s*50\.000/,
  );
  assert.match(
    formatStockWaitlistQuery({
      category: "moto",
      minPrice: "15000",
      maxPrice: "25000",
    }),
    /moto, de R\$\s*15\.000 a R\$\s*25\.000/,
  );
  assert.equal(formatStockWaitlistQuery({}), "");
});

test("filtro vazio manda para o WhatsApp com campanha filtro, não home", () => {
  const cta = stockEmptyWhatsAppCta({
    filtered: true,
    waitlistQuery: "Hyundai, automático, até R$ 50.000",
  });
  assert.equal(cta.campaign, "filtro");
  assert.equal(cta.trackingLabel, "estoque-filtro-vazio");
  assert.equal(cta.label, "Me avisa no WhatsApp");
  assert.equal(
    cta.message,
    WHATSAPP_MESSAGES.wanted("Hyundai, automático, até R$ 50.000"),
  );
  assert.match(cta.message, /Quero ser avisado quando chegar/);
  assert.equal(whatsappCampaignFromLabel(cta.trackingLabel), "filtro");
  const href = whatsappUrl(cta.message, { campaign: cta.campaign });
  assert.match(href, /utm_campaign=filtro/);
  assert.doesNotMatch(href, /utm_campaign=home/);
});

test("estoque vazio sem filtro usa campanha estoque", () => {
  const cta = stockEmptyWhatsAppCta({ filtered: false });
  assert.equal(cta.campaign, "estoque");
  assert.equal(cta.trackingLabel, "estoque-vazio");
  assert.equal(cta.message, WHATSAPP_MESSAGES.wanted());
  const href = whatsappUrl(cta.message, { campaign: cta.campaign });
  assert.match(href, /utm_campaign=estoque/);
  assert.doesNotMatch(href, /utm_campaign=home/);
});

test("empty state do estoque: WhatsApp primário, Ajuda secundária, UTM certo", () => {
  const browse = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "components/site/EstoqueBrowse.tsx"),
    "utf8",
  );
  assert.match(browse, /stockEmptyWhatsAppCta/);
  assert.match(browse, /campaign=\{emptyWhatsApp\.campaign\}/);
  assert.match(browse, /variant="solid"/);
  assert.match(browse, /Me avisa no WhatsApp/);
  assert.match(browse, /ChatOpenButton/);
  assert.match(browse, /variant="outline"/);

  const whatsappIndex = browse.indexOf("<WhatsAppButton");
  const ajudaIndex = browse.indexOf("<ChatOpenButton");
  assert.ok(whatsappIndex > 0);
  assert.ok(ajudaIndex > 0);
  assert.ok(
    whatsappIndex < ajudaIndex,
    "WhatsApp precisa ser o CTA primário (antes da Ajuda)",
  );
  assert.doesNotMatch(browse, /campaign="home"/);
  assert.doesNotMatch(browse, /Quero avisar o que procuro/);
});
