import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyPtAccents,
  buildVehicleFullLabel,
  collapseDuplicateAccessories,
  collapseWhitespace,
  featuredBadgeIds,
  formatTransmissionLabel,
  formatVehicleDisplay,
  formatVehicleWhatsAppMessage,
  gearsConflict,
  inferGearFromText,
  resolveTransmission,
  shortVersion,
  suggestedTransmission,
  transmissionConflictAlert,
} from "./vehicle-display";

test("aplica acento em Automatico / AUTOMATICO", () => {
  assert.equal(applyPtAccents("Automatico"), "Automático");
  assert.equal(applyPtAccents("AUTOMATICO"), "AUTOMÁTICO");
  assert.equal(applyPtAccents("semi automatico"), "semi-automático");
  assert.equal(collapseWhitespace("T200  Automatico"), "T200 Automatico");
});

test("HR-V: versão Automático + câmbio Manual não divergem na exibição", () => {
  const version = "EX 1.8 FLEX ONE Automático";
  const field = "Manual";
  assert.equal(inferGearFromText(version), "automatico");
  assert.equal(inferGearFromText(field), "manual");
  assert.equal(gearsConflict(version, field), true);
  assert.equal(resolveTransmission(version, field), "Automático");
  assert.match(
    transmissionConflictAlert(version, field) ?? "",
    /Câmbio diverge/,
  );

  const display = formatVehicleDisplay({
    id: "cmtbv7xso0000l50429oklxxy",
    brand: "Honda",
    model: "HR-V",
    version,
    yearModel: 2018,
    transmission: field,
    km: 65000,
    price: 89900,
    color: "branco",
  });
  assert.equal(display.transmission, "Automático");
  assert.equal(display.version, "EX 1.8 Flex ONE");
  assert.equal(display.fullLabel, "Honda HR-V EX 1.8 Flex ONE 2018");
  assert.equal(display.transmissionConflict, true);
  assert.ok(display.metaParts.includes("Automático"));
  assert.ok(display.metaParts.includes("Branco"));
  assert.ok(!display.metaParts.includes("Manual"));
});

test("Etios e Altis não repetem o acabamento no label / WhatsApp", () => {
  const etios = buildVehicleFullLabel({
    brand: "Toyota",
    model: "ETIOS XS",
    version: "XS 1.5 16V Flex Automático",
    yearModel: 2017,
  });
  assert.equal(etios, "Toyota Etios XS 1.5 Flex 2017");
  assert.doesNotMatch(etios, /XS XS/);

  const altis = buildVehicleFullLabel({
    brand: "Toyota",
    model: "Corolla ALTIS",
    version: "ALTIS 2.0 VVT FLEX",
    yearModel: 2018,
  });
  assert.equal(altis, "Toyota Corolla Altis 2.0 VVT Flex 2018");
  assert.doesNotMatch(altis, /Altis Altis/i);
  assert.doesNotMatch(altis, /ALTIS ALTIS/);
});

test("Prisma FIPE junk e Fastback Automatico viram versão curta", () => {
  assert.equal(
    shortVersion("Sed. Joy/LS 1.0 8V FlexPower 4p", "Prisma"),
    "Joy/LS 1.0 Flex",
  );
  assert.equal(
    shortVersion("Audace T200  Automatico", "FASTBACK"),
    "Audace T200",
  );
  assert.equal(formatTransmissionLabel("Automatico"), "Automático");
});

test("câmbio alinhado não dispara alerta", () => {
  assert.equal(gearsConflict("XS 1.5 Flex Automático", "Automático"), false);
  assert.equal(resolveTransmission("XS 1.5 Flex Automático", "Automático"), "Automático");
  assert.equal(resolveTransmission("EXL CVT", "Automático"), "CVT");
  assert.equal(
    suggestedTransmission("EX 1.8 Automático", "Manual", ["Manual", "Automático", "CVT"]),
    "Automático",
  );
});

test("WhatsApp leva preço, URL e acento — sem XS XS", () => {
  const text = formatVehicleWhatsAppMessage({
    brand: "Toyota",
    model: "ETIOS XS",
    version: "XS 1.5 16V Flex Automatico",
    yearModel: 2017,
    transmission: "Automático",
    price: 64900,
    path: "/estoque/toyota-etios-xs-2017-cmturwtw30000l804s8700mu4",
    origin: "https://www.suagaragem.net",
  });
  assert.match(text, /Toyota Etios XS 1\.5 Flex 2017/);
  assert.doesNotMatch(text, /XS XS/);
  assert.match(text, /R\$\s*64\.900/);
  assert.match(
    text,
    /https:\/\/www\.suagaragem\.net\/estoque\/toyota-etios-xs-2017-cmturwtw30000l804s8700mu4/,
  );
  assert.doesNotMatch(text, /Automatico/);
  assert.match(text, /Sua Garagem/);
});

test("mensagem de financiamento cita análise e CET", () => {
  const text = formatVehicleWhatsAppMessage({
    brand: "Honda",
    model: "HR-V",
    version: "EX 1.8 FLEX ONE Automático",
    yearModel: 2018,
    price: 89900,
    path: "/estoque/honda-hr-v-2018-abc",
    intent: "finance",
    origin: "https://www.suagaragem.net",
  });
  assert.match(text, /análise de crédito e CET/);
  assert.match(text, /R\$\s*89\.900/);
});

test("acessórios duplicados colapsam (hífen / caixa)", () => {
  assert.deepEqual(
    collapseDuplicateAccessories([
      "Ar-condicionado",
      "ar condicionado",
      "Bluetooth",
      "Bluetooth",
    ]),
    ["Ar-condicionado", "Bluetooth"],
  );
});

test("Destaque fica limitado aos primeiros N featured", () => {
  const ids = featuredBadgeIds(
    [
      { id: "a", featured: true },
      { id: "b", featured: false },
      { id: "c", featured: true },
      { id: "d", featured: true },
      { id: "e", featured: true },
    ],
    3,
  );
  assert.deepEqual([...ids], ["a", "c", "d"]);
  assert.equal(featuredBadgeIds([{ id: "a", featured: true }], 0).size, 0);
});
