/**
 * Base de fichas técnicas de REFERÊNCIA dos modelos do estoque.
 *
 * São dados de fábrica do MODELO/versão/ano (potência e torque de catálogo,
 * consumo do Inmetro/PBEV, porta-malas, tanque, dimensões). Servem para o
 * assistente responder como especialista. Nunca descrevem a unidade usada:
 * estado, revisões, histórico e equipamentos da unidade vêm só do anúncio.
 *
 * Números conferidos em out/2026 em fichas públicas (fabricante, Inmetro e
 * agregadores como fichacompleta.com.br). Onde as fontes divergiram, o valor
 * vai com `aprox: true` e o texto sai com "cerca de". Campo ausente = sem dado
 * confiável: o assistente não chuta.
 */

export type SpecSubject = {
  brand: string;
  model: string;
  version?: string | null;
  yearModel: number;
  transmission?: string | null;
  engine?: string | null;
  category?: string | null;
};

export type FuelPair = { etanol?: number; gasolina?: number };

export type VehicleSpec = {
  id: string;
  /** Nome falado: "Hyundai HB20 1.6 automático". */
  nome: string;
  /** Nome curto para frases: "HB20 1.6". */
  curto: string;
  /** Artigo: "o" | "a". */
  artigo: "o" | "a";
  brand: string;
  /** Testado no texto dobrado de `modelo + versão`. */
  model: RegExp;
  /** Exclusão no mesmo texto (ex.: Palio Weekend não é o Palio Fire). */
  not?: RegExp;
  /** Testado no texto dobrado de `modelo + versão + motor`. */
  engineText?: RegExp;
  anos: [number, number];
  cambioTipo?: "automatico" | "manual";
  moto?: boolean;
  motor: string;
  combustivel: "flex" | "gasolina";
  /** cv de catálogo; para moto `cv.gasolina` ou `cv.etanol`. */
  cv: FuelPair;
  /** kgfm. */
  torque: FuelPair;
  torqueRpm?: string;
  cambio: string;
  marchas?: number;
  zeroACem?: number;
  vmax?: number;
  /** km/l do Inmetro/PBEV. */
  cidade?: FuelPair;
  estrada?: FuelPair;
  /** Consumo médio de moto (km/l), aproximado. */
  consumoMoto?: number;
  tanque?: number;
  portaMalas?: number;
  dim?: { comprimento: number; largura: number; altura: number; entreEixos: number };
  peso?: number;
  seguranca: string;
  manutencao: string;
  /** Fontes divergentes: o texto usa "cerca de" e avisa. */
  aprox?: boolean;
};

const FOLD = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const CHAT_SPEC_BASE_NOTE =
  "Dados de fábrica do modelo (catálogo, Inmetro/PBEV e testes de referência). Descrevem a versão e o ano, nunca o estado de uma unidade usada.";

