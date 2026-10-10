import assert from "node:assert/strict";
import test from "node:test";
import {
  VEHICLE_SPECS,
  detectSpecTopics,
  directSpecReply,
  fallbackSpecReply,
  findVehicleSpec,
  formatSpecForPrompt,
  rankingSpecReply,
  specAutonomy,
  specCriterionFromMessage,
  type SpecSubject,
  type VehicleSpec,
} from "./chat-specs";
import { technicalReference } from "./chat-technical-reference";
import type { ChatVehicleRecord } from "./chat-stock";

const car = (
  brand: string,
  model: string,
  version: string,
  yearModel: number,
  transmission: string,
  engine: string,
  category = "carro",
): SpecSubject => ({ brand, model, version, yearModel, transmission, engine, category });

/** O estoque que o Lucas listou, com as versões como aparecem nos anúncios. */
const STOCK: Array<[string, SpecSubject]> = [
  ["honda-city-1.5-cvt", car("Honda", "City", "EXL 1.5 CVT", 2018, "Automático", "1.5")],
  ["vw-gol-1.0-g5", car("Volkswagen", "Gol", "Trend 1.0", 2012, "Manual", "1.0")],
  ["ford-ka-sedan-1.5-at", car("Ford", "Ka Sedan", "SE 1.5 Aut", 2019, "Automático", "1.5")],
  ["renault-duster-2.0-at", car("Renault", "Duster", "Dynamique 2.0", 2014, "Automático", "2.0")],
  ["honda-hrv-1.8-cvt", car("Honda", "HR-V", "EXL 1.8", 2016, "Automático", "1.8")],
  ["honda-civic-2.0-at5", car("Honda", "Civic", "LXR 2.0", 2015, "Automático", "2.0")],
  ["honda-civic-2.0-cvt", car("Honda", "Civic", "EXL 2.0", 2020, "Automático", "2.0")],
  ["fiat-mobi-1.0", car("Fiat", "Mobi", "Like 1.0", 2024, "Manual", "1.0")],
  ["fiat-palio-fire-1.0", car("Fiat", "Palio", "Celebration 1.0", 2008, "Manual", "1.0")],
  ["fiat-palio-weekend-adventure-1.8-manual", car("Fiat", "Palio Weekend", "Adventure 1.8", 2016, "Manual", "1.8")],
  ["fiat-palio-weekend-adventure-1.8-dualogic", car("Fiat", "Palio Weekend", "Adventure 1.8 Dualogic", 2016, "Automatizado", "1.8")],
  ["toyota-corolla-altis-2.0", car("Toyota", "Corolla", "Altis 2.0", 2018, "Automático", "2.0")],
  ["hyundai-hb20s-1.0-tgdi", car("Hyundai", "HB20S", "Comfort Plus 1.0 TGDI Aut", 2024, "Automático", "1.0 TGDI")],
  ["hyundai-hb20-1.6-at", car("Hyundai", "HB20", "Premium 1.6 Aut", 2015, "Automático", "1.6 Aspirado")],
  ["hyundai-hb20-1.0", car("Hyundai", "HB20", "Evolution 1.0", 2022, "Manual", "1.0 Aspirado")],
  ["nissan-kicks-1.6-cvt", car("Nissan", "Kicks", "SL 1.6 CVT", 2019, "Automático", "1.6")],
  ["mitsubishi-lancer-2.0-cvt", car("Mitsubishi", "Lancer", "2.0 Aut", 2014, "Automático", "2.0")],
  ["vw-nivus-200-tsi", car("Volkswagen", "Nivus", "Highline 200 TSI", 2021, "Automático", "1.0 TSI")],
  ["honda-biz-110i", car("Honda", "Biz", "110i", 2023, "Manual", "110cc", "moto")],
  ["honda-biz-125", car("Honda", "Biz", "125", 2023, "Manual", "125cc", "moto")],
  ["honda-cg-160", car("Honda", "CG", "160 Fan", 2023, "Manual", "160cc", "moto")],
];

