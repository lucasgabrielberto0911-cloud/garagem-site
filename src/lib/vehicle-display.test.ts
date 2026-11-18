import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyPtAccents,
  buildVehicleFullLabel,
  collapseDuplicateAccessories,
  collapseWhitespace,
  colorFilterValues,
  colorWhere,
  featuredBadgeIds,
  formatCardVersion,
  formatColorLabel,
  formatStockModelLabel,
  formatTransmissionLabel,
  formatVehicleDisplay,
  formatVehicleWhatsAppMessage,
  gearsConflict,
  inferGearFromText,
  modelFilterValues,
  modelWhere,
  resolveTransmission,
  shortVersion,
  suggestedTransmission,
  transmissionConflictAlert,
  transmissionFilterLabel,
  transmissionFilterOptions,
  transmissionFilterParam,
  transmissionFilterValues,
  transmissionWhere,
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

test("HR-V Grafite e Cinza viram o mesmo rótulo", () => {
  assert.equal(formatColorLabel("Grafite"), "Cinza");
  assert.equal(formatColorLabel("cinza grafite"), "Cinza");
  assert.equal(formatColorLabel("Cinza"), "Cinza");
  assert.equal(formatColorLabel("branco"), "Branco");
  assert.equal(formatColorLabel(""), "");

  const hrv = formatVehicleDisplay({
    id: "cmtbv7xso0000l50429oklxxy",
    brand: "Honda",
    model: "HR-V",
    version: "EX 1.8 FLEX ONE Automático",
    yearModel: 2018,
    transmission: "Automático",
    color: "Grafite",
  });
  assert.equal(hrv.color, "Cinza");
  assert.ok(hrv.metaParts.includes("Cinza"));
  assert.ok(!hrv.metaParts.includes("Grafite"));

  const values = colorFilterValues("Cinza");
  assert.ok(values.includes("Cinza"));
  assert.ok(values.includes("grafite"));
  const where = colorWhere("Cinza") as { OR?: unknown };
  assert.ok(Array.isArray(where.OR));
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

test("Fox 1.6 Bluemotion não duplica a cilindrada na versão", () => {
  assert.equal(
    shortVersion("FOX 1.6 BLUEMOTION 1.6 GII", "FOX 1.6"),
    "Bluemotion GII",
  );
  assert.equal(
    shortVersion("1.6 BLUEMOTION 1.6 GII", "FOX"),
    "1.6 Bluemotion GII",
  );
  const display = formatVehicleDisplay({
    id: "c-fox-bluemotion",
    brand: "Volkswagen",
    model: "FOX 1.6",
    version: "FOX 1.6 BLUEMOTION 1.6 GII",
    yearModel: 2014,
    transmission: "Manual",
    km: 98000,
    price: 38900,
    color: "prata",
  });
  assert.equal(display.title, "Volkswagen Fox 1.6");
  assert.equal(display.version, "Bluemotion GII");
  assert.doesNotMatch(display.version, /1\.6/);
  assert.doesNotMatch(`${display.title} ${display.version}`, /1\.6.*1\.6/);
  assert.doesNotMatch(display.fullLabel, /1\.6.*1\.6/);
  assert.doesNotMatch(display.fullLabel, /FOX 1\.6 BLUEMOTION 1\.6/i);
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

test("normaliza versão iniciada em minúscula para exibição", () => {
  assert.equal(shortVersion("evolution 1.0", "HB20"), "Evolution 1.0");
});

test("formatCardVersion remove repetição do modelo e normaliza grafias conhecidas", () => {
  assert.equal(formatCardVersion("160 Start", "CG 160 Start"), "");
  assert.equal(formatCardVersion("Start", "CG 160 Start"), "");
  assert.equal(formatCardVersion("tart", "CG 160 Start"), "Tart");
  assert.equal(formatCardVersion("ic", "Civic"), "Ic");
  assert.equal(formatCardVersion("la", "Corolla"), "La");
  assert.equal(formatCardVersion("evolution 1.0", "HB20"), "Evolution 1.0");
  assert.equal(formatCardVersion("Ka+ SE PLUS 1.5", "Ka+"), "Ka+ SE Plus 1.5");
  assert.equal(formatCardVersion("EXL 1.5 CVT I-VTEC", "City"), "EXL 1.5 CVT i-VTEC");
  assert.equal(formatCardVersion("Dynamique 2.0 16V Tech Road 2", "Duster"), "Dynamique 2.0 16V Tech Road 2");
});

test("versão terminada em número solto separa o ano por travessão (regra geral)", () => {
  const duster = buildVehicleFullLabel({
    brand: "Renault",
    model: "Duster",
    version: "Dynamique 2.0 16V Tech Road 2",
    yearModel: 2014,
  });
  assert.match(duster, /Tech Road 2 · 2014/);
  const outro = (version: string) =>
    buildVehicleFullLabel({ brand: "Fiat", model: "Uno", version, yearModel: 2014 });
  assert.match(outro("Sport Pack 3"), /Pack 3 · 2014$/);
  assert.match(outro("Way 1.0"), /Way 1\.0 2014$/);
});

test("filtro de câmbio aceita o slug da URL e o rótulo gravado", () => {
  assert.equal(transmissionFilterParam("automatico"), "automatico");
  assert.equal(transmissionFilterParam("Automático"), "automatico");
  assert.equal(transmissionFilterParam("AUTOMATICA"), "automatico");
  assert.equal(transmissionFilterParam("manual"), "manual");
  assert.equal(transmissionFilterParam("Manual"), "manual");
  // CVT, Semi-automático e Automatizado viram "automatico" no slug
  assert.equal(transmissionFilterParam("CVT"), "automatico");
  assert.equal(transmissionFilterParam("Semi-automático"), "automatico");
  assert.equal(transmissionFilterParam("Automatizado"), "automatico");
  assert.equal(transmissionFilterParam("  "), "");
  assert.equal(transmissionFilterLabel("automatico"), "Automático");
  assert.equal(transmissionFilterLabel("manual"), "Manual");
  // O rótulo do filtro é sempre "Automático" para CVT/Automatizado/Semi
  assert.equal(transmissionFilterLabel("CVT"), "Automático");
  assert.equal(transmissionFilterLabel("Semi-automático"), "Automático");

  const automatic = transmissionFilterValues("automatico");
  assert.ok(automatic.includes("Automático"));
  assert.ok(automatic.includes("Automatico"));
  // Automático agora inclui CVT, Automatizado e Semi-automático
  assert.ok(automatic.includes("CVT"));
  assert.ok(automatic.includes("Automatizado"));
  assert.ok(automatic.includes("Semi-automático"));
  assert.equal(automatic.some((item) => /^manual$/i.test(item)), false);

  const where = transmissionWhere("automatico") as {
    OR?: Array<{ transmission: { equals: string } }>;
  };
  const equals = (where.OR ?? []).map((item) => item.transmission.equals);
  assert.ok(equals.includes("Automático"));
  assert.ok(equals.includes("CVT"));
  assert.ok(equals.includes("Automatizado"));
  assert.ok(equals.includes("Semi-automático"));
  assert.equal(equals.includes("Manual"), false);

  // "cvt" no filtro busca o mesmo que "automatico"
  const cvtWhere = transmissionWhere("cvt") as {
    OR?: Array<{ transmission: { equals: string } }>;
  };
  const cvtEquals = (cvtWhere.OR ?? []).map((item) => item.transmission.equals);
  assert.ok(cvtEquals.includes("CVT"));
  assert.ok(cvtEquals.includes("Automático"), "CVT no filtro também pega Automático");

  const manual = transmissionWhere("Manual") as {
    OR?: Array<{ transmission: { equals: string } }>;
  };
  const manualEquals = (manual.OR ?? []).map((item) => item.transmission.equals);
  assert.ok(manualEquals.includes("Manual"));
  assert.equal(manualEquals.some((item) => /autom/i.test(item)), false);

  assert.deepEqual(transmissionWhere(""), {});
  assert.deepEqual(transmissionWhere(null), {});
  assert.deepEqual(transmissionWhere("   "), {});

  // O filtro só gera duas opções: automatico e manual
  const options = transmissionFilterOptions(
    ["Automático", "Automatico", "Manual", "CVT"],
    "automatico",
  );
  assert.deepEqual(
    options.map((item) => item.value),
    ["automatico", "manual"],
  );
  assert.equal(options[0]?.label, "Automático");
  const kept = transmissionFilterOptions(["Manual"], "automatico");
  assert.equal(kept[0]?.value, "automatico");
  assert.equal(kept.some((item) => item.value === "manual"), true);
});

test("câmbio alinhado não dispara alerta", () => {
  assert.equal(gearsConflict("XS 1.5 Flex Automático", "Automático"), false);
  assert.equal(resolveTransmission("XS 1.5 Flex Automático", "Automático"), "Automático");
  // CVT na versão agora resolve como "Automático" (regra de negócio)
  assert.equal(resolveTransmission("EXL CVT", "Automático"), "Automático");
  assert.equal(
    suggestedTransmission("EX 1.8 Automático", "Manual", ["Manual", "Automático"]),
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
  assert.match(
    text,
    /^Oi! Vi o Toyota Etios XS 1\.5 Flex 2017 por R\$\s*64\.900 no site da Garagem e quero saber mais\.\nhttps:\/\/www\.suagaragem\.net\/estoque\/toyota-etios-xs-2017-cmturwtw30000l804s8700mu4$/,
  );
  assert.doesNotMatch(text, /Sua Garagem/);
  assert.doesNotMatch(text, /Tenho interesse/);
});

test("mensagem de financiamento pergunta sobre financiamento", () => {
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
  assert.match(text, /quero saber sobre o financiamento/);
  assert.match(text, /R\$\s*89\.900/);
  assert.doesNotMatch(text, /análise de crédito e CET/);
  assert.doesNotMatch(text, /Sua Garagem/);
});

test("WhatsApp troca, vídeo e visita no tom natural", () => {
  const base = {
    brand: "Honda",
    model: "HR-V",
    version: "EX 1.8 FLEX ONE Automático",
    yearModel: 2018,
    price: 89900,
    path: "/estoque/honda-hr-v-2018-abc",
    origin: "https://www.suagaragem.net",
  };
  const trade = formatVehicleWhatsAppMessage({ ...base, intent: "trade" });
  assert.match(trade, /quero avaliar uma troca/);
  assert.match(trade, /por R\$\s*89\.900/);
  assert.equal(
    trade.split("\n")[1],
    "https://www.suagaragem.net/estoque/honda-hr-v-2018-abc",
  );

  const video = formatVehicleWhatsAppMessage({ ...base, intent: "video" });
  assert.match(video, /queria um vídeo dele/);

  const visit = formatVehicleWhatsAppMessage({ ...base, intent: "visit" });
  assert.match(visit, /quero ver ele de perto/);
});

test("vendido não leva preço em nenhuma intenção de WhatsApp", () => {
  const base = { brand: "Fiat", model: "Pulse", version: "Drive", yearModel: 2022,
    price: 89900, status: "vendido", path: "/estoque/fiat-pulse-drive-2022-sold" };
  for (const intent of ["interest", "similar", "finance", "trade", "video", "visit"] as const) {
    const message = formatVehicleWhatsAppMessage({ ...base, intent });
    assert.match(message, /Fiat Pulse Drive 2022 já foi vendido/);
    assert.match(message, /opções parecidas no estoque/);
    assert.doesNotMatch(message, /R\$|89[.,]?900|parcelas|troca|vídeo|mesma faixa/);
    assert.equal(message.split("\n")[1], `https://www.suagaragem.net${base.path}`);
  }
  const available = formatVehicleWhatsAppMessage({ ...base, status: "disponivel", intent: "finance" });
  assert.match(available, /por R\$\s*89\.900.*saber sobre o financiamento/);
  const reserved = formatVehicleWhatsAppMessage({ ...base, status: "reservado" });
  assert.match(reserved, /por R\$\s*89\.900.*quero saber mais/);
  assert.match(formatVehicleWhatsAppMessage({ ...base, brand: "Honda", model: "Biz", isMoto: true }), /já foi vendida/);
});

test("WhatsApp sem preço não inventa “por R$” e sem path não manda URL", () => {
  const noPrice = formatVehicleWhatsAppMessage({
    brand: "Hyundai",
    model: "HB20",
    yearModel: 2022,
    price: 0,
    path: "/estoque/hyundai-hb20-2022",
    origin: "https://www.suagaragem.net",
  });
  assert.match(
    noPrice,
    /^Oi! Vi o Hyundai HB20 2022 no site da Garagem e quero saber mais\./,
  );
  assert.doesNotMatch(noPrice, /por R\$/);

  for (const missing of [null, undefined] as const) {
    const text = formatVehicleWhatsAppMessage({
      brand: "Hyundai",
      model: "HB20",
      yearModel: 2022,
      price: missing,
      path: "/estoque/hyundai-hb20-2022",
      origin: "https://www.suagaragem.net",
    });
    assert.match(
      text,
      /^Oi! Vi o Hyundai HB20 2022 no site da Garagem e quero saber mais\./,
    );
    assert.doesNotMatch(text, /por R\$/);
  }

  const noPath = formatVehicleWhatsAppMessage({
    brand: "Hyundai",
    model: "HB20",
    yearModel: 2022,
    price: 64900,
  });
  assert.match(
    noPath,
    /^Oi! Vi o Hyundai HB20 2022 por R\$\s*64\.900 no site da Garagem e quero saber mais\.$/,
  );
  assert.doesNotMatch(noPath, /https:\/\//);

  const moto = formatVehicleWhatsAppMessage({
    brand: "Honda",
    model: "BIZ 125",
    yearModel: 2023,
    price: 14900,
    isMoto: true,
    intent: "video",
  });
  assert.match(moto, /Vi a Honda BIZ 125 2023 por R\$\s*14\.900/);
  assert.match(moto, /queria um vídeo dela/);
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

test("acessórios com palavras truncadas e parênteses abertos são sanitizados", () => {
  assert.deepEqual(
    collapseDuplicateAccessories([
      "Painel digital blackout (velocímetro digital, hodômetro e marcador de combustíve",
      "Tampa do tanque de combustível estilo aviação (articulada",
      "Painel com conta-giros (tacômetro",
      "Assento largo (piloto + garupa",
    ]),
    [
      "Painel digital blackout (velocímetro digital, hodômetro e marcador de combustível)",
      "Tampa do tanque de combustível estilo aviação (articulada)",
      "Painel com conta-giros (tacômetro)",
      "Assento largo (piloto + garupa)",
    ],
  );
});

test("acessórios públicos válidos não perdem palavras por limite de entrada", () => {
  const text = "Sistema multimídia original com câmera de ré, Bluetooth e comandos no volante (compatível com Android Auto e Apple CarPlay)";
  assert.deepEqual(collapseDuplicateAccessories([text]), [text]);
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


/* ---------- Normalização de câmbio (item 3 da auditoria) ---------- */

test("resolveTransmission: CVT e Xtronic na versão resolvem como Automático", () => {
  assert.equal(resolveTransmission("EXL 1.5 CVT", "Automático"), "Automático");
  assert.equal(resolveTransmission("EXL 1.5 CVT", "CVT"), "Automático");
  assert.equal(resolveTransmission("1.6 SL Xtronic", "Xtronic"), "Automático");
  assert.equal(resolveTransmission("EXL 1.5 CVT", null), "Automático");
  assert.equal(resolveTransmission(null, "CVT"), "Automático");
  assert.equal(resolveTransmission(null, "Xtronic"), "Automático");
});

test("resolveTransmission: Automatizado e Semi-automático resolvem como Automático", () => {
  assert.equal(resolveTransmission(null, "Automatizado"), "Automático");
  assert.equal(resolveTransmission(null, "Semi-automático"), "Automático");
  assert.equal(resolveTransmission("1.0 Automatizado", "Automatizado"), "Automático");
  assert.equal(resolveTransmission("150 Semi-automático", "Semi-automático"), "Automático");
});

test("resolveTransmission: Manual permanece Manual", () => {
  assert.equal(resolveTransmission("1.0 Manual", "Manual"), "Manual");
  assert.equal(resolveTransmission(null, "Manual"), "Manual");
  assert.equal(resolveTransmission(null, "Mecânico"), "Manual");
});

test("formatTransmissionLabel: todas as variantes viram Automático ou Manual", () => {
  assert.equal(formatTransmissionLabel("CVT"), "Automático");
  assert.equal(formatTransmissionLabel("Automatizado"), "Automático");
  assert.equal(formatTransmissionLabel("Semi-automático"), "Automático");
  assert.equal(formatTransmissionLabel("AUTOMATICO"), "Automático");
  assert.equal(formatTransmissionLabel("Manual"), "Manual");
  assert.equal(formatTransmissionLabel("Mecânico"), "Manual");
});

test("filtro de câmbio: CVT/Semi/Automatizado mapeiam para automatico", () => {
  assert.equal(transmissionFilterParam("CVT"), "automatico");
  assert.equal(transmissionFilterParam("Semi-automático"), "automatico");
  assert.equal(transmissionFilterParam("Automatizado"), "automatico");
  assert.equal(transmissionFilterParam("semiautomatico"), "automatico");
});

test("transmissionWhere: Automático encontra veículos gravados como CVT", () => {
  const where = transmissionWhere("automatico") as {
    OR?: Array<{ transmission: { equals: string } }>;
  };
  const values = (where.OR ?? []).map((item) => item.transmission.equals);
  assert.ok(values.includes("CVT"), "Automático no filtro deve encontrar CVT");
  assert.ok(values.includes("Automatizado"), "Automático no filtro deve encontrar Automatizado");
  assert.ok(values.includes("Semi-automático"), "Automático no filtro deve encontrar Semi-automático");
});

test("transmissionFilterOptions: só gera Manual e Automático", () => {
  const options = transmissionFilterOptions(
    ["Automático", "Manual", "CVT", "Automatizado", "Semi-automático"],
  );
  const values = options.map((o) => o.value);
  assert.ok(values.includes("automatico"));
  assert.ok(values.includes("manual"));
  assert.equal(values.length, 2, "Deve ter exatamente 2 opções");
  assert.ok(options.every((o) => o.label === "Automático" || o.label === "Manual"));
});

test("cores compostas agrupam pela cor base e colorWhere usa startsWith", () => {
  assert.equal(formatColorLabel("Azul Meia-noite"), "Azul");
  assert.equal(formatColorLabel("Branca Com Rodas Douradas"), "Branco");
  assert.equal(formatColorLabel("Preta E Laranja"), "Preto");
  assert.equal(formatColorLabel("Azul-Marinho"), "Azul");
  assert.equal(formatColorLabel("Chumbo Grafite"), "Cinza");

  const whereBranco = colorWhere("Branco") as { OR: Array<{ color: Record<string, unknown> }> };
  assert.ok(
    whereBranco.OR.some(
      (cond) => cond.color.startsWith === "branca " && cond.color.mode === "insensitive",
    ),
  );
  const whereAzul = colorWhere("Azul") as { OR: Array<{ color: Record<string, unknown> }> };
  assert.ok(
    whereAzul.OR.some(
      (cond) => cond.color.startsWith === "azul " && cond.color.mode === "insensitive",
    ),
  );
  const wherePreto = colorWhere("Preto") as { OR: Array<{ color: Record<string, unknown> }> };
  assert.ok(
    wherePreto.OR.some(
      (cond) => cond.color.startsWith === "preta " && cond.color.mode === "insensitive",
    ),
  );
});

test("modelos equivalentes da Fazer 250 / FZ25 unificam no rótulo e no filtro", () => {
  assert.equal(formatStockModelLabel("Fazer FZ25"), "Fazer 250");
  assert.equal(formatStockModelLabel("Fazer FZ-25"), "Fazer 250");
  assert.equal(formatStockModelLabel("FZ25"), "Fazer 250");
  assert.equal(formatStockModelLabel("Fazer 250"), "Fazer 250");
  assert.equal(formatStockModelLabel("Civic"), "Civic");

  const values = modelFilterValues("Fazer 250");
  assert.ok(values.includes("Fazer 250"));
  assert.ok(values.includes("fazer fz25"));
  assert.ok(values.includes("fazer fz-25"));
  assert.ok(values.includes("fz25"));

  const where = modelWhere("Fazer 250") as { OR: Array<{ model: { equals: string } }> };
  assert.ok(Array.isArray(where.OR));
  assert.ok(where.OR.some((cond) => cond.model.equals === "fazer fz25"));
});
