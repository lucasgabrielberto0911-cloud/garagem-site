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

test("modelo que não temos: diz o nome e mostra parecidos da mesma carroceria", async () => {
  const mixed = [
    car("palio", "Fiat", "Palio", "Celebration 1.0", 2008, 24900),
    car("mobi", "Fiat", "Mobi", "Like 1.0", 2024, 57900),
    car("ka", "Ford", "KA SEDAN", "SE 1.5", 2019, 49990),
    car("civic", "Honda", "Civic", "EXL 2.0", 2020, 126900, { engine: "2.0" }),
    car("kicks", "Nissan", "Kicks", "SL 1.6", 2019, 86900, { engine: "1.6" }),
  ];
  const run = (mensagem: string) => runChatTurn({ mensagem, historico: [], stock: mixed, readIntent: async () => null, generate: noModel });
  const corolla = await run("tem corolla?");
  assert.match(corolla.reply, /^Corolla não está na lista atual\. Separei parecidos/);
  assert.deepEqual(corolla.vehicles.map((v) => v.model), ["Civic", "Ka Sedan"]);
  const tcross = await run("tem t-cross?");
  assert.match(tcross.reply, /^T-Cross não está/);
  assert.deepEqual(tcross.vehicles.map((v) => v.model), ["Kicks"]);
});

test("desconto/à vista, frete e consórcio: política da loja, sem prometer nem inventar", async () => {
  const cash = await ask("tem desconto à vista?");
  assert.match(cash.reply, /^À vista dá sim/);
  assert.doesNotMatch(cash.reply, /Esse modelo não está|\d+ ?%/);
  const freight = await ask("qual o valor do frete pra Vitória?");
  assert.match(freight.reply, /Entrega ou retirada a gente combina com o consultor/);
  assert.doesNotMatch(freight.reply, /não cobra|grátis|gratuit/i);
  const consortium = await ask("voces aceitam consórcio?");
  assert.match(consortium.reply, /consultor confirma no WhatsApp se dá pra usar/);
  assert.doesNotMatch(consortium.reply, /não aceita|aceitamos consórcio/i);
});

test("'tem câmera?' na conversa: usa o recorte lembrado ou o carro único da última resposta", async () => {
  const withCams = [
    car("kicks", "Nissan", "Kicks", "SL 1.6", 2019, 86900, { transmission: "Automático", accessories: ["Câmera de ré"] }),
    car("duster", "Renault", "Duster", "Dynamique 2.0", 2014, 54900, { transmission: "Automático", accessories: ["Freios ABS"] }),
    car("hb", "Hyundai", "HB20S", "1.0 TB", 2024, 87900, { accessories: ["Câmera de ré"] }),
  ];
  const run = (mensagem: string, historico: Array<{ role: "user" | "assistant"; content: string }>) =>
    runChatTurn({ mensagem, historico, stock: withCams, readIntent: async () => null, generate: noModel });
  const suv = await run("tem câmera?", [{ role: "user", content: "quero um SUV" }, { role: "assistant", content: "Olha os SUVs." }]);
  assert.match(suv.reply, /^Temos 1 SUV com câmera de ré na ficha/);
  assert.doesNotMatch(suv.reply, /não está na lista/);
  const one = await run("tem câmera?", [
    { role: "user", content: "o suv mais barato?" },
    { role: "assistant", content: "Olha o que tenho de carros:\nRenault Duster Dynamique 2.0 2014 · 101.000 km · R$ 54.900" },
  ]);
  assert.match(one.reply, /ficha desse Duster/);
});

test("'qual o melhor carro?' mostra os mais novos, não os mais baratos", async () => {
  const turn = await ask("qual o melhor carro de vcs?");
  assert.equal(turn.vehicles[0]?.model, "Mobi");
});

test("troca + busca: aceita a troca e busca sem o carro do visitante", async () => {
  const turn = await ask("oi, quero trocar meu Gol 2010 num carro automático até 70 mil");
  assert.match(turn.reply, /^Aceitamos sim: o seu usado entra na conta/);
  assert.ok(turn.vehicles.length > 0);
  assert.ok(turn.vehicles.every((v) => v.model !== "Gol"));
});

test("orçamento sem carro na faixa: diz o carro mais em conta e mostra motos que cabem", async () => {
  const turn = await ask("tô sem grana, tem algo até 20 mil?");
  assert.match(turn.reply, /^Carro até R\$ 20\.000 não temos agora; o mais em conta é o Palio 2008 \(R\$ 24\.900\)\. Moto até esse valor temos 2/);
  assert.deepEqual(turn.vehicles.map((v) => v.model), ["BIZ 125", "CG 160 Start"]);
});

test("cidade: área de atendimento, não modelo", async () => {
  const turn = await ask("boa noite, tem algum carro em Aracruz?");
  assert.match(turn.reply, /^Atendemos Aracruz e região sim!/);
  assert.doesNotMatch(turn.reply, /não está na lista/);
});

test("'o mais barato automático com câmera': ordena, não corta o recorte (nunca nega)", async () => {
  const withCams = [
    car("ka", "Ford", "KA SEDAN", "SE 1.5", 2019, 49990, { transmission: "Automático", accessories: ["Airbag duplo"] }),
    car("duster", "Renault", "Duster", "2.0", 2014, 54900, { transmission: "Automático", accessories: ["Freios ABS"] }),
    car("hb", "Hyundai", "HB20", "1.6", 2015, 56900, { transmission: "Automático", accessories: ["ABS"] }),
    car("civic", "Honda", "Civic", "LXR", 2015, 74900, { transmission: "Automático", accessories: ["Câmera de ré"] }),
    car("kicks", "Nissan", "Kicks", "SL", 2019, 86900, { transmission: "Automático", accessories: ["Camera 360"] }),
  ];
  const turn = await runChatTurn({ mensagem: "qual o mais barato automático com câmera?", historico: [], stock: withCams, readIntent: async () => null, generate: noModel });
  assert.doesNotMatch(turn.reply, /não aparece|não consta|nenhum/);
  assert.equal(turn.vehicles[0]?.model, "Civic");
});