test("cada veículo do estoque atual encontra a ficha certa", () => {
  for (const [id, subject] of STOCK) {
    assert.equal(findVehicleSpec(subject)?.id, id, `${subject.brand} ${subject.model} ${subject.version} ${subject.yearModel}`);
  }
});

test("a ficha não vale para outro ano, motor, carroceria ou marca", () => {
  const hb16 = car("Hyundai", "HB20", "Premium 1.6 Aut", 2015, "Automático", "1.6");
  assert.equal(findVehicleSpec({ ...hb16, yearModel: 2022 })?.id, undefined);
  assert.equal(findVehicleSpec({ ...hb16, engine: "1.0", version: "Premium 1.0" }), null);
  assert.equal(findVehicleSpec({ ...hb16, brand: "Fiat" }), null);
  // HB20 hatch não é HB20S, e Ka hatch não é Ka Sedan.
  assert.equal(findVehicleSpec(car("Hyundai", "HB20S", "Comfort Plus 1.0 TGDI", 2015, "Automático", "1.0 TGDI")), null);
  assert.equal(findVehicleSpec(car("Ford", "Ka", "SE 1.0", 2019, "Manual", "1.0")), null);
  // Palio Weekend não herda a ficha do Palio Fire, nem o contrário.
  assert.equal(findVehicleSpec(car("Fiat", "Palio", "Celebration 1.0", 2016, "Manual", "1.0")), null);
  // Civic de outra geração.
  assert.equal(findVehicleSpec(car("Honda", "Civic", "LX 2.0", 2013, "Automático", "2.0")), null);
  // Moto não pega ficha de carro.
  assert.equal(findVehicleSpec(car("Honda", "Biz", "110i", 2023, "Manual", "110cc", "carro")), null);
});

test("as fichas têm números coerentes e ids únicos", () => {
  assert.equal(new Set(VEHICLE_SPECS.map((spec) => spec.id)).size, VEHICLE_SPECS.length);
  for (const spec of VEHICLE_SPECS) {
    const where = spec.id;
    assert.ok(spec.anos[0] <= spec.anos[1], where);
    assert.ok(Math.max(spec.cv.etanol ?? 0, spec.cv.gasolina ?? 0) > 0, where);
    assert.ok(Math.max(spec.torque.etanol ?? 0, spec.torque.gasolina ?? 0) > 0, where);
    assert.ok(spec.tanque == null || spec.tanque > 3, where);
    if (!spec.moto) {
      assert.ok(spec.cv.gasolina! >= 60 && spec.cv.gasolina! <= 200, where);
      assert.ok(spec.tanque! >= 40 && spec.tanque! <= 65, where);
      assert.ok(spec.portaMalas! >= 190 && spec.portaMalas! <= 550, where);
      assert.ok(spec.zeroACem! >= 9 && spec.zeroACem! <= 16, where);
      // Inmetro: a estrada rende mais que a cidade, e a gasolina mais que o etanol.
      for (const fuel of ["etanol", "gasolina"] as const) {
        const city = spec.cidade?.[fuel];
        const road = spec.estrada?.[fuel];
        if (city != null && road != null) assert.ok(road > city, `${where} ${fuel}`);
      }
      if (spec.combustivel === "flex") {
        assert.ok(spec.cidade!.gasolina! > spec.cidade!.etanol!, where);
        assert.ok(spec.estrada!.gasolina! > spec.estrada!.etanol!, where);
        assert.ok(spec.cv.etanol! >= spec.cv.gasolina! || spec.id.includes("hrv"), where);
      }
      assert.ok(spec.dim && spec.dim.entreEixos < spec.dim.comprimento, where);
    }
    assert.ok(spec.seguranca.length > 10 && spec.manutencao.length > 20, where);
  }
});