export const VEHICLE_SPECS: VehicleSpec[] = [
  {
    id: "honda-city-1.5-cvt",
    nome: "Honda City 1.5 automático (CVT)",
    curto: "City 1.5",
    artigo: "o",
    brand: "honda",
    model: /\bcity\b/,
    anos: [2015, 2020],
    cambioTipo: "automatico",
    motor: "1.5 16V i-VTEC, 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 116, gasolina: 115 },
    torque: { etanol: 15.3, gasolina: 15.2 },
    torqueRpm: "4.800 rpm",
    cambio: "CVT (variação contínua, sem marchas fixas); no modo manual simula 7 marchas (na versão EXL, com borboletas no volante)",
    marchas: 7,
    zeroACem: 11.3,
    vmax: 175,
    cidade: { etanol: 8.5, gasolina: 12.3 },
    estrada: { etanol: 10.3, gasolina: 14.5 },
    tanque: 46,
    portaMalas: 536,
    dim: { comprimento: 4455, largura: 1695, altura: 1485, entreEixos: 2600 },
    peso: 1137,
    seguranca: "versão EXL de referência: airbags frontais, laterais e de cortina, freios ABS, ISOFIX e câmera de ré",
    manutencao:
      "motor 1.5 simples e conhecido, com peças acessíveis",
  },
  {
    id: "vw-gol-1.0-g5",
    nome: "Volkswagen Gol 1.0 manual",
    curto: "Gol 1.0",
    artigo: "o",
    brand: "volkswagen",
    model: /\bgol\b/,
    engineText: /\b1 0\b/,
    anos: [2009, 2012],
    cambioTipo: "manual",
    motor: "1.0 8V (EA111), 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 76, gasolina: 72 },
    torque: { etanol: 10.6, gasolina: 9.7 },
    torqueRpm: "3.850 rpm",
    cambio: "manual de 5 marchas",
    marchas: 5,
    zeroACem: 12.9,
    vmax: 169,
    cidade: { etanol: 7.4, gasolina: 10.8 },
    estrada: { etanol: 9.5, gasolina: 14.1 },
    tanque: 55,
    portaMalas: 285,
    dim: { comprimento: 3899, largura: 1656, altura: 1451, entreEixos: 2465 },
    peso: 934,
    seguranca: "nessa geração, airbags e ABS eram opcionais: depende de como a unidade saiu de fábrica, e o consultor confirma",
    manutencao:
      "mecânica simples e muito difundida, peças baratas e fáceis de achar",
  },
  {
    id: "ford-ka-sedan-1.5-at",
    nome: "Ford Ka Sedan 1.5 automático",
    curto: "Ka Sedan 1.5",
    artigo: "o",
    brand: "ford",
    model: /\bka\b.*\bsedan\b|\bsedan\b.*\bka\b/,
    anos: [2018, 2021],
    cambioTipo: "automatico",
    motor: "1.5 12V Ti-VCT (Dragon), 3 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 136, gasolina: 128 },
    torque: { etanol: 16.1, gasolina: 15.6 },
    torqueRpm: "4.750 rpm",
    cambio: "automático convencional (conversor de torque) de 6 marchas",
    marchas: 6,
    zeroACem: 10.6,
    vmax: 181,
    cidade: { etanol: 7.8, gasolina: 11 },
    estrada: { etanol: 10.1, gasolina: 14.2 },
    tanque: 51,
    portaMalas: 445,
    dim: { comprimento: 4275, largura: 1695, altura: 1525, entreEixos: 2491 },
    peso: 1115,
    seguranca: "airbags frontais, freios ABS, ISOFIX e cintos de três pontos",
    manutencao:
      "câmbio automático convencional de 6 marchas, que costuma ser considerado robusto quando o óleo é trocado no prazo",
  },
  {
    id: "renault-duster-2.0-at",
    nome: "Renault Duster 2.0 automático",
    curto: "Duster 2.0",
    artigo: "a",
    brand: "renault",
    model: /\bduster\b/,
    anos: [2012, 2015],
    cambioTipo: "automatico",
    motor: "2.0 16V (F4R), 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 142, gasolina: 138 },
    torque: { etanol: 20.9, gasolina: 19.7 },
    torqueRpm: "3.750 rpm",
    cambio: "automático convencional (conversor de torque) de 4 marchas",
    marchas: 4,
    zeroACem: 10.7,
    vmax: 174,
    cidade: { etanol: 5.8, gasolina: 8.5 },
    estrada: { etanol: 7.2, gasolina: 10.5 },
    tanque: 50,
    portaMalas: 475,
    dim: { comprimento: 4315, largura: 1822, altura: 1690, entreEixos: 2673 },
    peso: 1294,
    seguranca: "airbags frontais e freios ABS",
    manutencao:
      "motor 2.0 conhecido e resistente",
  },
  {
    id: "honda-hrv-1.8-cvt",
    nome: "Honda HR-V 1.8 automático (CVT)",
    curto: "HR-V 1.8",
    artigo: "o",
    brand: "honda",
    model: /\bhr v\b|\bhrv\b/,
    anos: [2015, 2018],
    cambioTipo: "automatico",
    motor: "1.8 16V i-VTEC, 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 140, gasolina: 140 },
    torque: { etanol: 17.4, gasolina: 17.4 },
    torqueRpm: "5.000 rpm",
    cambio: "CVT (variação contínua, sem marchas fixas); no modo manual simula 7 marchas",
    marchas: 7,
    zeroACem: 11.2,
    vmax: 175,
    cidade: { etanol: 7.1, gasolina: 10.5 },
    estrada: { etanol: 8.5, gasolina: 12.1 },
    tanque: 51,
    portaMalas: 437,
    dim: { comprimento: 4294, largura: 1772, altura: 1586, entreEixos: 2610 },
    peso: 1276,
    seguranca: "versão EXL de referência: airbags frontais e laterais, ABS, controle de estabilidade e de tração, ISOFIX e freio de estacionamento elétrico",
    manutencao:
      "motor 1.8 conhecido e durável",
    aprox: true,
  },
  {
    id: "honda-civic-2.0-at5",
    nome: "Honda Civic 2.0 automático de 5 marchas",
    curto: "Civic 2.0",
    artigo: "o",
    brand: "honda",
    model: /\bcivic\b/,
    anos: [2014, 2016],
    cambioTipo: "automatico",
    motor: "2.0 16V i-VTEC (R20), 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 155, gasolina: 150 },
    torque: { etanol: 19.5, gasolina: 19.3 },
    torqueRpm: "4.800 rpm",
    cambio: "automático convencional (conversor de torque) de 5 marchas",
    marchas: 5,
    // Referência de ficha, não medição desta unidade; testes de pista podem variar.
    // https://autopapo.com.br/honda/civic-lxr-20-ivtec-flex-aut-2015/
    zeroACem: 10.9,
    vmax: 190,
    cidade: { etanol: 6.4, gasolina: 9.7 },
    estrada: { etanol: 9.4, gasolina: 13.8 },
    tanque: 57,
    portaMalas: 449,
    dim: { comprimento: 4525, largura: 1755, altura: 1450, entreEixos: 2668 },
    peso: 1294,
    seguranca: "airbags frontais, freios ABS, ISOFIX e cintos de três pontos",
    manutencao:
      "motor 2.0 muito conhecido e durável, com peças e mão de obra fáceis",
    aprox: true,
  },
  {
    id: "honda-civic-2.0-cvt",
    nome: "Honda Civic 2.0 automático (CVT)",
    curto: "Civic 2.0",
    artigo: "o",
    brand: "honda",
    model: /\bcivic\b/,
    anos: [2017, 2021],
    cambioTipo: "automatico",
    motor: "2.0 16V i-VTEC (R20), 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 155, gasolina: 150 },
    torque: { etanol: 19.5, gasolina: 19.3 },
    cambio: "CVT (variação contínua, sem marchas fixas)",
    // https://autopapo.com.br/honda/civic-exl-20-cvt-2020/
    zeroACem: 10.9,
    vmax: 195,
    cidade: { etanol: 7.2, gasolina: 10.5 },
    estrada: { etanol: 8.9, gasolina: 13 },
    tanque: 56,
    portaMalas: 519,
    dim: { comprimento: 4641, largura: 1799, altura: 1433, entreEixos: 2700 },
    peso: 1291,
    seguranca: "versão EXL de referência: airbags frontais, laterais e de cortina, ABS, controle de estabilidade e de tração, ISOFIX e freio de estacionamento elétrico",
    manutencao:
      "motor 2.0 muito conhecido e durável",
    aprox: true,
  },
  {
    id: "fiat-mobi-1.0",
    nome: "Fiat Mobi 1.0 manual",
    curto: "Mobi 1.0",
    artigo: "o",
    brand: "fiat",
    model: /\bmobi\b/,
    anos: [2017, 2024],
    cambioTipo: "manual",
    motor: "1.0 8V Fire, 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 74, gasolina: 71 },
    torque: { etanol: 9.7, gasolina: 9.3 },
    cambio: "manual de 5 marchas",
    marchas: 5,
    zeroACem: 14,
    vmax: 152,
    cidade: { etanol: 9.6, gasolina: 13.5 },
    estrada: { etanol: 10.4, gasolina: 15 },
    tanque: 47,
    portaMalas: 200,
    dim: { comprimento: 3596, largura: 1666, altura: 1523, entreEixos: 2304 },
    peso: 961,
    seguranca: "airbags frontais, freios ABS, controle de estabilidade e de tração e ISOFIX",
    manutencao:
      "mecânica Fire simples, com peças baratas e fáceis",
    aprox: true,
  },
  {
    id: "fiat-palio-fire-1.0",
    nome: "Fiat Palio 1.0 Fire manual",
    curto: "Palio 1.0",
    artigo: "o",
    brand: "fiat",
    model: /\bpalio\b/,
    not: /weekend|adventure/,
    anos: [2004, 2009],
    cambioTipo: "manual",
    motor: "1.0 8V Fire, 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 66, gasolina: 65 },
    torque: { etanol: 9.2, gasolina: 9.1 },
    cambio: "manual de 5 marchas",
    marchas: 5,
    zeroACem: 15.7,
    vmax: 154,
    cidade: { etanol: 7.5, gasolina: 10.4 },
    estrada: { etanol: 10, gasolina: 13 },
    tanque: 48,
    portaMalas: 290,
    dim: { comprimento: 3827, largura: 1634, altura: 1433, entreEixos: 2373 },
    peso: 970,
    seguranca: "na época, airbag e ABS eram opcionais: muitas unidades não têm, e o consultor confirma",
    manutencao:
      "mecânica Fire simples e das mais baratas de manter, com peças em todo lugar",
    aprox: true,
  },
  {
    id: "fiat-palio-weekend-adventure-1.8-manual",
    nome: "Fiat Palio Weekend Adventure 1.8 manual",
    curto: "Weekend Adventure 1.8",
    artigo: "a",
    brand: "fiat",
    model: /weekend|adventure/,
    anos: [2012, 2016],
    cambioTipo: "manual",
    motor: "1.8 16V E.torQ, 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 132, gasolina: 130 },
    torque: { etanol: 18.9, gasolina: 18.4 },
    torqueRpm: "4.500 rpm",
    cambio: "manual de 5 marchas",
    marchas: 5,
    zeroACem: 10.5,
    vmax: 184,
    cidade: { etanol: 6.6, gasolina: 9.7 },
    estrada: { etanol: 7.2, gasolina: 10.2 },
    tanque: 51,
    portaMalas: 460,
    dim: { comprimento: 4310, largura: 1721, altura: 1643, entreEixos: 2466 },
    peso: 1235,
    seguranca: "airbags frontais e freios ABS",
    manutencao:
      "motor 1.8 E.torQ com peças acessíveis",
  },
  {
    id: "fiat-palio-weekend-adventure-1.8-dualogic",
    nome: "Fiat Palio Weekend Adventure 1.8 Dualogic",
    curto: "Weekend Adventure 1.8 Dualogic",
    artigo: "a",
    brand: "fiat",
    model: /weekend|adventure/,
    anos: [2012, 2016],
    cambioTipo: "automatico",
    motor: "1.8 16V E.torQ, 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 132, gasolina: 130 },
    torque: { etanol: 18.9, gasolina: 18.4 },
    torqueRpm: "4.500 rpm",
    cambio: "automatizado Dualogic de 5 marchas (embreagem a seco comandada por computador)",
    marchas: 5,
    zeroACem: 10.5,
    vmax: 184,
    cidade: { etanol: 6.5, gasolina: 9.5 },
    estrada: { etanol: 7.2, gasolina: 10.2 },
    tanque: 51,
    portaMalas: 460,
    dim: { comprimento: 4310, largura: 1721, altura: 1643, entreEixos: 2466 },
    peso: 1242,
    seguranca: "airbags frontais e freios ABS",
    manutencao:
      "mecânica Fiat conhecida, com boa oferta de peças e oficinas familiarizadas com o modelo",
  },
  {
    id: "toyota-corolla-altis-2.0",
    nome: "Toyota Corolla Altis 2.0 automático (CVT)",
    curto: "Corolla 2.0",
    artigo: "o",
    brand: "toyota",
    model: /\bcorolla\b/,
    anos: [2015, 2019],
    cambioTipo: "automatico",
    motor: "2.0 16V Dual VVT-i, 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 154, gasolina: 143 },
    torque: { etanol: 20.7, gasolina: 19.4 },
    torqueRpm: "4.800 rpm",
    cambio: "CVT (variação contínua, sem marchas fixas); no modo manual simula 7 marchas",
    marchas: 7,
    zeroACem: 9.6,
    vmax: 199,
    cidade: { etanol: 7.2, gasolina: 10.6 },
    estrada: { etanol: 8.8, gasolina: 12.6 },
    tanque: 60,
    portaMalas: 470,
    dim: { comprimento: 4620, largura: 1775, altura: 1475, entreEixos: 2700 },
    peso: 1335,
    seguranca: "airbags frontais, laterais e de cortina, ABS, controle de estabilidade e de tração e ISOFIX",
    manutencao:
      "fama de durabilidade e boa revenda",
  },
  {
    id: "hyundai-hb20s-1.0-tgdi",
    nome: "Hyundai HB20S 1.0 turbo (TGDI) automático",
    curto: "HB20S 1.0 turbo",
    artigo: "o",
    brand: "hyundai",
    model: /\bhb20s\b/,
    engineText: /tgdi|turbo/,
    anos: [2020, 2025],
    cambioTipo: "automatico",
    motor: "1.0 TGDI (Kappa), 3 cilindros, turbo com injeção direta, flex",
    combustivel: "flex",
    cv: { etanol: 120, gasolina: 120 },
    torque: { etanol: 17.5, gasolina: 17.5 },
    torqueRpm: "1.500 rpm (já disponível em baixa rotação)",
    cambio: "automático convencional (conversor de torque) de 6 marchas",
    marchas: 6,
    zeroACem: 10.7,
    vmax: 191,
    cidade: { etanol: 8.3, gasolina: 11.6 },
    estrada: { etanol: 9.9, gasolina: 14.3 },
    tanque: 50,
    portaMalas: 475,
    dim: { comprimento: 4325, largura: 1720, altura: 1470, entreEixos: 2530 },
    peso: 1137,
    seguranca: "airbags frontais, laterais e de cortina, ABS, controle de estabilidade e de tração e ISOFIX",
    manutencao:
      "motor turbo de injeção direta com bom desempenho e mecânica difundida; comando por corrente",
    aprox: true,
  },
  {
    id: "hyundai-hb20-1.6-at",
    nome: "Hyundai HB20 1.6 automático",
    curto: "HB20 1.6",
    artigo: "o",
    brand: "hyundai",
    model: /\bhb20\b/,
    engineText: /\b1 6\b/,
    anos: [2013, 2015],
    cambioTipo: "automatico",
    motor: "1.6 16V Gamma, 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 128, gasolina: 122 },
    torque: { etanol: 16.5, gasolina: 16 },
    torqueRpm: "5.000 rpm",
    cambio: "automático convencional (conversor de torque) de 4 marchas",
    marchas: 4,
    zeroACem: 11,
    vmax: 176,
    cidade: { etanol: 7, gasolina: 10.1 },
    estrada: { etanol: 8.3, gasolina: 11.8 },
    tanque: 50,
    portaMalas: 300,
    dim: { comprimento: 3900, largura: 1680, altura: 1470, entreEixos: 2500 },
    peso: 1027,
    seguranca: "airbags frontais, freios ABS e ISOFIX",
    manutencao:
      "motor 1.6 Gamma conhecido e com peças acessíveis",
  },
  {
    id: "hyundai-hb20-1.0",
    nome: "Hyundai HB20 1.0",
    curto: "HB20 1.0",
    artigo: "o",
    brand: "hyundai",
    model: /\bhb20\b/,
    engineText: /\b1 0\b/,
    anos: [2020, 2024],
    cambioTipo: "manual",
    motor: "1.0 12V Kappa, 3 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 80, gasolina: 75 },
    torque: { etanol: 10.2, gasolina: 9.4 },
    torqueRpm: "4.500 rpm",
    cambio: "manual de 5 marchas",
    marchas: 5,
    zeroACem: 14.5,
    vmax: 161,
    cidade: { etanol: 9.8, gasolina: 13.1 },
    estrada: { etanol: 10.7, gasolina: 15 },
    tanque: 50,
    portaMalas: 300,
    dim: { comprimento: 3940, largura: 1720, altura: 1470, entreEixos: 2530 },
    peso: 989,
    seguranca: "airbags frontais, freios ABS, controle de estabilidade e de tração e ISOFIX",
    manutencao:
      "motor 1.0 de 3 cilindros simples e econômico de manter, com peças acessíveis",
  },
  {
    id: "nissan-kicks-1.6-cvt",
    nome: "Nissan Kicks 1.6 automático (CVT)",
    curto: "Kicks 1.6",
    artigo: "o",
    brand: "nissan",
    model: /\bkicks\b/,
    anos: [2017, 2020],
    cambioTipo: "automatico",
    motor: "1.6 16V (HR16DE), 4 cilindros, aspirado, flex",
    combustivel: "flex",
    cv: { etanol: 114, gasolina: 114 },
    torque: { etanol: 15.5, gasolina: 15.5 },
    torqueRpm: "4.000 rpm",
    cambio: "CVT (variação contínua, sem marchas fixas)",
    zeroACem: 12,
    vmax: 175,
    cidade: { etanol: 7.7, gasolina: 11.4 },
    estrada: { etanol: 9.4, gasolina: 13.7 },
    tanque: 41,
    portaMalas: 432,
    dim: { comprimento: 4295, largura: 1760, altura: 1590, entreEixos: 2620 },
    peso: 1142,
    seguranca: "airbags frontais, laterais e de cortina, ABS e controle de estabilidade",
    manutencao:
      "motor 1.6 simples e durável",
  },
  {
    id: "mitsubishi-lancer-2.0-cvt",
    nome: "Mitsubishi Lancer 2.0 automático (CVT)",
    curto: "Lancer 2.0",
    artigo: "o",
    brand: "mitsubishi",
    model: /\blancer\b/,
    anos: [2012, 2016],
    cambioTipo: "automatico",
    motor: "2.0 16V MIVEC (4B11), 4 cilindros, aspirado",
    combustivel: "gasolina",
    cv: { gasolina: 160 },
    torque: { gasolina: 20.1 },
    torqueRpm: "4.200 rpm",
    cambio: "CVT (variação contínua, sem marchas fixas); no modo manual simula 6 marchas",
    marchas: 6,
    zeroACem: 10.7,
    vmax: 198,
    cidade: { gasolina: 8.8 },
    estrada: { gasolina: 10.7 },
    tanque: 59,
    portaMalas: 430,
    dim: { comprimento: 4570, largura: 1760, altura: 1490, entreEixos: 2635 },
    peso: 1360,
    seguranca: "airbags frontais e freios ABS",
    manutencao:
      "motor 2.0 MIVEC robusto e conhecido",
    aprox: true,
  },
  {
    id: "vw-nivus-200-tsi",
    nome: "Volkswagen Nivus 1.0 200 TSI automático",
    curto: "Nivus 200 TSI",
    artigo: "o",
    brand: "volkswagen",
    model: /\bnivus\b/,
    anos: [2021, 2023],
    cambioTipo: "automatico",
    motor: "1.0 200 TSI (EA211), 3 cilindros, turbo com injeção direta, flex",
    combustivel: "flex",
    cv: { etanol: 128, gasolina: 116 },
    torque: { etanol: 20.4, gasolina: 20.4 },
    torqueRpm: "2.000 rpm (já disponível em baixa rotação)",
    cambio: "automático convencional (conversor de torque) de 6 marchas",
    marchas: 6,
    zeroACem: 10,
    vmax: 189,
    cidade: { etanol: 7.7, gasolina: 10.7 },
    estrada: { etanol: 9.4, gasolina: 13.2 },
    tanque: 52,
    portaMalas: 415,
    dim: { comprimento: 4266, largura: 1757, altura: 1493, entreEixos: 2566 },
    peso: 1199,
    seguranca: "airbags frontais, laterais e de cortina, ABS, controle de estabilidade e de tração e ISOFIX",
    manutencao:
      "motor turbo de injeção direta com bom desempenho e mecânica difundida",
  },
  {
    id: "honda-biz-110i",
    nome: "Honda Biz 110i",
    curto: "Biz 110i",
    artigo: "a",
    brand: "honda",
    model: /\bbiz\b/,
    engineText: /\b110/,
    anos: [2019, 2024],
    moto: true,
    motor: "109,1 cc, monocilíndrico, 4 tempos, arrefecido a ar, injeção eletrônica",
    combustivel: "gasolina",
    cv: { gasolina: 8.3 },
    torque: { gasolina: 0.89 },
    torqueRpm: "5.500 rpm",
    cambio: "semiautomático de 4 marchas (sem alavanca de embreagem; só o pé troca)",
    marchas: 4,
    consumoMoto: 50,
    tanque: 5.1,
    peso: 97,
    seguranca: "sistema de freio combinado (CBS); sem ABS de série nessa categoria",
    manutencao:
      "uma das motos mais simples e baratas de manter do mercado, com peças em qualquer lugar",
    aprox: true,
  },
  {
    id: "honda-biz-125",
    nome: "Honda Biz 125",
    curto: "Biz 125",
    artigo: "a",
    brand: "honda",
    model: /\bbiz\b/,
    engineText: /\b125/,
    anos: [2019, 2024],
    moto: true,
    motor: "124,9 cc, monocilíndrico, 4 tempos, arrefecido a ar, injeção eletrônica, flex",
    combustivel: "flex",
    cv: { gasolina: 9.2 },
    torque: { gasolina: 1.04 },
    torqueRpm: "3.500 rpm",
    cambio: "semiautomático de 4 marchas (sem alavanca de embreagem; só o pé troca)",
    marchas: 4,
    consumoMoto: 40,
    tanque: 5.1,
    peso: 97,
    seguranca: "sistema de freio combinado (CBS); sem ABS de série nessa categoria",
    manutencao:
      "mecânica simples e barata de manter, com peças em qualquer lugar",
    aprox: true,
  },
  {
    id: "honda-cg-160",
    nome: "Honda CG 160",
    curto: "CG 160",
    artigo: "a",
    brand: "honda",
    model: /\bcg\b/,
    engineText: /\b160/,
    anos: [2021, 2024],
    moto: true,
    motor: "162,7 cc, monocilíndrico, 4 tempos, arrefecido a ar, injeção eletrônica (flex nas versões Titan e Fan)",
    combustivel: "flex",
    cv: { etanol: 15.1, gasolina: 14.9 },
    torque: { etanol: 1.54, gasolina: 1.4 },
    cambio: "manual de 5 marchas",
    marchas: 5,
    seguranca: "versão básica com freio a tambor; as demais, disco na frente",
    manutencao:
      "uma das motos mais difundidas do país: peças baratas e fáceis, mecânica simples",
    aprox: true,
  },
];

