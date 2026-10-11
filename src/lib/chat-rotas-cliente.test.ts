import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "@/lib/chat-turn";
import type { ChatVehicleRecord } from "@/lib/chat-stock";

const car = (id: string, brand: string, model: string, version: string, yearModel: number, price: number, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord =>
  ({ id, brand, model, version, yearModel, km: 60000, price, color: "Prata", transmission: "Manual", fuel: "Flex", engine: "1.0", category: "carro", ...extra }) as ChatVehicleRecord;

const stock = [
  car("palio", "Fiat", "Palio", "Celebration 1.0", 2008, 24900, { accessories: ["Ar-condicionado"] }),
  car("gol", "Volkswagen", "Gol", "Trend 1.0", 2012, 32900, { accessories: ["Ar-condicionado"] }),
  car("duster", "Renault", "Duster", "Dynamique 2.0", 2014, 54900, { transmission: "Automático", engine: "2.0", accessories: ["Freios ABS", "Laudo cautelar aprovado"] }),
  car("mobi", "Fiat", "Mobi", "Like 1.0", 2024, 57900, { accessories: ["Ar-condicionado"] }),
  car("biz", "Honda", "BIZ 125", "EX", 2023, 14900, { category: "moto", transmission: "Semi-automático", engine: "125" }),
  car("cg", "Honda", "CG 160 Start", "Start", 2023, 17000, { category: "moto", engine: "160" }),
];
const noModel = async () => { throw new Error("não deveria gerar"); };
const ask = (mensagem: string, historico: Array<{ role: "user" | "assistant"; content: string }> = [], vehicleId?: string) =>
  runChatTurn({ mensagem, historico, stock, vehicleId, readIntent: async () => null, generate: noModel });

test("leilão e laudo: não afirma nem nega; o consultor confirma carro a carro", async () => {
  for (const question of ["os carros são de leilão?", "tem laudo cautelar?", "os carros tem procedência?"]) {
    const turn = await ask(question);
    assert.match(turn.reply, /consultor confirma no WhatsApp, carro a carro/, question);
    assert.doesNotMatch(turn.reply, /Esse modelo não está|Olha o que tenho/, question);
    assert.equal(turn.vehicles.length, 0, question);
  }
  const duster = await ask("tem laudo cautelar?", [], "duster");
  assert.match(duster.reply, /consta "Laudo cautelar aprovado"/);
});

test("visita e endereço: horário marcado em Linhares, sem endereço de loja", async () => {
  for (const question of ["quero ver o carro amanhã de manhã, dá?", "posso agendar um test drive no sábado?"]) {
    const turn = await ask(question);
    assert.match(turn.reply, /horário marcado em Linhares/, question);
    assert.equal(turn.vehicles.length, 0);
  }
  const address = await ask("qual o endereço da loja?");
  assert.match(address.reply, /loja digital.*horário marcado em Linhares/);
  assert.doesNotMatch(address.reply, /\bRua\b|\bAv\.|Avenida/);
});

test("gíria e categoria não viram 'modelo que não está na lista'", async () => {
  const slang = await ask("mano tem algum carro top ate 50 conto?");
  assert.doesNotMatch(slang.reply, /Esse modelo não está/);
  assert.ok(slang.vehicles.length > 0 && slang.vehicles.every((v) => v.price <= 50000));
  const motos = await ask("vcs tem moto?");
  assert.doesNotMatch(motos.reply, /Esse modelo não está/);
  assert.ok(motos.vehicles.every((v) => ["BIZ 125", "CG 160 Start"].includes(v.model)));
});

test("modelo que não temos: parecidos são carros, não motos", async () => {
  const onix = await ask("tem Onix?");
  assert.ok(onix.vehicles.length > 0);
  assert.ok(onix.vehicles.every((v) => !["BIZ 125", "CG 160 Start"].includes(v.model)));
});

test("troca: 'quanto vcs pagam nele?' continua a troca", async () => {
  const turn = await ask("quanto vcs pagam nele?", [
    { role: "user", content: "aceita meu carro na troca? tenho um Celta 2010" },
    { role: "assistant", content: "Aceitamos sim." },
  ]);
  assert.match(turn.reply, /consultor avalia com algumas fotos/);
  assert.equal(turn.vehicles.length, 0);
});

test("7 lugares sem nenhum no estoque: diz e mostra os mais espaçosos", async () => {
  const turn = await ask("tem carro 7 lugares?");
  assert.match(turn.reply, /não temos carro de 7 lugares/);
  assert.ok(turn.vehicles.length > 0 && turn.vehicles.length <= 3);
});

test("Uber: ordena por consumo e não inventa regra de ano do app", async () => {
  const turn = await ask("qual carro bom pra rodar de uber?");
  assert.doesNotMatch(turn.reply, /primeiro carro/i);
  assert.match(turn.reply, /ano mínimo que o aplicativo aceita/);
});

test("semiautomática não é automática", async () => {
  const turn = await ask("a biz é automática?");
  assert.match(turn.reply, /semi-automática/);
  assert.doesNotMatch(turn.reply, /é automátic[oa]/);
});

test("vender o carro, multa/IPVA e 'ficam onde': respostas da loja, sem lista de carros", async () => {
  const sell = await ask("vcs compram carro?");
  assert.match(sell.reply, /^Compramos sim!/);
  assert.equal(sell.vehicles.length, 0);
  for (const question of ["o carro tem multa?", "IPVA tá pago?"]) {
    const turn = await ask(question);
    assert.match(turn.reply, /não ficam no anúncio: o consultor confirma/, question);
    assert.doesNotMatch(turn.reply, /Esse modelo não está/, question);
  }
  const where = await ask("os carros de vcs ficam onde?");
  assert.match(where.reply, /horário marcado em Linhares/);
});

test("'sedan' sozinho não vira o Ka Sedan; 'HB20 ou Mobi' compara os dois escritos", async () => {
  const sedanStock = [
    car("ka", "Ford", "KA SEDAN", "SE 1.5", 2019, 49990, { transmission: "Automático" }),
    car("lancer", "Mitsubishi", "LANCER", "2.0", 2014, 62900, { transmission: "Automático", engine: "2.0" }),
    car("hb", "Hyundai", "HB20", "1.0", 2022, 64900),
    car("hbs", "Hyundai", "HB20S", "1.0 TB", 2024, 87900, { transmission: "Automático" }),
    car("mobi", "Fiat", "Mobi", "Like 1.0", 2024, 57900),
  ];
  const run = (mensagem: string) => runChatTurn({ mensagem, historico: [], stock: sedanStock, readIntent: async () => null, generate: noModel });
  const sedan = await run("quero um sedan até 80 mil");
  assert.deepEqual(sedan.vehicles.map((v) => v.model).sort(), ["Ka Sedan", "Lancer"].sort());
  const pair = await run("HB20 ou Mobi pra primeiro carro?");
  assert.deepEqual(pair.vehicles.map((v) => v.model).sort(), ["HB20", "Mobi"]);
});
