import assert from "node:assert/strict";
import test from "node:test";
import { runChatTurn } from "./chat-turn";
import { type ChatVehicleRecord } from "./chat-stock";
import type { ChatTurn } from "./chat-gemini";

// Estoque de teste padronizado com carros e motos de diferentes categorias e faixas de preço
const stock: ChatVehicleRecord[] = [
  {
    id: "cmsgmjlr30000lc04jbkxewkj",
    brand: "Volkswagen",
    model: "NIVUS",
    version: "HIGHLINE TSI",
    yearModel: 2021,
    km: 49300,
    price: 104900,
    color: "Preto",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
    engine: "1.0 TSI",
    doors: 4,
    accessories: [
      "Multimídia", "Bluetooth", "Ar-condicionado", "Ar digital", "Direção elétrica",
      "Vidros elétricos", "Travas elétricas", "Alarme", "Bancos de couro", "Câmera de ré",
      "Sensor de estacionamento", "Airbag duplo", "ABS", "Piloto automático", "Volante multifuncional",
      "Faróis de LED", "Rodas de liga leve", "Farol de neblina", "Retrovisores elétricos", "Computador de bordo",
      "Keyless (partida por botão)", "Apple CarPlay / Android Auto", "Sensor crepuscular", "Entrada USB",
      "Sensor de chuva", "Controle de estabilidade", "Freios a disco nas 4 rodas",
      "Piloto automático adaptativo (ACC)", "borboletas no volante", "ISOFIX e top tether",
      "Frenagem autônoma de emergência (AEB)",
    ],
  },
  {
    id: "cmsgv18dy0000l204bn1cwvkb",
    brand: "Mitsubishi",
    model: "LANCER",
    version: "2.0 Automatico",
    yearModel: 2014,
    km: 80000,
    price: 62900,
    color: "Cinza",
    transmission: "Automático",
    fuel: "Gasolina",
    category: "carro",
    engine: "2.0 160cv",
    doors: 4,
    accessories: [
      "Bluetooth", "Ar-condicionado", "Direção hidráulica", "Travas elétricas", "Alarme",
      "Bancos de couro", "Airbag duplo", "Piloto automático", "ABS", "Volante multifuncional",
      "Bancos elétricos", "Rodas de liga leve", "Computador de bordo", "Retrovisores elétricos",
      "Entrada USB", "Farol de neblina", "Controle de estabilidade",
    ],
  },
  {
    id: "cmshu67mo0000la04hhc9jp7v",
    brand: "Hyundai",
    model: "HB20",
    version: "evolution 1.0",
    yearModel: 2022,
    km: 68450,
    price: 64900,
    color: "Prata",
    transmission: "Manual",
    fuel: "Flex",
    category: "carro",
    engine: "1.0 Aspirado",
    doors: 4,
    accessories: [
      "Ar digital", "Direção elétrica", "Bluetooth", "Ar-condicionado", "Multimídia",
      "Travas elétricas", "Alarme", "Sensor de estacionamento", "Airbag duplo", "ABS",
      "Volante multifuncional", "Computador de bordo", "Apple CarPlay / Android Auto", "Entrada USB",
      "Controle de estabilidade",
    ],
  },
  {
    id: "cmsnsjelx0000la04wxu40b89",
    brand: "Nissan",
    model: "Kicks",
    version: "SL 1.6 Flex Start XTRONIC",
    yearModel: 2019,
    km: 78000,
    price: 86900,
    color: "Cinza",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
    engine: "1.6 Aspirado",
    doors: 4,
    accessories: [
      "Direção elétrica", "Multimídia", "Ar digital", "Bluetooth", "Travas elétricas",
      "Alarme", "Vidros elétricos", "Sensor de estacionamento", "Bancos de couro", "ABS",
      "Piloto automático", "Controle de estabilidade", "Bancos elétricos", "Rodas de liga leve",
      "Computador de bordo", "Keyless (partida por botão)", "Apple CarPlay / Android Auto",
      "Retrovisores elétricos", "Sensor crepuscular", "Entrada USB", "Farol de neblina",
      "Volante multifuncional", "Camera 360 (Around View Monitor)", "6 Air Bags",
    ],
  },
  {
    id: "cmspcwa280000l404659usfgr",
    brand: "Hyundai",
    model: "HB20",
    version: "Premium Automatico 1.6",
    yearModel: 2015,
    km: 127300,
    price: 56900,
    color: "Branco",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
    engine: "1.6 Aspirado",
    doors: 4,
    accessories: [
      "Multimídia", "Direção elétrica", "ABS", "Airbag duplo", "Volante multifuncional",
      "Alarme", "Travas elétricas", "Direção hidráulica", "Bluetooth", "Ar-condicionado",
      "Vidros elétricos", "Sensor de estacionamento", "Controle de estabilidade", "Rodas de liga leve",
      "Farol de neblina", "Retrovisores elétricos", "Computador de bordo", "Entrada USB",
    ],
  },
  {
    id: "cmsrx7hnl0000l704p133ruvi",
    brand: "Hyundai",
    model: "HB20S",
    version: "Comfort Plus 1.0 TB Flex 12V",
    yearModel: 2024,
    km: 50000,
    price: 87900,
    color: "Prata",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
    engine: "1.0 TGDI",
    doors: 4,
    accessories: [
      "Multimídia", "Bluetooth", "Ar-condicionado", "Direção elétrica", "Alarme",
      "Travas elétricas", "Vidros elétricos", "Sensor de estacionamento", "Câmera de ré",
      "ABS", "Controle de estabilidade", "Airbag duplo", "Volante multifuncional",
      "Keyless (partida por botão)", "Computador de bordo", "Apple CarPlay / Android Auto",
      "Retrovisores elétricos", "Farol de neblina", "Entrada USB",
    ],
  },
  {
    id: "cmtq0iup00000jp04m172wx42",
    brand: "Fiat",
    model: "Palio Weekend",
    version: "Adventure 1.8 Flex 16V",
    yearModel: 2016,
    km: 156400,
    price: 47900,
    color: "Branca",
    transmission: "Manual",
    fuel: "Flex",
    category: "carro",
    engine: "1.8 Etorq Flex",
    doors: 4,
    accessories: [
      "Direção hidráulica", "Bluetooth", "Ar-condicionado", "Alarme", "Farol de neblina",
      "Rodas de liga leve", "Travas elétricas", "Vidros elétricos", "Entrada USB",
      "Retrovisores elétricos", "Computador de bordo", "Volante multifuncional", "ABS",
    ],
  },
  {
    id: "cmtrkwmer0000ky04r6wwpwsv",
    brand: "Honda",
    model: "BIZ 125",
    version: "EX 125 FLEX",
    yearModel: 2023,
    km: 22000,
    price: 14900,
    color: "Branca",
    transmission: "Semi-automático",
    fuel: "Flex",
    category: "moto",
    engine: "125cc",
    doors: null,
    accessories: [
      "Partida elétrica", "Painel digital", "Pneus novos", "Rodas de liga", "Protetor de motor",
      "Tomada 12v", "Porta-objetos sob o banco", "Trava de guidão", "Freios CBS (frenagem combinada)",
    ],
  },
  {
    id: "cmu1g23pu0000l504mzurjecm",
    brand: "Fiat",
    model: "Palio",
    version: "Celebration 1.0 Fire Flex",
    yearModel: 2008,
    km: 190000,
    price: 24900,
    color: "Preto",
    transmission: "Manual",
    fuel: "Flex",
    category: "carro",
    engine: "1.0 Fire",
    doors: 3,
    accessories: [
      "Ar-condicionado", "Direção hidráulica", "Vidros elétricos dianteiros", "Travas elétricas",
      "Painel com conta-giros (tacômetro", "Banco traseiro rebatível",
      "Abertura interna da tampa do combustível e do porta-malas", "Relógio digital",
      "Para-choques na cor do veículo", "Desembaçador e limpador do vidro traseiro",
      "Terceira luz de freio (brake light)", "Apoios de cabeça dianteiros e traseiros",
      "Barras de proteção lateral nas portas",
    ],
  },
  {
    id: "cmu3arws10000l2041a9hwcx5",
    brand: "Fiat",
    model: "Mobi",
    version: "Like 1.0 Fire EVO Flex",
    yearModel: 2024,
    km: 75700,
    price: 57900,
    color: "Branco",
    transmission: "Manual",
    fuel: "Flex",
    category: "carro",
    engine: "1.0 Fire",
    doors: 4,
    accessories: [
      "Ar-condicionado", "Direção hidráulica", "Vidros elétricos dianteiros com função one-touch e antiesmagamento",
      "Travas elétricas nas 4 portas", "Computador de bordo completo", "Painel com display digital em TFT de 3,5\"",
      "Monitoramento de pressão dos pneus (iTPMS)", "Faróis com máscara negra", "Luzes de condução diurna (DRL)",
      "Tampa traseira em vidro estrutural escurecido de alta resistência", "Banco traseiro rebatível",
      "Tomada 12V no console central", "Manual do proprietário e chave reserva", "Documentação rigorosamente em dia",
      "Freios ABS com distribuição eletrônica de frenagem (EBD)", "Airbags frontais (motorista e passageiro)",
      "Fixação ISOFIX para cadeirinhas infantis", "Sinalização de frenagem de emergência (ESS)",
      "Cintos de 3 pontos e apoios de cabeça para todos os ocupantes", "Desembaçador e limpador do vidro traseiro",
    ],
  },
  {
    id: "cmu4r55kv0000kz04se25nrgg",
    brand: "Honda",
    model: "CG 160 Start",
    version: "160 Start",
    yearModel: 2023,
    km: 450,
    price: 17000,
    color: "Vermelha",
    transmission: "Manual",
    fuel: "Flex",
    category: "moto",
    engine: "160cc",
    doors: null,
    accessories: [
      "Estado de zero km (apenas 450 km rodados)", "Partida elétrica",
      "Painel digital blackout (velocímetro digital, hodômetro e marcador de combustíve",
      "Posição de pilotagem ergonômica e confortável", "Rodas raiadas reforçadas aro 18",
      "Tampa do tanque de combustível estilo aviação (articulada", "Protetor de escapamento em aço inox",
      "Banco anatômico de dois níveis", "Sistema de freios combinados (CBS - Combined Brake System)",
      "Chassi tipo Diamond Frame de alta resistência", "Suspensão dianteira com garfo telescópico reforçado",
      "Trava de guidão integrada à chave de ignição", "Lanterna traseira integrada com alta visibilidade",
    ],
  },
  {
    id: "cmu4sgkfz0000js04037q4n51",
    brand: "Honda",
    model: "Civic",
    version: "EXL 2.0 FLEX 16v",
    yearModel: 2020,
    km: 65000,
    price: 126900,
    color: "Azul Meia-Noite",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
    engine: "2.0 FLEX I-VTEC",
    doors: 4,
    accessories: [
      "Câmbio borboleta (Paddle Shift) atrás do volante para trocas de marcha",
      "Bancos com revestimento premium em couro", "Painel de instrumentos digital em tela TFT de 7\" em alta resolução",
      "Central multimídia touchscreen de 7\" com Apple CarPlay, Android Auto e GPS integ",
      "Ar-condicionado digital automático Dual Zone (duas zonas de temperatura)",
      "Freio de estacionamento eletrônico (EPB) com função Brake Hold",
      "Chave presencial (Smart Entry) com partida no botão Start/Stop", "Piloto automático (cruise control)",
      "Faróis com acendimento automático (sensor crepuscular) e DRL em LED", "Faróis de neblina",
      "Retrovisores elétricos com rebatimento automático e repetidores em LED", "Rodas de liga leve diamantadas aro 17\"",
      "Volante multifuncional com ajuste de altura e profundidade", "Câmera de ré multivisão com guias dinâmicas",
      "Sensores de estacionamento dianteiros e traseiros", "6 Airbags (frontais, laterais e de cortina)",
      "Controle de tração e estabilidade (VSA)", "Assistente de partida em rampas (HSA)",
      "Assistente de dirigibilidade ágil (AHA - Agile Handling Assist)", "Freios a disco nas 4 rodas com ABS e EBD",
      "Sistema de fixação ISOFIX para cadeirinhas infantis", "Monitoramento indireto de pressão dos pneus (TPMS)",
    ],
  },
  {
    id: "cmu610q770000l8049nvddb5k",
    brand: "Honda",
    model: "BIZ",
    version: "110i EX",
    yearModel: 2023,
    km: 3200,
    price: 15200,
    color: "Branca",
    transmission: "Semi-automático",
    fuel: "Gasolina",
    category: "moto",
    engine: "110cc",
    doors: null,
    accessories: [
      "Partida elétrica", "Tomada 12V", "Porta-objetos sob o banco", "Assento largo (piloto + garupa",
      "Freios CBS (combinados)", "Sistema Honda de Proteção com trava de guidão",
    ],
  },
  {
    id: "cmubrhzwf0000l304geveibp1",
    brand: "Honda",
    model: "Civic",
    version: "LXR 2.0 FlexOne",
    yearModel: 2015,
    km: 106000,
    price: 74900,
    color: "Prata",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
    engine: "2.0 FlexOne I-VTEC",
    doors: 4,
    accessories: [
      "Ar-condicionado digital", "Direção hidráulica", "Bancos em couro", "Piloto automático",
      "Troca de marchas no volante (paddle shift)", "Vidros elétricos nas 4 portas", "Travas elétricas",
      "Retrovisores elétricos", "Volante multifuncional com regulagem de altura e profundidade",
      "Rodas de liga leve", "Faróis de neblina", "Faróis com acendimento automático", "Computador de bordo",
      "Som com USB, Bluetooth e CD", "Sensor de estacionamento", "Câmera de ré", "Freios ABS com EBD",
      "Alarme", "Isofix",
    ],
  },
  {
    id: "cmud192iz0000l6041ewv0ki6",
    brand: "Honda",
    model: "HR-V",
    version: "EXL 1.8 Flexone",
    yearModel: 2016,
    km: 103000,
    price: 84900,
    color: "Prata",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
    engine: "1.8 FlexOne 16V",
    doors: 4,
    accessories: [
      "Ar-condicionado digital automático (tela touch)", "Bancos em couro",
      "Central multimídia 7” multi-touch com GPS", "Câmera de ré multivisão",
      "Bluetooth (ligações e áudio) + 2 USB + HDMI", "Piloto automático",
      "Troca de marchas no volante (paddle shift)", "Volante em couro multifuncional",
      "Direção elétrica progressiva (EPS)", "Vidros elétricos one-touch com antiesmagamento",
      "Retrovisores elétricos com pisca, rebatimento e tilt-down", "Faróis de neblina",
      "Lanternas traseiras em LED", "Rodas de liga leve aro 17”",
      "Freio de estacionamento eletrônico (EPB) + Brake Hold", "Bancos Magic Seat (rebatimento versátil)",
      "Computador de bordo", "Airbags frontais e laterais", "Freios ABS com EBD (disco nas 4 rodas)",
      "Controle de estabilidade e tração (VSA)", "Assistente de partida em rampa (HSA)",
      "Alarme + imobilizador", "Travamento automático das portas", "Isofix",
    ],
  },
  {
    id: "cmuobm8ka0000jg04pe8ybs5n",
    brand: "Renault",
    model: "Duster",
    version: "Dynamique 2.0 16V Tech Road 2",
    yearModel: 2014,
    km: 101000,
    price: 54900,
    color: "Prata",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
    engine: "2.0 16V Hi-Flex",
    doors: 4,
    accessories: [
      "Ar-condicionado", "Direção hidráulica", "Media Nav 7\" com GPS, rádio, Bluetooth e USB",
      "Comandos de som na coluna de direção", "Sensor de estacionamento traseiro",
      "Vidros elétricos nas 4 portas", "Travas elétricas", "Retrovisores elétricos",
      "Faróis de neblina", "Faróis com máscara negra", "Grade e detalhes Dark Star",
      "Barras de teto", "Rodas de liga leve aro 16\"", "Computador de bordo",
      "Banco do motorista com ajuste de altura", "Banco traseiro rebatível",
      "Alarme perimétrico", "Freios ABS", "Airbags frontais duplos", "Laudo cautelar aprovado",
    ],
  },
  {
    id: "cmuqzvj310000l704vrrt6ijm",
    brand: "Ford",
    model: "KA SEDAN",
    version: "SE AUTOMATICO 1.5",
    yearModel: 2019,
    km: 100000,
    price: 49990,
    color: "Branco",
    transmission: "Automático",
    fuel: "Flex",
    category: "carro",
    engine: "1.5 TI-CDT",
    doors: 4,
    accessories: [
      "Airbag duplo", "Bancos de couro", "ABS", "Travas elétricas", "Direção elétrica",
      "Ar-condicionado", "Bluetooth", "Rádio com Bluetooth e USB",
      "Volante multifuncional com ajuste de altura", "Computador de bordo", "Vidros elétricos dianteiros",
      "Banco do motorista com ajuste de altura", "Banco traseiro rebatível", "Bancos em couro",
    ],
  },
  {
    id: "cmux8br7n0000l004rmqr3y77",
    brand: "Volkswagen",
    model: "Gol",
    version: "Trend 1.0 Completo",
    yearModel: 2012,
    km: 144000,
    price: 32900,
    color: "Preto",
    transmission: "Manual",
    fuel: "Flex",
    category: "carro",
    engine: "1.0 8v Flex VHT",
    doors: 4,
    accessories: [
      "Central multimídia", "ABS", "Ar-condicionado", "Bluetooth", "Direção hidráulica",
      "Travas elétricas", "4 Vidros Eletricos", "Banco do motorista com ajuste de altura",
      "Banco traseiro rebatível", "Tomada 12V", "Cintos de 3 pontos", "Apoios de cabeça traseiros",
      "Chave com imobilizador",
    ],
  },
  {
    id: "cmux8yxbe0000gq04p1g7t5wp",
    brand: "Honda",
    model: "City",
    version: "EXL 1.5 CVT I-VTEC",
    yearModel: 2018,
    km: 76000,
    price: 84990,
    color: "Branco",
    transmission: "CVT",
    fuel: "Flex",
    category: "carro",
    engine: "1.5 16V i-VTEC FlexOne",
    doors: 4,
    accessories: [
      "Central multimídia 7\" com GPS, Apple CarPlay e Android Auto", "Ar-condicionado digital automático",
      "Bancos em couro", "Câmera de ré", "Piloto automático", "Faróis full LED",
      "Luzes de condução diurna (DRL)", "Faróis de neblina", "Direção elétrica",
      "Volante em couro com comandos e paddle shift", "Vidros elétricos one-touch nas 4 portas",
      "Travas elétricas", "Retrovisores elétricos com rebatimento automático", "Rodas de liga leve aro 16\"",
      "Porta-malas de 536 litros", "6 airbags (frontais, laterais e de cortina)", "Freios ABS",
      "ISOFIX", "Alarme antifurto",
    ],
  },
];