/* ---------- Resolução da ficha de um veículo ---------- */

function gearKind(transmission?: string | null): "automatico" | "manual" | null {
  const text = FOLD(transmission ?? "");
  if (!text) return null;
  if (/autom|cvt|dct|dualogic|tiptronic|steptronic/.test(text)) return "automatico";
  if (/manual/.test(text)) return "manual";
  return null;
}

export function findVehicleSpec(subject: SpecSubject): VehicleSpec | null {
  const brand = FOLD(subject.brand);
  const brandKey = brand === "vw" ? "volkswagen" : brand;
  const modelText = FOLD(`${subject.model} ${subject.version ?? ""}`);
  const engineText = FOLD(`${subject.model} ${subject.version ?? ""} ${subject.engine ?? ""}`);
  const gear = gearKind(subject.transmission);
  const moto = (subject.category ?? "carro") === "moto";
  const found = VEHICLE_SPECS.filter((spec) => {
    if (spec.brand !== brandKey) return false;
    if (Boolean(spec.moto) !== moto) return false;
    if (subject.yearModel < spec.anos[0] || subject.yearModel > spec.anos[1]) return false;
    if (!spec.model.test(modelText)) return false;
    if (spec.not?.test(modelText)) return false;
    if (spec.engineText && !spec.engineText.test(engineText)) return false;
    if (spec.cambioTipo && gear && spec.cambioTipo !== gear) return false;
    return true;
  });
  if (found.length === 0) return null;
  // Civic 2014–2016 e 2017+ não se sobrepõem em ano; mesmo assim prefira a faixa mais justa.
  return found.sort((a, b) => a.anos[1] - a.anos[0] - (b.anos[1] - b.anos[0]))[0] ?? null;
}

