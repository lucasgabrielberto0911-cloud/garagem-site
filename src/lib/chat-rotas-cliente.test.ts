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

const stock5 = [
  ...stock,
  car("civic", "Honda", "Civic", "EXL 2.0", 2020, 126900, { transmission: "Automático", engine: "2.0" }),
  car("kicks", "Nissan", "Kicks", "SL 1.6", 2019, 86900, { transmission: "Automático", engine: "1.6" }),
  car("chave", "Fiat", "Uno", "Way 1.0", 2015, 34900, { accessories: ["Manual do proprietário e chave reserva"] }),
];
const ask5 = (mensagem: string, vehicleId?: string) =>
  runChatTurn({ mensagem, historico: [], stock: stock5, vehicleId, readIntent: async () => null, generate: noModel });

test("'Civic ou Corolla?': mostra o Civic que temos, sem 'esse modelo não está'", async () => {
  const turn = await ask5("Civic ou Corolla?");
  assert.match(turn.reply, /^Corolla não está na lista atual; o Civic temos/);
  assert.doesNotMatch(turn.reply, /Esse modelo/);
  assert.equal(turn.vehicles[0]?.id, "civic");
});

test("0 km: loja de seminovos, mostra os mais novos", async () => {
  const turn = await ask5("tem algum 0km?");
  assert.match(turn.reply, /0 km a gente não trabalha/);
  assert.doesNotMatch(turn.reply, /não está na lista/);
  assert.equal(turn.vehicles[0]?.id, "mobi");
  const moto = await ask5("tem moto 0km?");
  assert.ok(moto.vehicles.every((vehicle) => vehicle.category === "moto"));
});

test("manual e chave reserva: consta na ficha → diz; sem carro → consultor confirma (nunca nega)", async () => {
  const unit = await ask5("tem manual e chave reserva?", "chave");
  assert.match(unit.reply, /consta: Manual do proprietário e chave reserva/);
  const generic = await ask5("o carro tem manual e chave reserva?");
  assert.match(generic.reply, /consultor confere/);
  assert.doesNotMatch(generic.reply, /não está na lista|não (?:tem|consta)/);
});

test("picape sem estoque: fala direto e mostra SUVs; 'já foi batido' é procedência", async () => {
  const turn = await ask5("tem pickup?");
  assert.match(turn.reply, /^Picape não temos agora; separei os SUVs/);
  assert.doesNotMatch(turn.reply, /Nessa combinação/);
  const crash = await ask5("o Kicks já foi batido?");
  assert.match(crash.reply, /consultor confirma no WhatsApp, carro a carro/);
});

test("estrada com teto de preço: os mais fortes do recorte primeiro", async () => {
  const turn = await ask5("preciso de um carro pra pegar estrada todo fim de semana, até 60 mil");
  assert.equal(turn.vehicles[0]?.id, "duster");
});

const stock6 = [
  ...stock,
  car("biz110", "Honda", "BIZ", "110i", 2023, 15200, { category: "moto", fuel: "Gasolina", engine: "110" }),
  car("kicks6", "Nissan", "Kicks", "SL 1.6", 2019, 86900, { transmission: "Automático", engine: "1.6" }),
  car("lancer", "Mitsubishi", "Lancer", "2.0", 2014, 62900, { transmission: "Automático", engine: "2.0", fuel: "Gasolina" }),
];
const ask6 = (mensagem: string) =>
  runChatTurn({ mensagem, historico: [], stock: stock6, readIntent: async () => null, generate: noModel });

test("combustível pela ficha: resposta direta, sem lista", async () => {
  assert.equal((await ask6("a Biz 125 é flex?")).reply, "Sim, a BIZ 125 é flex (gasolina e etanol).");
  assert.equal((await ask6("o Lancer é flex?")).reply, "O Lancer é a gasolina, conforme a ficha.");
  const both = await ask6("a Biz aceita etanol?");
  assert.match(both.reply, /BIZ 125 2023 é flex.*BIZ 2023 é a gasolina/);
  assert.equal(both.vehicles.length, 2);
});

test("picape: texto direto, sem sobra de comparação, também com teto de preço", async () => {
  const plain = await ask6("tem pickup?");
  assert.match(plain.reply, /^Picape não temos agora; separei/);
  assert.doesNotMatch(plain.reply, /mais em conta|Nessa combinação/);
  const ceiling = await ask6("tem picape até 80 mil?");
  assert.match(ceiling.reply, /^Picape até R\$ 80\.000 não temos agora; separei/);
  assert.doesNotMatch(ceiling.reply, /Nessa combinação/);
});

