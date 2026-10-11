import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWhatsAppOrigin, classifyLeadOrigin, isLeadOrigin, withWhatsAppOrigin } from "./lead-origin";
import { formatCustomerVehicleWhatsAppText, whatsappUrl } from "./site";
const site = "https://www.suagaragem.net";
test("origem usa UTM conhecida e domínio exato, sem repassar textos livres", () => {
  for (const [search, referrer, expected] of [
    ["?utm_source=ig&utm_campaign=nome%40email.com", "", "instagram"],
    ["?utm_source=meta&utm_medium=marketplace", "", "marketplace"],
    ["?utm_source=olx", "", "olx"], ["?utm_source=Google", "", "google"],
    ["?utm_source=nome%40email.com", "", "outros"],
    ["", "https://www.google.com.br/search?q=carro", "google"],
    ["?fbclid=identificador", "https://l.instagram.com/", "instagram"],
    ["", "https://m.facebook.com/", "facebook"], ["", "https://www.olx.com.br/", "olx"],
    ["", "https://google.com.evil.test/", "outros"], ["", `${site}/estoque`, "desconhecida"],
    ["", "", "direto"], ["?gclid=abc", "", "google"], ["?fbclid=abc", "", "facebook"],
    ["", "inválido", "desconhecida"],
  ]) assert.equal(classifyLeadOrigin(search, referrer, site), expected);
  assert.equal(isLeadOrigin("__proto__"), false);
});
test("mensagem tem origem humana dentro de text, é idempotente e permite remover consentimento", () => {
  const text = "Oi! Vi o Honda Civic 2020 no site da Garagem.";
  assert.equal(withWhatsAppOrigin(text), text);
  const href = whatsappUrl(text, { campaign: "ficha", origin: "instagram" });
  assert.equal(new URL(href).searchParams.get("text"), `${text} Vim pelo Instagram.`);
  assert.equal(applyWhatsAppOrigin(href, "instagram"), href);
  assert.equal(new URL(applyWhatsAppOrigin(href, null)).searchParams.get("text"), text);
  assert.equal(withWhatsAppOrigin(text, "desconhecida"), text);
  assert.match(withWhatsAppOrigin(text, "olx"), /Vim pela OLX\.$/);
  // Acesso direto (sem UTM nem referrer) não acrescenta nada.
  assert.equal(withWhatsAppOrigin(text, "direto"), text);
  assert.equal(new URL(whatsappUrl(text, { campaign: "ficha", origin: "direto" })).searchParams.get("text"), text);
  // Link da ficha fica sozinho na última linha; a origem vai na frase.
  const withLink = `${text}\nhttps://www.suagaragem.net/estoque/civic`;
  assert.equal(withWhatsAppOrigin(withLink, "instagram"), `${text} Vim pelo Instagram.\nhttps://www.suagaragem.net/estoque/civic`);
  assert.equal(withWhatsAppOrigin(withWhatsAppOrigin(withLink, "instagram"), "google"), `${text} Vim pelo Google.\nhttps://www.suagaragem.net/estoque/civic`);
  assert.equal(withWhatsAppOrigin(withWhatsAppOrigin(withLink, "instagram"), null), withLink);
  // Formato antigo entre parênteses é limpo.
  assert.equal(withWhatsAppOrigin(`${text} (acessei o site diretamente)`, "direto"), text);
  assert.equal(withWhatsAppOrigin(`${text} (vim pelo Instagram)`, "olx"), `${text} Vim pela OLX.`);
  assert.equal(applyWhatsAppOrigin("https://example.com/?text=Oi", "google"), "https://example.com/?text=Oi");
  assert.equal(new URL(whatsappUrl(text, { bare: true, origin: "google" })).searchParams.get("text"), text);
});
test("vendido conserva carro e origem e nunca inclui preço ou cidade", () => {
  const text = formatCustomerVehicleWhatsAppText({ label: "Civic 2020", priceLabel: "R$ 90.000", sold: true });
  const final = new URL(whatsappUrl(text, { origin: "google" })).searchParams.get("text")!;
  assert.match(final, /Civic 2020.*vendido.*Google/);
  assert.doesNotMatch(final, /R\$|90.000|Linhares/);
});