/* ---------- Formatação ---------- */

function num(value: number) {
  const fixed = String(Number(value.toFixed(2)));
  const [int, frac] = fixed.split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac ? `${grouped},${frac}` : grouped;
}

function fuelPair(pair: FuelPair | undefined, unit: string) {
  if (!pair) return null;
  const { etanol, gasolina } = pair;
  if (etanol != null && gasolina != null) {
    if (etanol === gasolina) return `${num(etanol)} ${unit}, tanto no etanol quanto na gasolina`;
    return `${num(etanol)} ${unit} no etanol e ${num(gasolina)} ${unit} na gasolina`;
  }
  if (gasolina != null) return `${num(gasolina)} ${unit} na gasolina`;
  if (etanol != null) return `${num(etanol)} ${unit} no etanol`;
  return null;
}

/** "128 cv no etanol e 122 cv na gasolina", para frases de outros módulos. */
export function specPowerText(spec: VehicleSpec) {
  return fuelPair(spec.cv, "cv");
}

/** km/l na cidade (Inmetro, gasolina; moto usa a média aproximada), para ordenar e comparar. */
export function specCityKmL(spec: VehicleSpec) {
  return spec.cidade?.gasolina ?? spec.consumoMoto ?? null;
}

/** Maior potência de catálogo (cv), para ordenar. */
export function specMaxCv(spec: VehicleSpec) {
  return Math.max(spec.cv.etanol ?? 0, spec.cv.gasolina ?? 0);
}