test("as fichas de Duster e Civic batem com os catálogos já revisados no repositório", () => {
  const base = { id: "x", km: 1, price: 1, color: null, fuel: "Flex", category: "carro", transmission: "Automático", engine: "2.0" };
  const duster: ChatVehicleRecord = { ...base, brand: "Renault", model: "Duster", version: "Dynamique 2.0 16V Tech Road 2", yearModel: 2014 };
  const dusterSpec = findVehicleSpec(duster)!;
  assert.match(technicalReference(duster, "potência")!.paragraphs[0]!.text, new RegExp(`${dusterSpec.cv.etanol} cv com etanol e ${dusterSpec.cv.gasolina} cv com gasolina`));
  assert.match(technicalReference(duster, "torque")!.paragraphs[0]!.text, /20,9 kgfm com etanol e 19,7 kgfm com gasolina/);
  assert.deepEqual(dusterSpec.torque, { etanol: 20.9, gasolina: 19.7 });
  const civic20: ChatVehicleRecord = { ...base, brand: "Honda", model: "Civic", version: "EXL 2.0 FLEX 16v", yearModel: 2020 };
  const civicSpec = findVehicleSpec(civic20)!;
  assert.match(technicalReference(civic20, "potência")!.paragraphs[0]!.text, new RegExp(`${civicSpec.cv.etanol} cv com etanol e ${civicSpec.cv.gasolina} cv com gasolina`));
  assert.deepEqual(civicSpec.torque, { etanol: 19.5, gasolina: 19.3 });
});

test("autonomia é tanque × consumo do Inmetro, arredondada a 10 km", () => {
  const kicks = VEHICLE_SPECS.find((spec) => spec.id === "nissan-kicks-1.6-cvt")!;
  assert.deepEqual(specAutonomy(kicks), {
    cidade: { etanol: 320, gasolina: 470 },
    estrada: { etanol: 390, gasolina: 560 },
  });
  const hb = VEHICLE_SPECS.find((spec) => spec.id === "hyundai-hb20-1.6-at")!;
  assert.deepEqual(specAutonomy(hb), {
    cidade: { etanol: 350, gasolina: 510 },
    estrada: { etanol: 420, gasolina: 590 },
  });
  const lancer = VEHICLE_SPECS.find((spec) => spec.id === "mitsubishi-lancer-2.0-cvt")!;
  assert.deepEqual(specAutonomy(lancer), { cidade: { gasolina: 520 }, estrada: { gasolina: 630 } });
  const biz = VEHICLE_SPECS.find((spec) => spec.id === "honda-biz-125")!;
  assert.equal(specAutonomy(biz)?.estrada.gasolina, 200);
  const cg = VEHICLE_SPECS.find((spec) => spec.id === "honda-cg-160")!;
  assert.equal(specAutonomy(cg), null, "sem tanque na ficha, sem autonomia inventada");
});

test("a ficha no prompt traz a autonomia já calculada e separa dado do modelo", () => {
  const kicks = VEHICLE_SPECS.find((spec) => spec.id === "nissan-kicks-1.6-cvt")!;
  const text = formatSpecForPrompt(kicks, "Kicks 1.6");
  assert.match(text, /Potência: 114 cv, tanto no etanol quanto na gasolina; torque: 15,5 kgfm/);
  assert.match(text, /autonomia teórica de tanque cheio \(já calculada\): cidade ~320 km etanol \/ ~470 km gasolina; estrada ~390 km etanol \/ ~560 km gasolina/);
  assert.match(text, /Consumo Inmetro \(km\/l\): cidade 7,7 km\/l no etanol e 11,4 km\/l na gasolina/);
  assert.match(text, /Manutenção típica do modelo/);
  assert.doesNotMatch(text, /esta unidade tem|R\$/);
});