const stock7 = [
  ...stock6,
  car("city", "Honda", "City", "EXL 1.5", 2018, 84900, { transmission: "CVT", engine: "1.5" }),
  car("hrv", "Honda", "HR-V", "EXL 1.8", 2016, 84900, { transmission: "Automático", engine: "1.8" }),
];
const ask7 = (mensagem: string) =>
  runChatTurn({ mensagem, historico: [], stock: stock7, readIntent: async () => null, generate: noModel });

test("câmbio: semiautomática não é automático; CVT mostra os CVT da ficha", async () => {
  const auto = await ask7("quero um veículo automático");
  assert.ok(auto.vehicles.every((vehicle) => !/semi/i.test(vehicle.transmission ?? "")));
  const cvt = await ask7("tem câmbio cvt?");
  assert.deepEqual(cvt.vehicles.map((vehicle) => vehicle.id), ["city"]);
  const moto = await ask7("tem moto automática?");
  assert.match(moto.reply, /^Moto automática \(scooter\) não temos agora, mas a BIZ 125 é semi-automática/);
  assert.deepEqual(moto.vehicles.map((vehicle) => vehicle.id), ["biz"]);
});

test("'parecido com o Kicks, mais barato': outros SUVs abaixo do preço dele, não o Kicks", async () => {
  const turn = await ask7("quero algo parecido com o Kicks mais barato");
  assert.match(turn.reply, /^Na linha do Kicks \(SUV\) e mais em conta/);
  assert.ok(turn.vehicles.length > 0);
  assert.ok(turn.vehicles.every((vehicle) => vehicle.model !== "Kicks" && vehicle.price < 86900));
});

test("estrada de chão é pergunta de robustez, não lista de estrada", async () => {
  const turn = await runChatTurn({ mensagem: "o Kicks aguenta estrada de chão?", historico: [], stock: stock7, readIntent: async () => null, generate: async () => ({ text: "O Kicks tem altura boa do solo para estrada de chão.", functionCall: null }) });
  assert.doesNotMatch(turn.reply, /Para estrada, você prioriza/);
});

const colored = [
  car("gol-p", "Volkswagen", "Gol", "Trend 1.0", 2012, 32900, { color: "Preto" }),
  car("nivus-p", "Volkswagen", "Nivus", "Highline", 2021, 104900, { color: "Preto", transmission: "Automático" }),
  car("mobi-b", "Fiat", "Mobi", "Like", 2024, 57900, { color: "Branco" }),
  car("city-b", "Honda", "City", "EXL", 2018, 84900, { color: "Branco", transmission: "CVT" }),
  car("hyundai-p", "Hyundai", "HB20", "Evolution", 2022, 64900, { color: "Prata" }),
  car("cg-v", "Honda", "CG 160 Start", "Start", 2023, 17000, { category: "moto", color: "Vermelha", accessories: ["Partida elétrica"] }),
];
const askC = (mensagem: string) =>
  runChatTurn({ mensagem, historico: [], stock: colored, readIntent: async () => null, generate: noModel });

test("cor: mostra os da cor pedida, aplica os outros filtros e nunca diz 'Preto não está na lista'", async () => {
  const black = await askC("tem carro preto?");
  assert.match(black.reply, /^Na cor preta temos 2 carros\./);
  assert.deepEqual(black.vehicles.map((vehicle) => vehicle.id), ["nivus-p", "gol-p"]);
  const whiteAuto = await askC("tem carro branco automático?");
  assert.deepEqual(whiteAuto.vehicles.map((vehicle) => vehicle.id), ["city-b"]);
  const red = await askC("tem carro vermelho?");
  assert.match(red.reply, /^Carro vermelho não temos agora\..*Na cor vermelha, temos a CG 160 Start/);
  assert.equal((await askC("qual a cor do Nivus?")).reply, "O Nivus que temos é preto.");
});

test("marca sozinha vira busca; 'CG' (sigla de 2 letras) é o modelo e a partida elétrica vem da ficha", async () => {
  const brand = await askC("tem Hyundai?");
  assert.deepEqual(brand.vehicles.map((vehicle) => vehicle.id), ["hyundai-p"]);
  const cg = await askC("a CG tem partida elétrica?");
  assert.match(cg.reply, /^Sim, na ficha dessa CG 160 Start consta partida elétrica/);
  const cheap = await askC("quero uma moto barata");
  assert.doesNotMatch(cheap.reply, /não está na lista/);
});