const noModel = async () => {
  throw new Error("A bateria determinística não deve chamar o modelo");
};

// 1. ECONOMIA (6 perguntas)
test("QA Economia: mais econômico do estoque (Mobi Like com km/l)", async () => {
  const res = await runChatTurn({
    mensagem: "qual o carro mais econômico que vocês têm no estoque?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.vehicles[0]?.model ?? "", /mobi/i);
  assert.match(res.reply, /km\/l/i);
});

test("QA Economia: SUV mais econômico (Kicks com km/l)", async () => {
  const res = await runChatTurn({
    mensagem: "qual o suv mais econômico de combustível?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles[0]?.model, "Kicks");
  assert.match(res.reply, /km\/l/i);
});

test("QA Economia: motos econômicas pro dia a dia", async () => {
  const res = await runChatTurn({
    mensagem: "qual dessas motos gasta menos gasolina pro dia a dia?",
    previousVehicleIds: ["cmtrkwmer0000ky04r6wwpwsv", "cmu610q770000l8049nvddb5k"],
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.vehicles[0]?.model ?? "", /biz/i);
  assert.match(res.reply, /km\/l/i);
});

test("QA Economia: mobi ou gol gasta menos", async () => {
  const res = await runChatTurn({
    mensagem: "qual gasta menos combustível: mobi ou gol?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles.length, 2);
  assert.match(res.reply, /km\/l/i);
});

test("QA Economia: retorno de lista filtrada preserva contexto dos exibidos", async () => {
  const history: ChatTurn[] = [
    { role: "user", content: "quais carros automáticos até 70 mil vocês têm?" },
    { role: "assistant", content: "Temos o Ka Sedan, a Duster e o HB20." },
  ];
  const res = await runChatTurn({
    mensagem: "qual deles é o mais econômico?",
    historico: history,
    previousVehicleIds: ["cmuqzvj310000l704vrrt6ijm", "cmuobm8ka0000jg04pe8ybs5n", "cmspcwa280000l404659usfgr"],
    stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.vehicles[0]?.model ?? "", /ka/i);
});

test("QA Economia: consumo urbano na página do HB20", async () => {
  const res = await runChatTurn({
    mensagem: "o hb20 consome muito combustível na cidade?",
    vehicleId: "cmshu67mo0000la04hhc9jp7v",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /km\/l|econôm|economi/i);
});

// 2. PREÇO (6 perguntas)
test("QA Preço: carro por menos de 30 mil (Palio 2008)", async () => {
  const res = await runChatTurn({
    mensagem: "tem algum carro por menos de 30 mil reais?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles.length, 1);
  assert.equal(res.vehicles[0]?.model, "Palio");
});

test("QA Preço: carros entre 50 e 65 mil", async () => {
  const res = await runChatTurn({
    mensagem: "quais carros vocês têm entre 50 e 65 mil?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.ok(res.vehicles.length >= 2);
  for (const v of res.vehicles) {
    assert.ok(v.price >= 50000 && v.price <= 65000);
  }
});

test("QA Preço: veículos acima de 100 mil", async () => {
  const res = await runChatTurn({
    mensagem: "o que vocês têm acima de 100 mil?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.ok(res.vehicles.length >= 2);
  for (const v of res.vehicles) {
    assert.ok(v.price > 100000);
  }
});

test("QA Preço: sedans até 80 mil", async () => {
  const res = await runChatTurn({
    mensagem: "tem algum sedan até 80 mil?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.ok(res.vehicles.length >= 2);
  for (const v of res.vehicles) {
    assert.ok(v.price <= 80000);
  }
});

test("QA Preço: quanto tá o Civic (cards com preços corretos)", async () => {
  const res = await runChatTurn({
    mensagem: "quanto tá o honda civic?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles.length, 2);
  const prices = res.vehicles.map(v => v.price).sort((a, b) => a - b);
  assert.deepEqual(prices, [74900, 126900]);
});

test("QA Preço: carro mais barato do estoque", async () => {
  const res = await runChatTurn({
    mensagem: "qual o carro mais barato da loja?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles[0]?.model, "Palio");
  assert.equal(res.vehicles[0]?.price, 24900);
});

// 3. COMPARAÇÃO (6 perguntas)
test("QA Comparação: Civic 2015 vs Civic 2020", async () => {
  const res = await runChatTurn({
    mensagem: "qual a diferença entre o civic 2015 e o civic 2020?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles.length, 2);
  assert.match(res.reply, /Civic 2015/);
  assert.match(res.reply, /Civic 2020/);
});

test("QA Comparação: Duster vs Kicks", async () => {
  const res = await runChatTurn({
    mensagem: "estou em dúvida entre a duster e o kicks, qual o melhor?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles.length, 2);
  assert.match(res.reply, /Duster/i);
  assert.match(res.reply, /Kicks/i);
});

test("QA Comparação: HB20 2015 vs Ka Sedan", async () => {
  const res = await runChatTurn({
    mensagem: "entre o hb20 2015 e o ka sedan, qual é melhor?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles.length, 2);
  assert.match(res.reply, /HB20/i);
  assert.match(res.reply, /KA/i);
});

test("QA Comparação: Biz 110i vs Biz 125", async () => {
  const res = await runChatTurn({
    mensagem: "qual a diferença entre a biz 110i e a biz 125?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles.length, 2);
  assert.match(res.reply, /125/);
  assert.match(res.reply, /110/);
});

test("QA Comparação: HB20 2015 vs HB20S 2024", async () => {
  const res = await runChatTurn({
    mensagem: "o que muda do hb20 2015 pro hb20s 2024?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles.length, 2);
  assert.match(res.reply, /HB20/i);
  assert.match(res.reply, /HB20S/i);
});

test("QA Comparação: Kicks vs Duster porta-malas", async () => {
  const res = await runChatTurn({
    mensagem: "kicks ou duster, qual tem porta-malas maior?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles.length, 2);
  assert.match(res.reply, /porta-malas|bagagem/i);
});

// 4. ITENS DA FICHA (10 perguntas)
test("QA Ficha: bancos de couro no estoque", async () => {
  const res = await runChatTurn({
    mensagem: "quais carros do estoque têm bancos de couro?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.ok(res.vehicles.length >= 2);
  assert.match(res.reply, /bancos de couro/i);
});

test("QA Ficha: ar digital no estoque", async () => {
  const res = await runChatTurn({
    mensagem: "quais carros têm ar digital?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.ok(res.vehicles.length >= 2);
  assert.match(res.reply, /ar-condicionado digital|ar digital/i);
});

test("QA Ficha: piloto automático adaptativo ACC lista o Nivus com link", async () => {
  const res = await runChatTurn({
    mensagem: "vocês têm algum modelo com piloto automático adaptativo acc?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles.length, 1);
  assert.match(res.vehicles[0]?.model ?? "", /nivus/i);
  assert.match(res.reply, /\[.*NIVUS.*\]\(\/estoque\//i);
});

test("QA Ficha: Kicks câmera 360 e sensor", async () => {
  const res = await runChatTurn({
    mensagem: "esse kicks vem com câmera 360 e sensor de estacionamento?",
    vehicleId: "cmsnsjelx0000la04wxu40b89",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /c[âa]mera/i);
  assert.match(res.reply, /sensor/i);
});

test("QA Ficha: HR-V central multimídia e câmera", async () => {
  const res = await runChatTurn({
    mensagem: "esse hrv tem central multimídia e câmera de ré?",
    vehicleId: "cmud192iz0000l6041ewv0ki6",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /multim[íi]dia/i);
  assert.match(res.reply, /c[âa]mera/i);
});

test("QA Ficha: Mobi ar e direção hidráulica", async () => {
  const res = await runChatTurn({
    mensagem: "o mobi tem ar-condicionado e direção hidráulica?",
    vehicleId: "cmu3arws10000l2041a9hwcx5",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /ar-condicionado/i);
  assert.match(res.reply, /direção hidráulica/i);
});

test("QA Ficha: Civic 2015 couro e paddle shift", async () => {
  const res = await runChatTurn({
    mensagem: "esse civic tem banco de couro e paddle shift no volante?",
    vehicleId: "cmubrhzwf0000l304geveibp1",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /couro/i);
  assert.match(res.reply, /paddle shift|marchas no volante/i);
});

test("QA Ficha: Civic EXL ar dual zone e piloto automático", async () => {
  const res = await runChatTurn({
    mensagem: "esse civic exl tem ar digital dual zone e piloto automático?",
    vehicleId: "cmu4sgkfz0000js04037q4n51",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /ar/i);
  assert.match(res.reply, /piloto automático/i);
});

test("QA Ficha: Duster sensor de ré e multimídia", async () => {
  const res = await runChatTurn({
    mensagem: "essa duster tem sensor de ré e multimídia?",
    vehicleId: "cmuobm8ka0000jg04pe8ybs5n",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /sensor/i);
  assert.match(res.reply, /multim[íi]dia|media nav/i);
});

test("QA Ficha: teto solar não cadastrado avisa cliente sem alucinar", async () => {
  const res = await runChatTurn({
    mensagem: "tem algum carro com teto solar no estoque?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /não temos|não consta|não aparece|nenhum/i);
});

// 5. PONTOS POSITIVOS (6 perguntas)
test("QA Pontos: Palio 1.0 pontos fortes sem cv", async () => {
  const res = await runChatTurn({
    mensagem: "quais os pontos positivos desse palio 1.0?",
    vehicleId: "cmu1g23pu0000l504mzurjecm",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /pontos fortes|vantagens|destaques/i);
  assert.doesNotMatch(res.reply, /\bcv\b/i);
});

test("QA Pontos: Nivus turbo na estrada sem cv", async () => {
  const res = await runChatTurn({
    mensagem: "o nivus anda forte mesmo ou é fraco na estrada?",
    vehicleId: "cmsgmjlr30000lc04jbkxewkj",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /turbo|torque|arrancada|retomada/i);
  assert.doesNotMatch(res.reply, /\bcv\b/i);
});

test("QA Pontos: Biz 125 pontos fortes", async () => {
  const res = await runChatTurn({
    mensagem: "quais os pontos fortes dessa biz?",
    vehicleId: "cmtrkwmer0000ky04r6wwpwsv",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /pontos fortes|economia|manutenção/i);
});

test("QA Pontos: Lancer 2.0 pontos fortes", async () => {
  const res = await runChatTurn({
    mensagem: "quais os pontos positivos do lancer 2.0?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /lancer/i);
  assert.match(res.vehicles[0]?.model ?? "", /lancer/i);
});

test("QA Pontos: HB20S turbo resposta ágil", async () => {
  const res = await runChatTurn({
    mensagem: "o hb20s turbo é bom de arrancada e ultrapassagem?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /turbo|torque|retomada|arrancada/i);
});

test("QA Pontos: Gol Trend 1.0 manutenção e robustez", async () => {
  const res = await runChatTurn({
    mensagem: "vale a pena comprar o gol trend 1.0? quais as vantagens?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /vantagens|pontos fortes|manutenção|robusto|peças/i);
});

// 6. MOTOS (5 perguntas)
test("QA Motos: busca geral de motos retorna até 3 unidades do estoque", async () => {
  const res = await runChatTurn({
    mensagem: "vocês vendem moto? o que tem aí?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles.length, 3);
  assert.ok(res.vehicles.every(v => v.category === "moto"));
  assert.match(res.reply, /motos pro seu pedido/i);
});

test("QA Motos: motos disponíveis com seus respectivos valores nos cards", async () => {
  const res = await runChatTurn({
    mensagem: "quais motos vocês têm disponíveis no estoque e quais os valores?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.equal(res.vehicles.length, 3);
  const prices = res.vehicles.map(v => v.price).sort((a, b) => a - b);
  assert.deepEqual(prices, [14900, 15200, 17000]);
});

test("QA Motos: CG 160 partida elétrica e painel digital", async () => {
  const res = await runChatTurn({
    mensagem: "essa cg tem partida elétrica e painel digital?",
    vehicleId: "cmu4r55kv0000kz04se25nrgg",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /partida elétrica/i);
  assert.match(res.reply, /painel digital/i);
});

test("QA Motos: aceite de moto na troca", async () => {
  const res = await runChatTurn({
    mensagem: "posso dar uma moto na troca de um carro?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /aceitamos sim|moto entram na conta|troca/i);
});

test("QA Motos: Biz 125 é Flex", async () => {
  const res = await runChatTurn({
    mensagem: "a biz 125 é flex ou só gasolina?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.match(res.reply, /flex/i);
});

// 7. VÁRIOS CRITÉRIOS (1 pergunta)
test("QA Vários Critérios: automático com câmera de ré até 85 mil", async () => {
  const res = await runChatTurn({
    mensagem: "tem algum carro automático com câmera de ré até 85 mil?",
    historico: [], stock, readIntent: async () => null, generate: noModel,
  });
  assert.ok(res.vehicles.length >= 1);
  for (const v of res.vehicles) {
    assert.ok(v.price <= 85000);
    assert.match(v.transmission ?? "", /autom|cvt/i);
  }
});