function roundTo10(value: number) {
  return Math.round(value / 10) * 10;
}

export type SpecAutonomy = {
  cidade: FuelPair;
  estrada: FuelPair;
};

/** Autonomia teórica com o tanque cheio: litros × km/l do Inmetro, arredondada a 10 km. */
export function specAutonomy(spec: VehicleSpec): SpecAutonomy | null {
  if (!spec.tanque) return null;
  const tank = spec.tanque;
  const calc = (consumption?: FuelPair): FuelPair => ({
    ...(consumption?.etanol != null ? { etanol: roundTo10(tank * consumption.etanol) } : {}),
    ...(consumption?.gasolina != null ? { gasolina: roundTo10(tank * consumption.gasolina) } : {}),
  });
  const cidade = calc(spec.cidade);
  const estrada = calc(spec.estrada);
  const has = (pair: FuelPair) => pair.etanol != null || pair.gasolina != null;
  if (!has(cidade) && !has(estrada)) {
    if (!spec.consumoMoto) return null;
    const km = roundTo10(tank * spec.consumoMoto);
    return { cidade: { gasolina: km }, estrada: { gasolina: km } };
  }
  return { cidade, estrada };
}

/** Bloco de ficha para o prompt do modelo. */
export function formatSpecForPrompt(spec: VehicleSpec, forLabel?: string) {
  const lines: string[] = [];
  const years = spec.anos[0] === spec.anos[1] ? `${spec.anos[0]}` : `${spec.anos[0]}–${spec.anos[1]}`;
  lines.push(`- ${forLabel ?? spec.nome} (ficha do modelo, anos ${years})${spec.aprox ? " [alguns números aproximados]" : ""}`);
  lines.push(`  Motor: ${spec.motor}`);
  const power = fuelPair(spec.cv, "cv");
  const torque = fuelPair(spec.torque, "kgfm");
  if (power || torque) {
    lines.push(
      `  Potência: ${power ?? "sem dado"}${torque ? `; torque: ${torque}${spec.torqueRpm ? `, a ${spec.torqueRpm}` : ""}` : ""}`,
    );
  }
  lines.push(`  Câmbio: ${spec.cambio}`);
  const perf: string[] = [];
  if (spec.zeroACem) perf.push(`0 a 100 km/h: cerca de ${num(spec.zeroACem)} s`);
  if (spec.vmax) perf.push(`velocidade máxima: cerca de ${num(spec.vmax)} km/h`);
  if (perf.length) lines.push(`  ${perf.join("; ")}`);
  if (spec.cidade || spec.estrada) {
    lines.push(
      `  Consumo Inmetro (km/l): cidade ${fuelPair(spec.cidade, "km/l") ?? "sem dado"}; estrada ${fuelPair(spec.estrada, "km/l") ?? "sem dado"}`,
    );
  } else if (spec.consumoMoto) {
    lines.push(`  Consumo: na casa dos ${num(spec.consumoMoto)} km/l (varia muito com o uso)`);
  }
  const tank = spec.tanque ? `tanque: ${num(spec.tanque)} L` : null;
  const auto = specAutonomy(spec);
  if (tank) {
    const fuels = (pair: FuelPair) =>
      [pair.etanol != null ? `~${num(pair.etanol)} km etanol` : null, pair.gasolina != null ? `~${num(pair.gasolina)} km gasolina` : null]
        .filter(Boolean)
        .join(" / ");
    lines.push(
      `  ${tank}${auto ? `; autonomia teórica de tanque cheio (já calculada): cidade ${fuels(auto.cidade)}; estrada ${fuels(auto.estrada)}` : ""}`,
    );
  }
  const body: string[] = [];
  if (spec.portaMalas) body.push(`porta-malas: ${num(spec.portaMalas)} L`);
  if (spec.dim)
    body.push(
      `dimensões: ${num(spec.dim.comprimento)} × ${num(spec.dim.largura)} × ${num(spec.dim.altura)} mm (comp. × larg. × alt.), entre-eixos ${num(spec.dim.entreEixos)} mm`,
    );
  if (spec.peso) body.push(`peso: ${num(spec.peso)} kg`);
  if (body.length) lines.push(`  ${body.join("; ")}`);
  lines.push(`  Equipamentos da base genérica (exigem confirmação da versão e ano exatos): ${spec.seguranca}`);
  lines.push(`  Manutenção típica do modelo: ${spec.manutencao}`);
  return lines.join("\n");
}

/** Uma linha por modelo, para quando muitas fichas entram no mesmo prompt. */
export function formatSpecCompact(spec: VehicleSpec, forLabel?: string) {
  const bits: string[] = [];
  const power = fuelPair(spec.cv, "cv");
  if (power) bits.push(`potência ${power}`);
  const torque = fuelPair(spec.torque, "kgfm");
  if (torque) bits.push(`torque ${torque}`);
  bits.push(`câmbio ${spec.cambio}`);
  if (spec.zeroACem) bits.push(`0–100 ~${num(spec.zeroACem)} s`);
  if (spec.cidade || spec.estrada) {
    bits.push(
      `Inmetro cidade ${fuelPair(spec.cidade, "km/l") ?? "s/d"}, estrada ${fuelPair(spec.estrada, "km/l") ?? "s/d"}`,
    );
  } else if (spec.consumoMoto) {
    bits.push(`consumo ~${num(spec.consumoMoto)} km/l`);
  }
  if (spec.tanque) bits.push(`tanque ${num(spec.tanque)} L`);
  if (spec.portaMalas) bits.push(`porta-malas ${num(spec.portaMalas)} L`);
  return `- ${forLabel ?? spec.nome}: ${bits.join("; ")}`;
}

/* ---------- Tópicos das perguntas ---------- */

export type SpecTopic =
  | "potencia"
  | "torque"
  | "consumo"
  | "autonomia"
  | "aceleracao"
  | "cambio"
  | "portamalas"
  | "dimensoes"
  | "seguranca"
  | "manutencao"
  | "motor"
  | "ficha"
  | "pontosfortes"
  | "ranking"
  | "comparacao";

