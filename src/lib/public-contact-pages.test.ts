import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sellReceivedLine } from "./sell-receipt";

const contato = readFileSync("src/app/(site)/contato/page.tsx", "utf8");
const vender = readFileSync("src/app/(site)/vender/page.tsx", "utf8");
const sell = readFileSync("src/components/site/SellForm.tsx", "utf8");
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

test("vender explica os passos sem outro WhatsApp nem carrossel", () => {
  assert.equal((vender.match(/WhatsAppButton/g) ?? []).length, 0);
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
    "website",
    "photoUrls",
    "source",
    "interestVehicleId",
  ]) {
    assert.match(sell, new RegExp(`name="${name}"`));
  }
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
  assert.equal(sellReceivedLine(0), "Marca, modelo, ano, placa e km.");
  assert.equal(
    sellReceivedLine(2),
    "Marca, modelo, ano, placa, km e as fotos que você mandou.",
  );
  assert.doesNotMatch(sellReceivedLine(0), /foto/i);
});

test("contato e vender reservam a altura do chip e da bottom nav", () => {
  assert.match(css, /\.clear-fab-screen/);
  assert.match(
    css,
    /padding-bottom: calc\(4\.5rem \+ 0\.75rem \+ 2\.75rem \+ 1rem \+ env\(safe-area-inset-bottom, 0px\)\)/,
  );
  assert.match(css, /body:has\(\[data-clear-fab\]\)/);
});
