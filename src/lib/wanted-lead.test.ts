import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { MissingModelForm } from "@/components/site/MissingModelForm";
import { PHONES } from "@/lib/site";
import {
  emailFromLeadNotes,
  parseWantedLeadForm,
  toLeadVendaData,
  WANTED_LEAD_SOURCE,
  WANTED_LEAD_SUCCESS,
} from "@/lib/wanted-lead";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  model: "Corolla XEi",
  name: "Ana Paula",
  email: "Ana@Exemplo.com",
  phone: "(27) 98888-7766",
  consent: "sim",
  sourcePage: "estoque",
  pagePath: "/estoque?q=Corolla",
  contextLabel: "Corolla",
};

test("grava o modelo pedido, o e-mail e as faixas opcionais", () => {
  const parsed = parseWantedLeadForm(
    form({
      ...valid,
      yearMin: "2019",
      yearMax: "2022",
      priceMin: "70.000",
      priceMax: "95.000",
      kmMax: "60.000",
      sourcePage: "ficha",
      pagePath: "/estoque/honda-civic-2020",
      contextLabel: "Honda Civic 2020",
      interestVehicleId: "cmt0ewzpg0000lc0493fl02h7",
    }),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok || !parsed.lead) return;

  const stored = toLeadVendaData(parsed.lead);
  assert.equal(stored.source, WANTED_LEAD_SOURCE);
  assert.equal(stored.vehicleInfo, "Corolla XEi");
  assert.equal(stored.phone, "27988887766");
  assert.equal(stored.plate, "");
  assert.equal(stored.km, null);
  assert.equal(stored.interestVehicleId, "cmt0ewzpg0000lc0493fl02h7");
  assert.match(stored.notes, /E-mail: ana@exemplo.com/);
  assert.match(stored.notes, /Modelo pedido: Corolla XEi/);
  assert.match(stored.notes, /Ano: 2019 a 2022/);
  assert.match(stored.notes, /Preço: R\$\s*70\.000 a R\$\s*95\.000/);
  assert.match(stored.notes, /Km: até 60\.000/);
  assert.match(stored.notes, /Anúncio aberto: Honda Civic 2020/);
  assert.equal(emailFromLeadNotes(stored.notes), "ana@exemplo.com");
});

test("faixas vazias não viram erro e o filtro do estoque fica na observação", () => {
  const parsed = parseWantedLeadForm(form(valid));
  assert.equal(parsed.ok, true);
  if (!parsed.ok || !parsed.lead) return;
  const stored = toLeadVendaData(parsed.lead);
  assert.equal(stored.vehicleInfo, "Corolla XEi");
  assert.match(stored.notes, /Filtro: Corolla/);
  assert.doesNotMatch(stored.notes, /Ano:|Preço:|Km:/);
});

test("sem consentimento, modelo ou e-mail o pedido não segue", () => {
  const missingConsent = parseWantedLeadForm(form({ ...valid, consent: "" }));
  assert.equal(missingConsent.ok, false);
  if (missingConsent.ok) return;
  assert.equal(missingConsent.message, "Confira os campos destacados.");
  assert.match(missingConsent.fieldErrors.consent, /Confirme o uso dos dados/);

  const missingModel = parseWantedLeadForm(form({ ...valid, model: "A" }));
  assert.equal(missingModel.ok, false);
  if (missingModel.ok) return;
  assert.match(missingModel.fieldErrors.model, /modelo/);

  const badEmail = parseWantedLeadForm(form({ ...valid, email: "ana@" }));
  assert.equal(badEmail.ok, false);
  if (badEmail.ok) return;
  assert.match(badEmail.fieldErrors.email, /e-mail válido/);
});

test("faixa invertida e telefone sem DDD voltam em português", () => {
  const parsed = parseWantedLeadForm(
    form({
      ...valid,
      phone: "988887766",
      yearMin: "2022",
      yearMax: "2018",
      priceMax: "0",
    }),
  );
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.match(parsed.fieldErrors.phone, /DDD/);
  assert.match(parsed.fieldErrors.yearMax, /ano final/i);
  assert.match(parsed.fieldErrors.priceMax, /preço válido/i);
});