test("tópicos das perguntas de especialista", () => {
  const cases: Array<[string, string[]]> = [
    ["quantos cv tem o hb20 1.6?", ["potencia"]],
    ["qual o torque do civic", ["torque"]],
    ["0 a 100 do Civic", ["aceleracao"]],
    ["consumo e autonomia do Kicks", ["consumo", "autonomia"]],
    ["quantas marchas tem o Corolla", ["cambio"]],
    ["o câmbio do City é CVT?", ["cambio"]],
    ["quanto de porta-malas tem o Duster?", ["portamalas"]],
    ["qual o tamanho do Kicks? dimensões", ["dimensoes"]],
    ["o Gol tem airbag e ABS?", ["seguranca"]],
    ["esse hb20 é bom de manutenção?", ["manutencao"]],
    ["qual o mais forte?", ["ranking", "potencia"]],
    ["qual gasta menos?", ["ranking"]],
    ["qual a diferença entre o HB20 e o Onix?", ["comparacao"]],
    ["o hb20 é econômico?", ["consumo"]],
  ];
  for (const [message, expected] of cases) {
    const topics = detectSpecTopics(message);
    for (const topic of expected) assert.ok(topics.includes(topic as never), `${message} -> ${topics.join(",")}`);
  }
  // Conversa de loja não vira pergunta técnica.
  for (const message of ["Boa tarde, vocês pegam carro na troca?", "Quero financiar, consigo dar uns 20 mil de entrada. Como funciona?", "tô só olhando por enquanto, vlw", "quanto custa o hb20?", "esse carro ainda tem?", "sem problema, pode ser amanhã", "carros até 70 mil"]) {
    assert.deepEqual(detectSpecTopics(message), [], message);
  }
});

const entry = (id: string, nome: string) => ({ spec: VEHICLE_SPECS.find((spec) => spec.id === id)!, nome });

test("resposta direta: cv do HB20 1.6 como o vendedor falaria", () => {
  const reply = directSpecReply(["potencia"], [entry("hyundai-hb20-1.6-at", "HB20 1.6")], "quantos cv tem o hb20 1.6?");
  assert.equal(
    reply,
    "O HB20 1.6 tem cerca de 128 cv no etanol e 122 cv na gasolina. São números de referência dessa versão; podem variar um pouco na prática.",
  );
});

test("resposta direta: câmbio e marchas de CVT, automático convencional e manual", () => {
  const city = directSpecReply(["cambio"], [entry("honda-city-1.5-cvt", "City 1.5")], "quantas marchas tem o City?")!;
  assert.match(city, /câmbio CVT, que não tem marchas fixas; no modo manual ele simula 7 marchas/);
  const corolla = directSpecReply(["cambio"], [entry("toyota-corolla-altis-2.0", "Corolla 2.0")], "quantas marchas tem o Corolla?")!;
  assert.match(corolla, /CVT.*7 marchas/);
  const hb = directSpecReply(["cambio"], [entry("hyundai-hb20-1.6-at", "HB20 1.6")], "quantas marchas tem o hb20?")!;
  assert.match(hb, /automático convencional \(conversor de torque\) de 4 marchas/);
  assert.doesNotMatch(hb, /podem variar/, "câmbio é fixo do modelo; sem aviso de variação");
  const gol = directSpecReply(["cambio"], [entry("vw-gol-1.0-g5", "Gol 1.0")], "quantas marchas")!;
  assert.match(gol, /manual de 5 marchas/);
  const dualogic = directSpecReply(["cambio"], [entry("fiat-palio-weekend-adventure-1.8-dualogic", "Weekend Adventure 1.8")], "que câmbio é esse")!;
  assert.match(dualogic, /Dualogic.*embreagem a seco/);
});

test("resposta direta: 0 a 100, torque, porta-malas e consumo", () => {
  const civic = entry("honda-civic-2.0-at5", "Civic 2.0");
  assert.match(directSpecReply(["aceleracao"], [civic], "0 a 100 do Civic")!, /0 a 100 km\/h em cerca de 10,9 segundos/);
  assert.match(directSpecReply(["torque"], [civic], "torque")!, /O torque do Civic 2\.0 é de cerca de 19,5 kgfm no etanol e 19,3 kgfm na gasolina, a 4\.800 rpm/);
  assert.match(directSpecReply(["portamalas"], [entry("toyota-corolla-altis-2.0", "Corolla 2.0")], "porta-malas")!, /O porta-malas do Corolla 2\.0 tem cerca de 470 litros\./);
  assert.match(directSpecReply(["portamalas"], [entry("renault-duster-2.0-at", "Duster 2.0")], "porta-malas")!, /porta-malas da Duster 2\.0/);
  const kicks = directSpecReply(["consumo", "autonomia"], [entry("nissan-kicks-1.6-cvt", "Kicks 1.6")], "consumo e autonomia do Kicks")!;
  assert.match(kicks, /Pelo Inmetro, o Kicks 1\.6 faz cerca de 7,7 km\/l na cidade e 9,4 km\/l na estrada com etanol; na gasolina, 11,4 km\/l na cidade e 13,7 km\/l na estrada\./);
  assert.match(kicks, /Com o tanque cheio \(41 litros\), o Kicks 1\.6 faz, com etanol, cerca de 320 km na cidade e 390 km na estrada; com gasolina, cerca de 470 km na cidade e 560 km na estrada/);
  assert.match(kicks, /conta teórica/);
});

