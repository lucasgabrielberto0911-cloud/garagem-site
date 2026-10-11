import assert from "node:assert/strict";
import { test } from "node:test";
import { rankChatVehicles } from "./chat-prompt";
import { mentionedModelPools, type ChatVehicleRecord } from "./chat-stock";
import { runChatTurn } from "./chat-turn";

function carro(id: string, model: string, yearModel: number, km: number, price: number,
  extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord {
  return {
    id, model, yearModel, km, price, brand: "Fiat", version: "1.0",
    color: "Prata", transmission: "Manual", fuel: "Flex", category: "carro",
    engine: "1.0", accessories: [], ...extra,
  };
}

const palio = carro("palio", "Palio", 2008, 190_000, 24_900);
const gol = carro("gol", "Gol", 2012, 144_000, 32_900, { brand: "Volkswagen" });
const mobi = carro("mobi", "Mobi", 2024, 75_700, 57_900);
const hb20 = carro("hb20", "HB20", 2022, 68_450, 64_900, { brand: "Hyundai" });
const hb20s = carro("hb20s", "HB20S", 2024, 50_000, 87_900, {
  brand: "Hyundai", version: "Comfort Plus 1.0 TGDI", transmission: "Automático", engine: "1.0 TGDI",
});
const suv = carro("suv", "Compass", 2024, 10_000, 170_000, {
  brand: "Jeep", version: "Longitude 2.0", engine: "2.0", transmission: "Automático",
});
const biz125 = carro("biz125", "BIZ 125", 2023, 22_000, 14_900, {
  brand: "Honda", category: "moto", version: "EX Flex", engine: "125",
});
const biz110 = carro("biz110", "BIZ", 2023, 3_200, 15_200, {
  brand: "Honda", category: "moto", version: "110i EX", engine: "110",
});
const cg = carro("cg", "CG 160 Start", 2023, 450, 17_000, {
  brand: "Honda", category: "moto", version: "Start", engine: "160", fuel: "Gasolina",
});
const estoque = [palio, gol, suv, hb20s, hb20, mobi, biz125, biz110, cg];

function perguntar(mensagem: string, stock = estoque) {
  return runChatTurn({
    mensagem, historico: [], stock, readIntent: async () => null,
    generate: async () => { throw new Error("Este perfil deve responder sem LLM"); },
    researchVehicles: async () => { throw new Error("Este perfil deve usar apenas dados locais"); },
  });
}

function respostaCurta(reply: string) {
  assert.ok(reply.length < 750, reply);
  assert.doesNotMatch(reply, /\[LLM\]|undefined|Sua Garagem|fontes:|https?:\/\//i);
  assert.doesNotMatch(reply, /airbags?|ABS|câmera de ré|direção (?:elétrica|hidráulica)/i);
}

for (const mensagem of [
  "primeiro carro", "quero meu primeiro carro", "carro pra minha esposa",
  "carro pra minha filha que tirou a carteira", "aprendendo a dirigir",
  "carro pra mulher", "carro para minha namorada", "carro pra minha mãe",
  "quero carro pra minha esposa", "quero carro pra minha filha que tirou a carteira",
]) {
  test(`perfil urbano prioriza ano e km sem estereótipo: ${mensagem}`, async () => {
    const resultado = await perguntar(mensagem);
    assert.deepEqual(resultado.vehicles.map((vehicle) => vehicle.id), ["mobi", "hb20", "hb20s"]);
    assert.match(resultado.reply, /eu priorizaria o Mobi 2024/);
    assert.doesNotMatch(resultado.reply, /Palio|mais em conta|bom começo|esposa|filha|mulher|namorada|mãe|feminin/i);
    respostaCurta(resultado.reply);
  });
}

test("primeiro carro mantém prioridade dentro do teto de 40 mil", async () => {
  const resultado = await perguntar("primeiro carro até 40 mil");
  assert.deepEqual(resultado.vehicles.map((vehicle) => vehicle.id), ["gol", "palio"]);
  assert.ok(resultado.vehicles.every((vehicle) => vehicle.price <= 40_000));
  assert.match(resultado.reply, /eu priorizaria o Gol 2012/);
  assert.doesNotMatch(resultado.reply, /Palio.*bom começo|Mobi|HB20/);
});

test("menos km e câmbio automático desempatem opções de mesmo ano e preço", async () => {
  const manual = carro("manual", "HB20", 2022, 50_000, 64_900);
  const auto = { ...manual, id: "auto", transmission: "Automático" };
  const menosKm = { ...manual, id: "menos-km", km: 20_000 };
  assert.equal((await perguntar("primeiro carro", [manual, auto])).vehicles[0]?.id, "auto");
  assert.equal((await perguntar("primeiro carro", [manual, menosKm])).vehicles[0]?.id, "menos-km");
});

test("ranking de primeiro carro coincide entre unidades e linhas do prompt", () => {
  const unidades = [palio, gol, mobi, hb20, hb20s, suv];
  const linhas = unidades.map(({ yearModel, ...vehicle }) => ({ ...vehicle, year: yearModel }));
  assert.deepEqual(rankChatVehicles(linhas, "primeiro carro").map((vehicle) => vehicle.id),
    rankChatVehicles(unidades, "primeiro carro").map((vehicle) => vehicle.id));
});

test("comparação do perfil mantém destaque coerente com os cards", async () => {
  const resultado = await perguntar("compara opções de primeiro carro até 70 mil");
  assert.equal(resultado.vehicles[0]?.id, "mobi");
  assert.match(resultado.reply, /eu priorizaria o Mobi 2024/);
  assert.doesNotMatch(resultado.reply, /Palio.*(?:bom começo|mais em conta)/);
});

for (const mensagem of [
  "qual moto pra entregador?", "moto pra trabalhar de entrega",
  "moto pra motoboy", "moto pro ifood", "moto para fazer entregas",
  "quero moto pra trabalhar de entrega",
]) {
  test(`entregas priorizam CG 160 e depois BIZ: ${mensagem}`, async () => {
    const resultado = await perguntar(mensagem);
    assert.deepEqual(resultado.vehicles.map((vehicle) => vehicle.id), ["cg", "biz125", "biz110"]);
    assert.match(resultado.reply, /começaria pela CG 160 Start.*robustez.*carga.*manutenção simples.*BIZ.*economia/);
    assert.doesNotMatch(resultado.reply, /km\/l|\d+\s*kg|retirada|WhatsApp|mais em conta/i);
    assert.equal(resultado.reply.split("\n\n").at(-1)?.match(/[.!?](?:\s|$)/g)?.length, 1);
    respostaCurta(resultado.reply);
  });
}

test("entregas respeitam orçamento e só citam motos disponíveis", async () => {
  const resultado = await perguntar("moto pra entregador até 16 mil");
  assert.deepEqual(resultado.vehicles.map((vehicle) => vehicle.id), ["biz125", "biz110"]);
  assert.doesNotMatch(resultado.reply, /CG|carro|retirada/);
  assert.match(resultado.reply, /economia.*manutenção simples/);
});

test("frete da loja continua separado do perfil de entregador", async () => {
  const resultado = await perguntar("vocês entregam a moto?");
  assert.equal(resultado.meta?.policy, "delivery");
  assert.equal(resultado.vehicles.length, 0);
  assert.match(resultado.reply, /Entrega ou retirada.*WhatsApp/);
});

test("diferença de HB20 e HB20S reconhece os dois nomes e usa dados existentes", async () => {
  assert.equal(mentionedModelPools(estoque, "HB20 pro HB20S").length, 2);
  assert.equal(mentionedModelPools(estoque, "tem HB20S?").length, 1);
  const weekend = carro("weekend", "Palio Weekend", 2016, 156_400, 47_900);
  assert.deepEqual(mentionedModelPools([palio, weekend], "Palio Weekend").flat().map((vehicle) => vehicle.id), ["weekend"]);
  for (const mensagem of ["qual a diferença do HB20 pro HB20S?", "diferença entre HB20 e HB20S"]) {
    const resultado = await perguntar(mensagem);
    assert.equal(resultado.meta?.policy, "compare-difference");
    assert.deepEqual(resultado.vehicles.map((vehicle) => vehicle.id), ["hb20s", "hb20"]);
    assert.match(resultado.reply, /HB20 é hatch.*300 litros/);
    assert.match(resultado.reply, /HB20S é sedan.*cerca de 475 litros/);
    assert.match(resultado.reply, /Na Garagem, temos/);
    assert.match(resultado.reply, /HB20 2022 por R\$ 64\.900/);
    assert.match(resultado.reply, /HB20S 2024 por R\$ 87\.900/);
    assert.equal(resultado.reply.match(/[.!?](?:\s|$)/g)?.length, 2);
    respostaCurta(resultado.reply);
  }
});

test("diferença de outros modelos não inventa porta-malas sem ficha técnica", async () => {
  const unknown = carro("argo", "Argo", 2025, 15_000, 72_000);
  const resultado = await perguntar("diferença entre Argo e Mobi", [mobi, unknown]);
  assert.deepEqual(resultado.vehicles.map((vehicle) => vehicle.id), ["mobi", "argo"]);
  assert.match(resultado.reply, /Argo é hatch/);
  assert.match(resultado.reply, /Mobi é hatch/);
  assert.match(resultado.reply, /Argo 2025 por R\$ 72\.000/);
  assert.doesNotMatch(resultado.reply, /Argo[^;.]*\d+ litros/);
  respostaCurta(resultado.reply);
});

test("versão sem especificação mantém carroceria e preço, sem copiar litros do modelo irmão", async () => {
  const semFicha = { ...hb20s, version: "Comfort 1.0", transmission: "Manual", engine: "1.0" };
  const resultado = await perguntar("diferença entre HB20 e HB20S", [hb20, semFicha]);
  assert.match(resultado.reply, /HB20S é sedan/);
  assert.doesNotMatch(resultado.reply, /475|HB20S[^;.]*\d+ litros/);
  assert.equal(resultado.vehicles.length, 2);
});