test("honeypot não monta lead", () => {
  const parsed = parseWantedLeadForm(form({ ...valid, website: "https://spam.test" }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.ignored, true);
  assert.equal(parsed.lead, null);
});

test("o formulário público pede consentimento antes de enviar e não é WhatsApp", () => {
  const html = renderToStaticMarkup(
    createElement(MissingModelForm, {
      idPrefix: "teste",
      sourcePage: "estoque",
      initialModel: "HB20",
    }),
  );
  const consentAt = html.indexOf("Autorizo a Sua Garagem");
  const sendAt = html.indexOf("Enviar pedido");
  assert.ok(consentAt > 0);
  assert.ok(sendAt > consentAt);
  assert.match(html, /name="model"/);
  assert.match(html, /name="email"/);
  assert.match(html, /name="phone"/);
  assert.match(html, /HB20/);
  assert.match(html, /Política de privacidade/);
  assert.match(html, /Não encontrou o modelo/);
  assert.doesNotMatch(html, /wa\.me|WhatsApp|99633/);
  assert.equal(PHONES.length, 1);
  assert.equal(PHONES[0].label, "(27) 99633-0706");

  const source = readSrc("components/site/MissingModelForm.tsx");
  assert.match(source, /WANTED_LEAD_SUCCESS/);
  assert.match(WANTED_LEAD_SUCCESS, /Recebemos o modelo que você pediu/);
  assert.match(source, /Não foi possível enviar agora/);
  assert.match(source, /notifyError\(result\.message\)/);
  assert.doesNotMatch(source, /WhatsAppButton|wa\.me|99633|setTimeout|Confirmado neste anúncio/);
});

test("estoque abre o pedido em outra página; a ficha mantém o formulário", () => {
  const browse = readSrc("components/site/EstoqueBrowse.tsx");
  const stock = readSrc("app/(site)/estoque/page.tsx");
  const ficha = readSrc("app/(site)/estoque/[id]/page.tsx");
  const city = readSrc("app/(site)/seminovos/[cidade]/page.tsx");
  const form = readSrc("components/site/MissingModelForm.tsx");
  const pedido = readSrc("app/(site)/pedido/page.tsx");
  const copy = readSrc("lib/wanted-vehicle-page.ts");

  assert.doesNotMatch(browse, /MissingModelForm/);
  assert.match(browse, /WANTED_VEHICLE_BUTTON_LABEL/);
  assert.match(browse, /wantedVehicleHref/);
  assert.match(browse, /stockEmptyWhatsAppCta/);
  assert.match(browse, /shown\.vehicles\.length === 0/);
  assert.match(copy, /Não achou seu próximo veículo\?/);
  const browseBody = browse.slice(browse.indexOf("export function EstoqueBrowse({"));
  const listAt = browseBody.indexOf("<StockInfiniteList");
  const buttonAt = browseBody.indexOf("<NextVehicleLink");
  assert.ok(listAt > 0 && buttonAt > listAt);

  assert.match(pedido, /<MissingModelForm/);
  assert.match(pedido, /sourcePage="estoque"/);
  assert.match(pedido, /wantedVehicleFormCopy/);
  assert.match(form, /createWantedLead/);
  assert.match(copy, /initialModel: params\.q\?\.trim\(\) \|\| params\.model\?\.trim\(\) \|\| ""/);
  assert.doesNotMatch(stock, /<MissingModelForm/);

  assert.match(ficha, /<MissingModelForm/);
  assert.ok(ficha.indexOf("</aside>") < ficha.indexOf("<MissingModelForm"));
  assert.doesNotMatch(ficha, /Confirmado neste anúncio/i);
  assert.doesNotMatch(ficha, /Equipamentos/);
  assert.doesNotMatch(form, /Confirmado neste anúncio/i);

  assert.doesNotMatch(stock, /WantedVehicleCta/);
  assert.match(city, /getCityShowcaseVehicles\(\)/);
  assert.doesNotMatch(city, /MissingModelForm/);
  assert.doesNotMatch(city, /city=serra|city=linhares/);
});
