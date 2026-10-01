import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const contato = readFileSync("src/app/(site)/contato/page.tsx", "utf8");
const vender = readFileSync("src/app/(site)/vender/page.tsx", "utf8");
const sell = readFileSync("src/components/site/SellForm.tsx", "utf8");

test("contato mostra o telefone da loja e um WhatsApp", () => {
  assert.equal((contato.match(/<WhatsAppButton/g) ?? []).length, 1);
  assert.match(contato, /telUrl\(\)/);
  assert.match(contato, /PHONES\[0\]/);
  assert.match(contato, /Não temos showroom físico/);
  assert.doesNotMatch(contato, /whatsappUrl\(|#25D366|setTimeout|setInterval/);
  assert.doesNotMatch(
    contato,
    /StockFilters|VehicleMobileDossier|SiteChat|seminovos\/|InstallPrompt/,
  );
  assert.doesNotMatch(contato, /\(\d{2}\) \d{4,5}-\d{4}/);
});

test("vender explica os passos sem outro WhatsApp nem carrossel", () => {
  assert.equal((vender.match(/WhatsAppButton/g) ?? []).length, 0);
  assert.match(vender, /Como funciona/);
  assert.match(vender, /Você manda os dados/);
  assert.match(vender, /A gente avalia/);
  assert.match(vender, /Fechamos o negócio/);
  assert.match(vender, /retornamos no WhatsApp, das 8h às 23h, sem taxa e sem compromisso/);
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
    "website",
    "photoUrls",
    "source",
    "interestVehicleId",
  ]) {
    assert.match(sell, new RegExp(`name="${name}"`));
  }
  assert.match(sell, /createSellLead\(data\)/);
  assert.match(sell, /telefone informado/);
  assert.match(sell, /8h às 23h/);
  assert.match(sell, /site\.phoneLabel/);
  assert.match(sell, /Sem conexão\. Guardamos a avaliação e enviamos quando a internet voltar\./);
  assert.doesNotMatch(sell, /setTimeout|setInterval|prepareMasterForUpload|master: true/);
  assert.equal((sell.match(/<WhatsAppButton/g) ?? []).length, 2);
  assert.deepEqual(sell.match(/\(\d{2}\) \d{4,5}-\d{4}/g), ["(00) 00000-0000"]);
});