const TOPIC_RULES: Array<[SpecTopic, RegExp]> = [
  ["pontosfortes", /\b(pontos? positivos?|pontos? fortes?|vantagens?|vale a pena|e bom|eh bom)\b/],
  ["potencia", /\b(cv|cvs|cavalos?|potencia|potencias|hp|potente|potentes|cavalaria)\b/],
  ["torque", /\b(torque|kgfm|kgf m)\b/],
  [
    "consumo",
    /\b(consumo|consome|consumindo|gasta|gastam|gasto|bebe|beber|km l|kml|km por litro|por litro|e economic[oa]|eh economic[oa]|economia de combustivel|rende|faz quantos km|quantos km faz|media de consumo)\b/,
  ],
  [
    "autonomia",
    /\b(autonomia|tanque|quantos litros (?:cabe|cabem|tem)|quantos km (?:eu )?(?:faco|roda|anda|vai|da) com (?:um )?tanque)\b/,
  ],
  [
    "aceleracao",
    /\b(0 a 100|0 100|zero a cem|aceleracao|acelera|arranca|arrancada|velocidade maxima|velocidade final|vmax|chega a quantos km|quantos km por hora)\b/,
  ],
  [
    "cambio",
    /\b(marchas?|numero de marchas|marchas tem|marchas o|tipo de cambio|que tipo de cambio|qual cambio|que cambio|qual o cambio|qual e o cambio|cvt|dct|dualogic|automatizado|conversor de torque|e cvt|cambio e|cambio tem)\b/,
  ],
  ["portamalas", /\b(porta malas|portamalas|bagageiro|mala do carro)\b/],
  [
    "dimensoes",
    /\b(dimensoes|dimensao|tamanho do carro|comprimento|largura|altura do carro|entre eixos|entreeixos|vao livre|peso do carro|quantos metros)\b/,
  ],
  [
    "seguranca",
    /\b(seguranca|airbags?|air bags?|abs|controle de estabilidade|esp|isofix|ncap|crash test|freios?|freio abs|estabilidade|bolsas?)\b/,
  ],
  [
    "manutencao",
    /\b(manutencao|manutencoes|revisao|revisoes|custo de manutencao|pecas|peca|defeito|defeitos|ponto fraco|pontos fracos|confiavel|confiabilidade|quebra|durabilidade|e duro|da problema|dao problema|tem problema|problemas? (?:conhecid\w+|cronic\w+|comuns?|no motor|no cambio|de motor|de cambio|do motor|do cambio)|manter)\b/,
  ],
  ["motor", /\b(motor|motorizacao|turbo|aspirado|cilindros?|cilindrada|tsi|tgdi|injecao direta)\b/],
  ["ficha", /\b(ficha tecnica|dados tecnicos|especificacoes|especificacao|specs)\b/],
  [
    "ranking",
    /\b(mais (?:forte|fortes|potente|potentes|economic\w+|rapido|rapidos|espacos\w+|seguro|seguros|confiavel|confiaveis|agil)|gasta menos|consome menos|bebe menos|gasta mais|consome mais|qual (?:e )?(?:o )?(?:melhor|mais) (?:em|de|para|pra) (?:potencia|consumo|estrada|cidade|espaco))\b/,
  ],
  ["comparacao", /\b(compar\w*|diferenca|diferencas|versus|vs|melhor que|pior que|qual dos|qual deles|qual desses|qual melhor|qual o melhor)\b/],
];

/**
 * Tópicos técnicos da pergunta. Texto dobrado (sem acento, minúsculo) é
 * calculado aqui; "forte" e "motor" soltos só contam como ranking/motor.
 */
export function detectSpecTopics(message: string): SpecTopic[] {
  const text = FOLD(message).replace(/\bkm l\b/g, "km l");
  const topics: SpecTopic[] = [];
  for (const [topic, pattern] of TOPIC_RULES) {
    if (pattern.test(text)) topics.push(topic);
  }
  // "forte" sem "mais": só ranking quando é comparativo; "motor forte" = potência.
  if (/\bmotor forte\b|\bcarro forte\b|\bforte\b/.test(text) && !topics.includes("potencia")) {
    topics.push("potencia");
  }
  return topics;
}

export function isSpecQuestion(message: string) {
  return detectSpecTopics(message).length > 0;
}

/* ---------- Respostas diretas (determinísticas) ---------- */

/** Tópicos que a resposta determinística cobre sozinha, com dado exato da ficha. */
export const DIRECT_SPEC_TOPICS: SpecTopic[] = [
  "potencia",
  "torque",
  "consumo",
  "autonomia",
  "aceleracao",
  "cambio",
  "portamalas",
];

export type NamedSpec = { spec: VehicleSpec; nome: string };