test("resposta direta: vários carros em frases separadas e nada de chute fora da ficha", () => {
  const reply = directSpecReply(
    ["potencia"],
    [entry("hyundai-hb20s-1.0-tgdi", "HB20S 1.0 turbo"), entry("hyundai-hb20-1.6-at", "HB20 1.6"), entry("hyundai-hb20-1.0", "HB20 1.0")],
    "quantos cv tem o hb20?",
  )!;
  assert.match(reply, /HB20S 1\.0 turbo tem cerca de 120 cv, tanto no etanol quanto na gasolina/);
  assert.match(reply, /HB20 1\.6 tem cerca de 128 cv/);
  assert.match(reply, /HB20 1\.0 tem cerca de 80 cv no etanol e 75 cv na gasolina/);
  // Comparação, ranking e mais de 3 carros ficam para o modelo de linguagem.
  assert.equal(directSpecReply(["ranking", "potencia"], [entry("hyundai-hb20-1.6-at", "HB20 1.6")], "qual o mais forte"), null);
  assert.equal(directSpecReply(["seguranca"], [entry("hyundai-hb20-1.6-at", "HB20 1.6")], "tem abs?"), null);
  // Moto sem tanque na ficha: não inventa autonomia.
  assert.equal(directSpecReply(["autonomia"], [entry("honda-cg-160", "CG 160")], "autonomia"), null);
});

test("reserva sem o modelo de linguagem cobre segurança, manutenção e dimensões", () => {
  const hb = entry("hyundai-hb20-1.6-at", "HB20 1.6");
  assert.match(fallbackSpecReply(["seguranca"], [hb], "tem abs?")!, /equipamentos de segurança.*vendedor confirma/);
  assert.match(fallbackSpecReply(["manutencao"], [hb], "manutenção")!, /Gamma.*Isso vale para o modelo; o estado desta unidade/);
  assert.match(fallbackSpecReply(["dimensoes"], [hb], "dimensões")!, /3\.900 mm de comprimento, 1\.680 mm de largura e 1\.470 mm de altura, com 2\.500 mm entre-eixos/);
  const gol = fallbackSpecReply(["seguranca"], [entry("vw-gol-1.0-g5", "Gol 1.0")], "airbag")!;
  assert.match(gol, /equipamentos de segurança.*dependem da versão e do ano/);
  assert.doesNotMatch(gol, /traz/);
});