test("contato, Instagram, diesel e 'por menos de 30 mil': respostas diretas, sem lista de espera", async () => {
  const insta = await ask("vcs tem instagram?");
  assert.match(insta.reply, /Instagram da Garagem é @suagaragem1/);
  const zap = await ask("qual o whatsapp?");
  assert.match(zap.reply, /^O WhatsApp da Garagem é/);
  const diesel = await ask("tem algum diesel?");
  assert.match(diesel.reply, /^Diesel não temos agora: o estoque da Garagem hoje é flex/);
  const cheap = await ask("tem algum por menos de 30 mil?");
  assert.doesNotMatch(cheap.reply, /não está na lista/);
  assert.ok(cheap.vehicles.length > 0);
});

test("conversa: 'é flex?' depois da lista responde cada uma; 'quanto pagam no meu' lembra a troca de 2 turnos atrás", async () => {
  const first = await ask6("tem moto?");
  const fuel = await runChatTurn({
    mensagem: "é flex?",
    historico: [{ role: "user", content: "tem moto?" }, { role: "assistant", content: first.reply }],
    stock: stock6, readIntent: async () => null, generate: noModel,
  });
  assert.match(fuel.reply, /^Dos que separei: .*BIZ 2023 é a gasolina/);
  const trade = await runChatTurn({
    mensagem: "quanto vocês pagam no meu?",
    historico: [
      { role: "user", content: "quero trocar meu Celta 2010" },
      { role: "assistant", content: "Aceitamos sim." },
      { role: "user", content: "num SUV" },
      { role: "assistant", content: "Olha o que tenho de carros:" },
    ],
    stock: stock6, readIntent: async () => null, generate: noModel,
  });
  assert.match(trade.reply, /consultor avalia com algumas fotos/);
});

test("PCD, recall e horário: respostas da loja; 'tem Corolla 2018?' não casa com o City 2018", async () => {
  const pcd = await ask7("tem carro pra pcd?");
  assert.match(pcd.reply, /isenção PCD de IPI e ICMS vale na compra de carro 0 km/);
  assert.ok(pcd.vehicles.length > 0 && pcd.vehicles.every((vehicle) => !/semi|manual/i.test(vehicle.transmission ?? "")));
  assert.match((await ask7("o carro tem recall?")).reply, /consultor confere pelo chassi/);
  assert.match((await ask7("vcs abrem domingo?")).reply, /^Atendemos todos os dias, das 8h às 23h/);
  const corolla = await ask7("tem corolla 2018?");
  assert.match(corolla.reply, /^Corolla não está na lista atual/);
  const onix = await ask7("tem onix plus?");
  assert.match(onix.reply, /^Onix Plus não está na lista atual/);
});

test("comparação de 2: ficha de cada um em uma linha, sem 'Vou te ajudar a escolher', e '3.200 km' não é cortado", async () => {
  const turn = await ask6("biz 125 ou cg?");
  assert.match(turn.reply, /^A BIZ 125 2023: 60 mil km, semi-automática, R\$ 14\.900\. A CG 160 Start 2023:/);
  assert.match(turn.reply, /Quer que eu compare consumo ou itens da ficha\?$/);
  const kids = await ask7("carro pra quem tem 2 filhos");
  assert.doesNotMatch(kids.reply, /não está na lista/);
});

test("conversa: 'a mais barata é flex?' responde só ela; capacete/manual não viram modelo; 'carro bom' é custo-benefício", async () => {
  const first = await ask6("quero ver motos");
  const fuel = await runChatTurn({
    mensagem: "a mais barata é flex?",
    historico: [{ role: "user", content: "quero ver motos" }, { role: "assistant", content: first.reply }],
    stock: stock6, readIntent: async () => null, generate: noModel,
  });
  assert.equal(fuel.reply, "Sim, a BIZ 125 é flex (gasolina e etanol).");
  assert.match((await ask6("tem capacete junto?")).reply, /não vem no anúncio/);
  assert.match((await ask6("a moto acompanha manual?")).reply, /Manual e chave reserva variam/);
  const good = await ask7("quero um carro bom");
  assert.doesNotMatch(good.reply, /não está na lista/);
  assert.notEqual(good.vehicles[0]?.id, "palio");
});