function capital(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function subjectName(entry: NamedSpec) {
  return `${entry.spec.artigo} ${entry.nome}`;
}

function powerSentence(entry: NamedSpec) {
  const power = fuelPair(entry.spec.cv, "cv");
  if (!power) return null;
  return `${capital(subjectName(entry))} tem cerca de ${power}.`;
}

function torqueSentence(entry: NamedSpec) {
  const torque = fuelPair(entry.spec.torque, "kgfm");
  if (!torque) return null;
  const rpm = entry.spec.torqueRpm ? `, a ${entry.spec.torqueRpm}` : "";
  return `O torque ${entry.spec.artigo === "o" ? "do" : "da"} ${entry.nome} é de cerca de ${torque}${rpm}.`;
}

function accelerationSentence(entry: NamedSpec) {
  if (!entry.spec.zeroACem) return null;
  const top = entry.spec.vmax ? ` e a máxima fica perto de ${num(entry.spec.vmax)} km/h` : "";
  return `${capital(subjectName(entry))} faz o 0 a 100 km/h em cerca de ${num(entry.spec.zeroACem)} segundos${top}.`;
}

function gearSentence(entry: NamedSpec, wantsGears: boolean) {
  const { spec } = entry;
  if (wantsGears && spec.marchas && /CVT/.test(spec.cambio)) {
    return `${capital(subjectName(entry))} usa câmbio CVT, que não tem marchas fixas; no modo manual ele simula ${spec.marchas} marchas.`;
  }
  if (wantsGears && spec.marchas) {
    return `${capital(subjectName(entry))} tem câmbio ${spec.cambio}.`;
  }
  return `${capital(subjectName(entry))} tem câmbio ${spec.cambio}.`;
}

function trunkSentence(entry: NamedSpec) {
  if (!entry.spec.portaMalas) return null;
  return `O porta-malas ${entry.spec.artigo === "o" ? "do" : "da"} ${entry.nome} tem cerca de ${num(entry.spec.portaMalas)} litros.`;
}

function consumptionSentence(entry: NamedSpec) {
  const { spec } = entry;
  if (spec.consumoMoto) {
    return `${capital(subjectName(entry))} costuma andar na casa dos ${num(spec.consumoMoto)} km/l, variando bastante com o uso.`;
  }
  const city = fuelPair(spec.cidade, "km/l");
  const road = fuelPair(spec.estrada, "km/l");
  if (!city && !road) return null;
  if (spec.combustivel === "gasolina" || (!spec.cidade?.etanol && !spec.estrada?.etanol)) {
    return `Pelo Inmetro, ${spec.artigo} ${entry.nome} faz cerca de ${num(spec.cidade?.gasolina ?? 0)} km/l na cidade e ${num(spec.estrada?.gasolina ?? 0)} km/l na estrada, na gasolina.`;
  }
  return `Pelo Inmetro, ${spec.artigo} ${entry.nome} faz cerca de ${num(spec.cidade!.etanol ?? 0)} km/l na cidade e ${num(spec.estrada!.etanol ?? 0)} km/l na estrada com etanol; na gasolina, ${num(spec.cidade!.gasolina ?? 0)} km/l na cidade e ${num(spec.estrada!.gasolina ?? 0)} km/l na estrada.`;
}

function autonomySentence(entry: NamedSpec) {
  const { spec } = entry;
  const auto = specAutonomy(spec);
  if (!auto || !spec.tanque) return null;
  const tank = `${num(spec.tanque)} litros`;
  if (spec.consumoMoto) {
    return `Com o tanque cheio (${tank}), ${spec.artigo} ${entry.nome} anda em torno de ${num(auto.estrada.gasolina ?? 0)} km. É uma conta aproximada; no dia a dia varia bastante.`;
  }
  const hasEthanol = auto.cidade.etanol != null && auto.estrada.etanol != null;
  const hasGasoline = auto.cidade.gasolina != null && auto.estrada.gasolina != null;
  const parts: string[] = [];
  if (hasEthanol)
    parts.push(`com etanol, cerca de ${num(auto.cidade.etanol!)} km na cidade e ${num(auto.estrada.etanol!)} km na estrada`);
  if (hasGasoline)
    parts.push(`com gasolina, cerca de ${num(auto.cidade.gasolina!)} km na cidade e ${num(auto.estrada.gasolina!)} km na estrada`);
  if (!parts.length) return null;
  return `Com o tanque cheio (${tank}), ${spec.artigo} ${entry.nome} faz, ${parts.join("; ")}. É uma conta teórica (tanque × consumo do Inmetro); no dia a dia varia com trânsito e jeito de dirigir.`;
}

const CLOSING = "São números de referência dessa versão; podem variar um pouco na prática.";

function safetySentence(entry: NamedSpec) {
  return `Os equipamentos de segurança do ${entry.nome} dependem da versão e do ano. O vendedor confirma os itens desta unidade pela ficha e no WhatsApp.`;
}

function maintenanceSentence(entry: NamedSpec) {
  const de = entry.spec.artigo === "o" ? "do" : "da";
  return `Sobre a manutenção ${de} ${entry.nome}: ${entry.spec.manutencao}. Isso vale para o modelo; o estado desta unidade o consultor avalia com você.`;
}

function dimensionsSentence(entry: NamedSpec) {
  const { dim, peso } = entry.spec;
  if (!dim) return null;
  const weight = peso ? ` e pesa cerca de ${num(peso)} kg` : "";
  return `${capital(subjectName(entry))} tem ${num(dim.comprimento)} mm de comprimento, ${num(dim.largura)} mm de largura e ${num(dim.altura)} mm de altura, com ${num(dim.entreEixos)} mm entre-eixos${weight}.`;
}

function engineSentence(entry: NamedSpec) {
  return `${capital(subjectName(entry))} usa motor ${entry.spec.motor}.`;
}

function sheetSentence(entry: NamedSpec) {
  return [engineSentence(entry), powerSentence(entry), torqueSentence(entry), gearSentence(entry, false), trunkSentence(entry)]
    .filter(Boolean)
    .join(" ");
}

const EXTENDED_SPEC_TOPICS: SpecTopic[] = ["seguranca", "manutencao", "dimensoes", "motor", "ficha"];

function sentenceFor(topic: SpecTopic, entry: NamedSpec, wantsGears: boolean) {
  switch (topic) {
    case "potencia":
      return powerSentence(entry);
    case "torque":
      return torqueSentence(entry);
    case "aceleracao":
      return accelerationSentence(entry);
    case "cambio":
      return gearSentence(entry, wantsGears);
    case "portamalas":
      return trunkSentence(entry);
    case "consumo":
      return consumptionSentence(entry);
    case "autonomia":
      return autonomySentence(entry);
    case "seguranca":
      return safetySentence(entry);
    case "manutencao":
      return maintenanceSentence(entry);
    case "dimensoes":
      return dimensionsSentence(entry);
    case "motor":
      return engineSentence(entry);
    case "ficha":
      return sheetSentence(entry);
    default:
      return null;
  }
}

function buildSpecReply(
  topics: SpecTopic[],
  entries: NamedSpec[],
  message: string,
  allowed: SpecTopic[],
): string | null {
  const asked = topics.filter((topic) => topic !== "comparacao");
  if (asked.length === 0 || entries.length === 0 || entries.length > 3) return null;
  if (asked.some((topic) => !allowed.includes(topic))) return null;
  if (topics.includes("comparacao") && entries.length > 1) return null;
  if (asked.length === 1 && asked[0] === "aceleracao" && entries.length > 1 &&
      entries.every(entry => entry.spec.zeroACem != null) &&
      Math.max(...entries.map(entry => entry.spec.zeroACem!)) - Math.min(...entries.map(entry => entry.spec.zeroACem!)) <= 0.3) {
    const names = entries.map(entry => entry.nome).join(" e o ");
    const values = [...new Set(entries.map(entry => entry.spec.zeroACem!))].sort((a, b) => a - b).map(num);
    const time = values.length === 1 ? values[0] : `${values[0]} a ${values.at(-1)}`;
    return `O ${names} ficam perto de ${time} segundos no 0 a 100 km/h, como referência das versões. O câmbio é ${entries.map(entry => `${entry.spec.cambio} no ${entry.nome}`).join(" e ")}. Na prática, combustível e condições do teste mudam o resultado.`;
  }
  const wantsGears = /\bmarchas?\b/.test(FOLD(message));
  const sentences: string[] = [];
  for (const entry of entries) {
    const parts: string[] = [];
    for (const topic of asked) {
      const sentence = sentenceFor(topic, entry, wantsGears);
      if (!sentence) return null;
      parts.push(sentence);
    }
    sentences.push(parts.join(" "));
  }
  const text = sentences.join(" ");
  // Câmbio e porta-malas são fixos do modelo; o aviso de variação só vale para número que muda.
  const needsHint = asked.some((topic) =>
    ["potencia", "torque", "consumo", "autonomia", "aceleracao", "ficha"].includes(topic),
  );
  return needsHint ? `${text} ${CLOSING}` : text;
}

/**
 * Resposta direta a perguntas simples de ficha técnica, só com dado da base.
 * Devolve null quando a pergunta não é simples (comparação, segurança,
 * manutenção…) ou quando falta dado: aí quem responde é o modelo.
 */
export function directSpecReply(
  topics: SpecTopic[],
  entries: NamedSpec[],
  message: string,
): string | null {
  return buildSpecReply(topics, entries, message, DIRECT_SPEC_TOPICS);
}

/** Reserva sem o modelo de linguagem: também cobre segurança, manutenção, dimensões, motor e ficha. */
export function fallbackSpecReply(
  topics: SpecTopic[],
  entries: NamedSpec[],
  message: string,
): string | null {
  return buildSpecReply(topics, entries, message, [...DIRECT_SPEC_TOPICS, ...EXTENDED_SPEC_TOPICS]);
}

/* ---------- Ranking (usado como reserva sem o modelo de linguagem) ---------- */

/** `forca` = "mais forte" na fala do povo: potência e torque juntos. `potencia` = "mais potente"/cv. */
export type SpecCriterion = "potencia" | "forca" | "economia" | "espaco" | "aceleracao" | "torque";

export function specCriterionFromMessage(message: string): SpecCriterion | null {
  const text = FOLD(message);
  if (/\b(gasta menos|consome menos|bebe menos|mais economic\w+|economico|economica)\b/.test(text)) return "economia";
  if (/\b(mais espacos\w+|porta malas|espaco)\b/.test(text)) return "espaco";
  if (/\b(mais rapido|rapidos|acelera|0 a 100)\b/.test(text)) return "aceleracao";
  if (/\btorque\b/.test(text)) return "torque";
  if (/\b(mais potente|mais potentes|potencia|cavalos|cv)\b/.test(text)) return "potencia";
  if (/\b(mais forte|mais fortes|forte)\b/.test(text)) return "forca";
  return null;
}

function bestCv(spec: VehicleSpec) {
  return Math.max(spec.cv.etanol ?? 0, spec.cv.gasolina ?? 0);
}

function cityEconomy(spec: VehicleSpec) {
  return spec.cidade?.gasolina ?? spec.consumoMoto ?? 0;
}

export function rankSpecs(criterion: SpecCriterion, entries: NamedSpec[]): NamedSpec[] {
  const score = (entry: NamedSpec) => {
    const { spec } = entry;
    switch (criterion) {
      case "potencia":
      case "forca":
        return bestCv(spec);
      case "torque":
        return Math.max(spec.torque.etanol ?? 0, spec.torque.gasolina ?? 0);
      case "economia":
        return cityEconomy(spec);
      case "espaco":
        return spec.portaMalas ?? 0;
      case "aceleracao":
        return spec.zeroACem ? -spec.zeroACem : -999;
    }
  };
  return [...entries].sort((a, b) => score(b) - score(a));
}

/** "120 cv" quando etanol e gasolina são iguais; o par completo quando diferem. */
function pairText(pair: FuelPair, unit: string) {
  return pair.etanol != null && pair.etanol === pair.gasolina
    ? `${num(pair.etanol)} ${unit}`
    : fuelPair(pair, unit);
}

function maxTorque(spec: VehicleSpec) {
  return Math.max(spec.torque.etanol ?? 0, spec.torque.gasolina ?? 0);
}

/** "5.000 rpm (já disponível…)" → 5000. */
function torqueRpmValue(spec: VehicleSpec) {
  const match = /([\d.]+)\s*rpm/.exec(spec.torqueRpm ?? "");
  return match ? Number(match[1]!.replace(/\./g, "")) : null;
}

/**
 * "Qual o mais forte?" olhando potência E torque juntos, sem se contradizer: quando quem tem mais cv
 * não tem mais torque (ex.: HB20 1.6 aspirado × HB20S turbo), a resposta diz que depende, e por quê.
 * `ranked` já vem ordenado por potência. Devolve null quando um mesmo carro lidera os dois critérios.
 */
export function powerTorqueReply(ranked: NamedSpec[]): string | null {
  if (ranked.length < 2) return null;
  const power = ranked[0]!;
  const byTorque = [...ranked].sort((a, b) => maxTorque(b.spec) - maxTorque(a.spec));
  const torquer = byTorque[0]!;
  if (torquer === power || maxTorque(torquer.spec) <= maxTorque(power.spec)) return null;
  const cvPower = bestCv(power.spec);
  const cvTorquer = bestCv(torquer.spec);
  const rpmPower = torqueRpmValue(power.spec);
  const rpmTorquer = torqueRpmValue(torquer.spec);
  const rpmPowerText = power.spec.torqueRpm?.replace(/\s*\(.*\)\s*$/, "");
  const rpmTorquerText = torquer.spec.torqueRpm?.replace(/\s*\(.*\)\s*$/, "");
  // "Bem mais cedo" só quando a diferença de giro é grande; pequena vira "um pouco mais cedo".
  const earlier =
    rpmPower != null && rpmTorquer != null && rpmTorquer < rpmPower
      ? rpmTorquer <= rpmPower * 0.6
        ? ", bem mais cedo"
        : ", um pouco mais cedo"
      : "";
  const slightly = cvTorquer >= cvPower * 0.9 ? "só um pouco menos, " : "";
  const first =
    `Depende do que você chama de forte. Em potência máxima, ${power.spec.artigo} ${power.nome} leva: ` +
    `${pairText(power.spec.cv, "cv")}, mas o torque dele (${pairText(power.spec.torque, "kgfm")}) ` +
    `${rpmPowerText ? `só aparece em giro alto, a ${rpmPowerText}` : "vem em giro mais alto"}.`;
  const second =
    ` ${cap(torquer.spec.artigo)} ${torquer.nome} tem ${pairText(torquer.spec.cv, "cv")}, ${slightly}` +
    `e entrega ${pairText(torquer.spec.torque, "kgfm")}${rpmTorquerText ? ` a ${rpmTorquerText}` : ""}` +
    `${earlier}: é o que responde melhor em retomada e ultrapassagem.`;
  const others = ranked
    .filter((entry) => entry !== power && entry !== torquer)
    .slice(0, 2)
    .map((entry) => `${entry.spec.artigo} ${entry.nome} tem ${pairText(entry.spec.cv, "cv")}`);
  const rest = others.length ? ` Já ${others.join("; ")}.` : "";
  const summary = ` Resumindo: potência de pico, ${power.nome}; força logo ao pisar no acelerador, ${torquer.nome}.`;
  return `${first}${second}${rest}${summary} ${CLOSING}`;
}

function cap(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Resposta de reserva para "qual o mais forte/econômico…" com as fichas da conversa. */
export function rankingSpecReply(criterion: SpecCriterion, entries: NamedSpec[]): string | null {
  const ranked = rankSpecs(criterion, entries);
  if (ranked.length < 2) return null;
  if (criterion === "forca") {
    // Potência e torque juntos; se o mesmo carro lidera os dois, vale a resposta de potência.
    return powerTorqueReply(ranked) ?? rankingSpecReply("potencia", entries);
  }
  const top = ranked[0]!;
  const others = ranked.slice(1);
  const describe = (entry: NamedSpec) => {
    const { spec } = entry;
    switch (criterion) {
      case "potencia": {
        const power = fuelPair(spec.cv, "cv");
        return power ? `${spec.artigo} ${entry.nome} (${power})` : null;
      }
      case "torque": {
        const torque = fuelPair(spec.torque, "kgfm");
        return torque ? `${spec.artigo} ${entry.nome} (${torque})` : null;
      }
      case "economia": {
        const city = spec.cidade?.gasolina ?? spec.consumoMoto;
        return city ? `${spec.artigo} ${entry.nome} (cerca de ${num(city)} km/l na cidade, na gasolina)` : null;
      }
      case "espaco":
        return spec.portaMalas ? `${spec.artigo} ${entry.nome} (${num(spec.portaMalas)} L de porta-malas)` : null;
      case "aceleracao":
        return spec.zeroACem ? `${spec.artigo} ${entry.nome} (0 a 100 em cerca de ${num(spec.zeroACem)} s)` : null;
    }
  };
  const lead = describe(top);
  if (!lead) return null;
  const rest = others.slice(0, 3).map(describe).filter(Boolean);
  const label =
    criterion === "potencia"
      ? "mais forte em potência"
      : criterion === "torque"
        ? "com mais torque"
        : criterion === "economia"
          ? "mais econômico"
          : criterion === "espaco"
            ? "mais espaçoso"
            : "mais rápido";
  const tail = rest.length ? ` Pra comparar: ${rest.join("; ")}.` : "";
  // Potência não é tudo: o turbo costuma ganhar em torque e retomada.
  let nuance = "";
  if (criterion === "potencia") {
    const topTorque = Math.max(top.spec.torque.etanol ?? 0, top.spec.torque.gasolina ?? 0);
    const torquer = ranked
      .slice(1)
      .find((entry) => Math.max(entry.spec.torque.etanol ?? 0, entry.spec.torque.gasolina ?? 0) > topTorque);
    if (torquer) {
      const value = Math.max(torquer.spec.torque.etanol ?? 0, torquer.spec.torque.gasolina ?? 0);
      nuance = ` Em torque, porém, ${torquer.spec.artigo} ${torquer.nome} leva: ${num(value)} kgfm contra ${num(topTorque)} kgfm.`;
    }
  }
  return `Entre esses, ${lead} é o ${label}.${tail}${nuance} ${CLOSING}`;
}