test("ranking: o mais forte em cv, com a nuance do torque do turbo", () => {
  const entries = [entry("hyundai-hb20s-1.0-tgdi", "HB20S 1.0 turbo"), entry("hyundai-hb20-1.6-at", "HB20 1.6"), entry("hyundai-hb20-1.0", "HB20 1.0")];
  assert.equal(specCriterionFromMessage("qual o mais forte?"), "forca");
  assert.equal(specCriterionFromMessage("qual o mais potente?"), "potencia");
  const power = rankingSpecReply("forca", entries)!;
  // Potência e torque juntos, sem contradição: o 1.6 leva em cv, o turbo entrega o torque bem mais cedo.
  assert.match(power, /^Depende do que você chama de forte\. Em potência máxima, o HB20 1\.6 leva: 128 cv no etanol e 122 cv na gasolina, mas o torque dele \(16,5 kgfm no etanol e 16 kgfm na gasolina\) só aparece em giro alto, a 5\.000 rpm\./);
  assert.match(power, /O HB20S 1\.0 turbo tem 120 cv, só um pouco menos, e entrega 17,5 kgfm a 1\.500 rpm, bem mais cedo: é o que responde melhor em retomada e ultrapassagem\./);
  assert.match(power, /Já o HB20 1\.0 tem 80 cv no etanol e 75 cv na gasolina\./);
  assert.match(power, /Resumindo: potência de pico, HB20 1\.6; força logo ao pisar no acelerador, HB20S 1\.0 turbo\./);
  assert.doesNotMatch(power, /é o mais forte|mais fraco/);
  // "Mais potente" pergunta só potência: resposta direta, com a nuance do torque no fim.
  const potente = rankingSpecReply("potencia", entries)!;
  assert.match(potente, /^Entre esses, o HB20 1\.6 \(128 cv no etanol e 122 cv na gasolina\) é o mais forte em potência\./);
  assert.match(potente, /Em torque, porém, o HB20S 1\.0 turbo leva: 17,5 kgfm contra 16,5 kgfm\./);
  // Quando o mesmo carro lidera cv e torque, a resposta é direta.
  const same = rankingSpecReply("forca", [entry("hyundai-hb20s-1.0-tgdi", "HB20S 1.0 turbo"), entry("hyundai-hb20-1.0", "HB20 1.0")])!;
  assert.match(same, /^Entre esses, o HB20S 1\.0 turbo \(120 cv/);
  assert.equal(specCriterionFromMessage("qual gasta menos?"), "economia");
  const economy = rankingSpecReply("economia", entries)!;
  assert.match(economy, /o HB20 1\.0 \(cerca de 13,1 km\/l na cidade, na gasolina\) é o mais econômico/);
  assert.match(rankingSpecReply("espaco", [entry("honda-civic-2.0-cvt", "Civic 2.0"), entry("fiat-mobi-1.0", "Mobi 1.0")])!, /Civic 2\.0 \(519 L de porta-malas\) é o mais espaçoso/);
  assert.equal(rankingSpecReply("potencia", [entries[0]!]), null);
});

test("nenhuma ficha cita preço, cidade ou fala da unidade usada", () => {
  const forbidden = /R\$|\bpreço\b|Vitória|Linhares|Aracruz|Garagem|Sua Garagem|da unidade|desta unidade|esta unidade/i;
  for (const spec of VEHICLE_SPECS as VehicleSpec[]) {
    assert.doesNotMatch(formatSpecForPrompt(spec), forbidden, spec.id);
    assert.doesNotMatch(`${spec.seguranca} ${spec.manutencao}`, /revisões feitas|único dono|laudo|garantia de fábrica da unidade/i, spec.id);
  }
});

test("números de referência do coordenador: HB20 1.6, HB20S TGDI, Kicks, City e HB20 1.0", () => {
  const byId = (id: string) => VEHICLE_SPECS.find((spec) => spec.id === id)!;
  const hb16 = byId("hyundai-hb20-1.6-at");
  assert.deepEqual(hb16.cv, { etanol: 128, gasolina: 122 });
  assert.deepEqual(hb16.torque, { etanol: 16.5, gasolina: 16 });
  assert.equal(hb16.torqueRpm, "5.000 rpm");
  const tgdi = byId("hyundai-hb20s-1.0-tgdi");
  assert.deepEqual(tgdi.cv, { etanol: 120, gasolina: 120 });
  assert.deepEqual(tgdi.torque, { etanol: 17.5, gasolina: 17.5 });
  assert.equal(tgdi.zeroACem, 10.7);
  assert.equal(tgdi.marchas, 6);
  assert.equal(tgdi.portaMalas, 475);
  assert.equal(tgdi.tanque, 50);
  assert.match(tgdi.manutencao, /corrente/);
  const kicks = byId("nissan-kicks-1.6-cvt");
  assert.deepEqual(kicks.cidade, { etanol: 7.7, gasolina: 11.4 });
  assert.deepEqual(kicks.estrada, { etanol: 9.4, gasolina: 13.7 });
  assert.equal(kicks.tanque, 41);
  const city = byId("honda-city-1.5-cvt");
  assert.match(city.cambio, /7 marchas/);
  assert.match(city.cambio, /borboletas/);
  assert.equal(byId("hyundai-hb20-1.0").cv.etanol, 80);
});
