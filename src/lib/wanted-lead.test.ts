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
  maxPriceFromLeadNotes,
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

test("pedido compacto aceita só telefone, nome e carro, sem e-mail, só com a autorização marcada", () => {
  const parsed = parseWantedLeadForm(form({ phone: valid.phone, name: valid.name, model: valid.model, consent: "sim" }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok || !parsed.lead) return;
  assert.equal(parsed.lead.email, null);
  for (const key of ["yearMin", "yearMax", "priceMin", "priceMax", "kmMin", "kmMax"] as const) {
    assert.equal(parsed.lead[key], null);
  }
  assert.doesNotMatch(toLeadVendaData(parsed.lead).notes, /E-mail:|Ano:|Preço:|Km:/);
  for (const key of ["phone", "name", "model"]) {
    const invalid = parseWantedLeadForm(form({ phone: valid.phone, name: valid.name, model: valid.model, consent: "sim", [key]: "" }));
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.ok(invalid.fieldErrors[key]);
  }
  const badEmail = parseWantedLeadForm(form({ ...valid, email: "ana@" }));
  assert.equal(badEmail.ok, false);
  if (!badEmail.ok) assert.match(badEmail.fieldErrors.email, /e-mail válido/);
});

test("valor máximo com máscara é salvo e limita as sugestões de estoque", () => {
  const parsed = parseWantedLeadForm(form({ phone: valid.phone, name: valid.name, model: valid.model, consent: "sim", priceMax: "R$ 95.000" }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok || !parsed.lead) return;
  assert.equal(parsed.lead.priceMax, 95000);
  const notes = toLeadVendaData(parsed.lead).notes;
  assert.equal(maxPriceFromLeadNotes(notes), 95000);
  assert.match(notes, /Preço: até R\$\s*95\.000/);
  assert.equal(maxPriceFromLeadNotes(null), null);
  assert.equal(maxPriceFromLeadNotes("Preço: até inválido"), null);
  for (const priceMax of ["R$ 0", "-100", "R$ 5.000.001", "abc"]) {
    const invalid = parseWantedLeadForm(form({ ...valid, priceMax }));
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.ok(invalid.fieldErrors.priceMax);
  }
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

test("o formulário público tem quatro campos ordenados e aviso de privacidade antes de enviar", () => {
  const html = renderToStaticMarkup(
    createElement(MissingModelForm, {
      idPrefix: "teste",
      sourcePage: "estoque",
      initialModel: "HB20",
    }),
  );
  const consentAt = html.indexOf("A Garagem usa seu nome e telefone");
  const sendAt = html.indexOf("Enviar pedido");
  assert.ok(consentAt > 0);
  assert.ok(sendAt > consentAt);
  assert.match(html, /name="model"/);
  assert.doesNotMatch(html, /name="email"|name="yearMin"|name="yearMax"|name="priceMin"|name="kmMin"|name="kmMax"/);
  const fields = [...html.matchAll(/<input[^>]*name="(phone|name|model|priceMax)"/g)].map(match => match[1]);
  assert.deepEqual(fields, ["phone", "name", "model", "priceMax"]);
  assert.match(html, /name="consent"[^>]*type="checkbox"|type="checkbox"[^>]*name="consent"/);
  assert.match(html, /Autorizo a Garagem a entrar em contato pelo telefone informado/);
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
  assert.match(source, /setFormError\(result\.message\)/);
  assert.doesNotMatch(source, /notifyError/);
  assert.doesNotMatch(source, /WhatsAppButton|wa\.me|99633|setTimeout|Confirmado neste anúncio/);
  const track = source.match(/trackLead\(\{[^}]*\}\)/)?.[0] ?? "";
  assert.match(track, /content_name: "Não encontrou o modelo"/);
  assert.doesNotMatch(track, /search_string/);
});

test("estoque abre o pedido em outra página; a ficha mantém o formulário", () => {
  const browse = readSrc("components/site/EstoqueBrowse.tsx");
  const stock = readSrc("app/(catalog)/estoque/page.tsx");
  const ficha = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
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

test("sem a autorização marcada o pedido não é aceito", () => {
  const parsed = parseWantedLeadForm(form({ ...valid, consent: "" }));
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.ok(parsed.fieldErrors.consent);
});
