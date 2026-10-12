/**
 * Perguntas de conversa sobre UM carro citado: opinião, desempenho, economia,
 * confiabilidade, "vale a pena?" e pontos positivos.
 *
 * Regras do Lucas (11/10/2026):
 * - resposta direta, positiva e honesta, nunca com frase de busca ("Separei 1 opção…");
 * - números técnicos só da ficha técnica de referência da versão (`chat-specs`);
 *   sem ficha, fala do carro sem número;
 * - equipamento só da ficha do anúncio; câmbio sempre o da ficha da unidade;
 * - pontos positivos em listinha de 4 a 6 linhas curtas, variando por tipo de carro;
 * - "e do X?" herda a pergunta anterior.
 */
import type { ChatTurn } from "@/lib/chat-gemini";
import { vehicleBodyStyle } from "@/lib/chat-prompt";
import { parseChatDisplacementFilter } from "@/lib/chat-search-filters";
import { findVehicleSpec, type VehicleSpec } from "@/lib/chat-specs";
import { mentionedModelPools, type ChatVehicleRecord } from "@/lib/chat-stock";
import { formatModelName } from "@/lib/format";

export type OpinionKind = "pontos" | "valeapena" | "desempenho" | "economia" | "confiavel";

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.,/ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const PONTOS =
  /\b(pontos? (?:positiv\w*|fort\w*|bo\w*)|vantage\w*|beneficios|qualidades|por ?que (?:eu )?(?:compra\w*|lev\w*|escolh\w*|peg\w*|fic\w* com)|(?:o )?que (?:\w+ ){0,4}tem de bom|lado (?:bom|positivo)|destaques? (?:dele|dela|desse|dessa))\b/;
const VALE =
  /\b(vale a pena|vale\b(?= ?$| ?\?)|co[nm]pensa|e (?:um |uma )?bo[ma](?: (?:carro|moto|compra|opcao|escolha|negocio))?(?! de)\b|bom memo|bom mesmo|boa mesmo|e top|presta\b|recomenda\w*|indica (?:ele|ela|esse|essa)|boa compra|bom negocio|faz sentido)\b/;
const DESEMPENHO =
  /\b(rapid\w*|ligeir\w*|espert[oa]|anda (?:bem|muito|mto|legal|bastante|forte|mais)|anda\b(?= ?$| ?\?)|corre\w*|desempenho|performance|da conta|e fort[ea]|tem forca|e (?:(?:muito|mto|mt|bem|tao) )?frac[oa]|fraquinh\w*|potente|brab\w*|arranca\w*|retomada|bo[ma] de estrada|pra estrada|para estrada|na estrada|de estrada|ultrapass\w*|serra|subida|subi|subir|morro)\b/;
const ECONOMIA =
  /\b(economic[oa]|(?:gasta|bebe|consome)(?: (?:muito|mto|mt|pouco|pouca|bastante|demais|tanto)\b|(?= ?$| ?\?))|beberr\w*|consumo (?:e )?bom|economiza\w*)/;
const CONFIAVEL =
  /\b(confiav\w*|confiabilidade|da (?:(?:muito|mto|mt) )?(?:problema|pobrema|defeito|dor de cabeca)\w*|dao (?:problema|defeito)\w*|defeitos?|pobrema|dor de cabeca|sobre a manutenc\w*|quebra\w*|e dur[oa]|durav\w*|durabilidade|resistente|caro de manter|barato de manter|cara de manter|barata de manter)\b/;
const COST = /\b(manutenc\w*|pecas?|revis\w*)\b.*\b(cara|caras|caro|caros|barat\w*|preco)\b|\b(cara|caro)\b.*\bmanutenc\w*/;

/** Pedido de lista ou de número exato: continua com a busca / ficha técnica de sempre. */
function isListOrNumber(text: string) {
  return (
    /\b(quais|tem (?:algum|alguma|carro|carros|moto|motos|suv)|carros|motos|veiculos|opcoes|me mostra|mostre|quero ver|ate \d+|mil\b|estoque)\b/.test(text) ||
    /\b(quantos? (?:cv|cavalos|km|kgfm|litros|segundos)|0 a 100|km\/l|km por litro|ficha tecnica|torque)\b/.test(text)
  );
}

/** "qual desses é o mais potente?", "o Civic é melhor que o Kicks?": comparação, fica com o fluxo de comparação. */
const COMPARATIVE =
  /\b(qual (?:desses|dessas|deles|delas|dos|das|e o mais|e a mais|o mais|a mais|e melhor|o melhor|vale mais)|desses|dessas|deles|delas|os dois|as duas|entre (?:os|as|eles|elas)|(?:o|a) mais \w+|melhor que|pior que|do que)\b/;

/** Que tipo de pergunta de conversa é (pode ser mais de um: "anda bem e é econômico?"). */
export function opinionKinds(message: string): OpinionKind[] {
  const text = fold(message);
  if (COMPARATIVE.test(text)) return [];
  // "quais os pontos positivos dele?" é conversa, não lista.
  if (!text || (isListOrNumber(text) && !(PONTOS.test(text) && !/\b(carros|motos|veiculos|opcoes|estoque)\b/.test(text)))) return [];
  const kinds: OpinionKind[] = [];
  if (PONTOS.test(text)) kinds.push("pontos");
  if (VALE.test(text)) kinds.push("valeapena");
  if (DESEMPENHO.test(text)) kinds.push("desempenho");
  if (ECONOMIA.test(text)) kinds.push("economia");
  if (CONFIAVEL.test(text) || COST.test(text)) kinds.push("confiavel");
  return kinds;
}

/** "e do hb20 1.0?", "e o civic?": continuação curta que herda a pergunta anterior. */
function isContinuation(message: string) {
  return /^(?:e|ee|e ai|e quanto|e sobre)(?: (?:o|a|do|da|no|na|ao|quanto ao|quanto a|sobre o|sobre a))?\b/.test(fold(message)) && fold(message).split(" ").length <= 7;
}

function narrow(pool: ChatVehicleRecord[], message: string) {
  let units = pool;
  const liters = parseChatDisplacementFilter(message);
  if (liters != null) {
    const hit = units.filter((vehicle) => {
      const spec = findVehicleSpec(vehicle);
      const text = fold(`${vehicle.version ?? ""} ${vehicle.engine ?? ""} ${spec?.motor ?? ""}`);
      return text.includes(liters.toFixed(1));
    });
    if (hit.length) units = hit;
  }
  const years = (message.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(Number);
  if (years.length) {
    const hit = units.filter((vehicle) => years.includes(vehicle.yearModel));
    if (hit.length) units = hit;
  }
  const words = new Set(fold(message).split(" "));
  const trims = units.filter((vehicle) => fold(vehicle.version ?? "").split(" ").some((token) => token.length >= 3 && /[a-z]/.test(token) && words.has(token) && !/^(flex|automatico|manual|completo)$/.test(token)));
  if (trims.length) units = trims;
  return units;
}

/**
 * De qual carro a pessoa fala: o citado agora (afinado por motor, ano, versão),
 * o carro da página, ou o único card mostrado antes. Dois modelos = comparação (fica de fora).
 */
export function opinionSubject(input: {
  message: string;
  stock: ChatVehicleRecord[];
  activeVehicle?: ChatVehicleRecord;
  previousVehicleIds?: string[];
}): ChatVehicleRecord[] {
  const pools = mentionedModelPools(input.stock, input.message);
  if (pools.length >= 2) return [];
  if (pools.length === 1) {
    const units = narrow(pools[0]!, input.message);
    // Na página de uma unidade do modelo citado ("dessa biz", "esse civic"), a conversa é sobre ela.
    const active = input.activeVehicle;
    if (active && units.some((vehicle) => vehicle.id === active.id)) return [active];
    // Irmão de família com nome mais longo ("BIZ 125" na página, "dessa biz" na pergunta): vale a página.
    const family = (vehicle: ChatVehicleRecord) => fold(vehicle.model).split(" ")[0];
    if (active && family(active) === family(units[0]!) && !/\d/.test(fold(input.message))) return [active];
    return units.slice(0, 2);
  }
  if (input.activeVehicle) return [input.activeVehicle];
  const previous = (input.previousVehicleIds ?? [])
    .map((id) => input.stock.find((vehicle) => vehicle.id === id))
    .filter((vehicle): vehicle is ChatVehicleRecord => Boolean(vehicle));
  return previous.length === 1 ? previous : [];
}

/** Pergunta de conversa sobre um carro: tipos + carro(s). Null quando não é o caso. */
export function planOpinionTurn(input: {
  message: string;
  historico: ChatTurn[];
  stock: ChatVehicleRecord[];
  activeVehicle?: ChatVehicleRecord;
  previousVehicleIds?: string[];
}) {
  let kinds = opinionKinds(input.message);
  if (!kinds.length && isContinuation(input.message)) {
    const lastUser = [...input.historico].reverse().find((turn) => turn.role === "user")?.content ?? "";
    kinds = opinionKinds(lastUser);
    if (!kinds.length) return null;
    // "e do X?" precisa citar um carro de verdade.
    if (!mentionedModelPools(input.stock, input.message).length) return null;
  }
  if (!kinds.length) return null;
  const units = opinionSubject(input);
  if (!units.length) return null;
  return { kinds, units };
}

/* ---------- Texto ---------- */

const num = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const isMoto = (vehicle: ChatVehicleRecord) => (vehicle.category ?? "carro") === "moto";

function gearOf(vehicle: ChatVehicleRecord): "auto" | "cvt" | "semi" | "manual" {
  const text = fold(`${vehicle.transmission ?? ""} ${vehicle.version ?? ""}`);
  if (/semi/.test(text)) return "semi";
  if (/\b(cvt|xtronic)\b/.test(text)) return "cvt";
  if (/automatic|automatizad/.test(fold(vehicle.transmission ?? ""))) return "auto";
  return "manual";
}

function engineLabel(vehicle: ChatVehicleRecord, spec: VehicleSpec | null) {
  const source = `${spec?.motor ?? ""} ${vehicle.engine ?? ""} ${vehicle.version ?? ""}`;
  const liters = source.match(/\b([1-6])[.,](\d)\b/);
  const turbo = /turbo|tsi|tgdi|\btb\b/i.test(source);
  return liters ? `${liters[1]}.${liters[2]}${turbo ? " turbo" : ""}` : turbo ? "turbo" : "";
}

/** Nome falado: "HB20 1.6", "Civic 2.0", "Biz 125", "Palio Weekend 1.8". */
export function opinionName(vehicle: ChatVehicleRecord, spec = findVehicleSpec(vehicle)) {
  const model = formatModelName(vehicle.model).replace(/\bHr-V\b/i, "HR-V").replace(/\bKa\b/, "Ka").replace(/\bCg\b/, "CG");
  if (isMoto(vehicle)) return model;
  const engine = engineLabel(vehicle, spec);
  const pretty = /^(hb20s?|hr-v|ka sedan|ka)$/i.test(model) ? model.toUpperCase().replace("KA SEDAN", "Ka Sedan").replace(/^KA$/, "Ka") : model;
  return engine && !model.includes(engine) ? `${pretty} ${engine}` : pretty;
}

export function article(vehicle: ChatVehicleRecord, spec: VehicleSpec | null = findVehicleSpec(vehicle)) {
  return isMoto(vehicle) ? "a" : (spec?.artigo ?? "o");
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Power = { cv: number; fuel: string; level: 1 | 2 | 3 | 4; approx: string };

function powerOf(spec: VehicleSpec | null): Power | null {
  if (!spec) return null;
  const cv = spec.cv.etanol ?? spec.cv.gasolina;
  if (cv == null) return null;
  const fuel = spec.cv.etanol != null && spec.combustivel === "flex" && spec.cv.etanol !== spec.cv.gasolina ? " no etanol" : "";
  const approx = spec.aprox ? "cerca de " : "";
  if (spec.moto || !spec.peso) return { cv, fuel, level: cv >= 14 ? 2 : 3, approx };
  const ratio = spec.peso / cv;
  const level = ratio <= 9.6 ? 1 : ratio <= 11 ? 2 : ratio <= 13.5 ? 3 : 4;
  return { cv, fuel, level, approx };
}

function gearSentence(vehicle: ChatVehicleRecord, level: number, withGear = true) {
  if (!withGear) return "";
  switch (gearOf(vehicle)) {
    case "auto":
      return `E ${isMoto(vehicle) ? "essa" : "esse"} é automático, mais confortável no dia a dia.`;
    case "cvt":
      return "E o câmbio CVT deixa tudo bem suave no trânsito.";
    case "semi":
      return "E o câmbio semiautomático dispensa a embreagem no trânsito.";
    default:
      return isMoto(vehicle) ? "" : level >= 3 ? "Com o câmbio manual, você escolhe a marcha certa na hora de ultrapassar." : "E o câmbio manual dá bastante controle na estrada.";
  }
}

function performanceReply(vehicle: ChatVehicleRecord, message: string, withGear = true) {
  const spec = findVehicleSpec(vehicle);
  const name = opinionName(vehicle, spec);
  const o = article(vehicle, spec);
  const power = powerOf(spec);
  const text = fold(message);
  const asksWeak = /\bfrac[oa]|fraquinh/.test(text);
  if (isMoto(vehicle)) {
    const base = power
      ? `${cap(o)} ${name} tem ${power.approx}${num(power.cv)} cv${power.fuel}: é ágil no trânsito e, na estrada, viaja tranquila em velocidade de cruzeiro.`
      : `${cap(o)} ${name} é ágil no trânsito e econômica no dia a dia.`;
    return `${asksWeak ? "Fraca não!" : "Anda bem, sim!"} ${base} ${gearSentence(vehicle, 2, withGear)}`.trim();
  }
  if (!power) {
    const engine = engineLabel(vehicle, spec);
    return `Anda bem, sim! ${cap(o)} ${name}${engine ? ` tem motor ${engine}` : ""} com boa disposição pro dia a dia. ${gearSentence(vehicle, 2, withGear)} Os números de fábrica dessa versão o consultor confirma.`.replace(/\s+/g, " ").trim();
  }
  const light = spec?.peso && spec.peso <= 1100 ? " num carro leve" : "";
  const turbo = /turbo/i.test(spec?.motor ?? "") ? " O motor turbo entrega força logo em baixa rotação." : "";
  const zero = spec?.zeroACem && power.level <= 2 ? ` Faz o 0 a 100 em cerca de ${num(spec.zeroACem)} s.` : "";
  const cvText = `${power.approx}${num(power.cv)} cv${power.fuel}${light}`;
  const lead = asksWeak
    ? power.level <= 2 ? "Fraco nada!" : "Fraco não, pro que ele se propõe!"
    : ["Sim!", "Anda bem, sim!", "Anda bem pro dia a dia!", "Ele é mais focado em economia do que em velocidade:"][power.level - 1];
  const body = [
    `${cap(o)} ${name} tem ${cvText}, então é bem esperto na cidade e na estrada.`,
    `${cap(o)} ${name} tem ${cvText}, com fôlego de sobra pro dia a dia e boa disposição na estrada.`,
    `${cap(o)} ${name} tem ${cvText}: é ágil na cidade e vai bem na estrada, só pedindo um pouco de planejamento nas ultrapassagens com o carro cheio.`,
    `${o} ${name} tem ${cvText}, então é ágil na cidade e, na estrada, viaja bem em ritmo tranquilo, planejando as ultrapassagens.`,
  ][power.level - 1]!;
  return `${lead} ${body}${turbo}${zero} ${gearSentence(vehicle, power.level, withGear)}`.replace(/\s+/g, " ").trim();
}

function economyReply(vehicle: ChatVehicleRecord, message: string, withGear = true) {
  const spec = findVehicleSpec(vehicle);
  const name = opinionName(vehicle, spec);
  const o = article(vehicle, spec);
  const asksSpend = /\b(gasta|bebe|beberr|consome)/.test(fold(message));
  if (spec?.consumoMoto) {
    return `${asksSpend ? "Gasta pouquinho!" : "Muito!"} ${cap(o)} ${name} faz na casa dos ${num(spec.consumoMoto)} km/l, e a manutenção é simples e barata.`;
  }
  const city = spec?.cidade?.gasolina;
  const road = spec?.estrada?.gasolina;
  if (!spec || city == null || road == null) {
    return `${cap(o)} ${name} tem consumo coerente com o motor dele. Os números do Inmetro dessa versão o consultor confirma com você.`;
  }
  const etanol = spec.cidade?.etanol != null && spec.estrada?.etanol != null ? ` (no etanol, ${num(spec.cidade.etanol)} e ${num(spec.estrada.etanol)} km/l)` : "";
  const level = city >= 12.5 ? 1 : city >= 10.8 ? 2 : city >= 10 ? 3 : 4;
  const lead = asksSpend
    ? ["Não, gasta pouco!", "Não, é econômico pro porte!", "Gasta o normal pro motor que tem.", "Gasta um pouco mais, porque o foco dele é desempenho e conforto."][level - 1]
    : ["É econômico, sim!", "É, sim! Bem econômico pro porte.", "É bem razoável no consumo pro motor que tem.", "O foco dele é desempenho e conforto, mas o consumo é coerente com o motor."][level - 1];
  const cvt = withGear && gearOf(vehicle) === "cvt" ? " E o câmbio CVT ajuda a economizar na cidade." : "";
  // Gasta mais: puxa para o lado bom do carro, sem esconder o número.
  const favor = level >= 3 && spec.manutencao ? ` A favor dele: ${spec.manutencao}.` : "";
  return `${lead} Pelo Inmetro, ${o} ${name} faz cerca de ${num(city)} km/l na cidade e ${num(road)} km/l na estrada com gasolina${etanol}.${cvt}${favor}`;
}

function reliabilityReply(vehicle: ChatVehicleRecord, message: string) {
  const spec = findVehicleSpec(vehicle);
  const name = opinionName(vehicle, spec);
  const o = article(vehicle, spec);
  const folded = fold(message);
  // Polaridade: "é confiável?" → "É, sim"; "dá problema/defeito?" ou "e a duster?" → nunca "É, sim".
  const lead = COST.test(folded) || /\bmanutenc/.test(folded)
    ? "A manutenção é tranquila"
    : /\b(confiav\w*|confiabilidade|durav\w*|e dur[oa]|resistente)\b/.test(folded) && !/\b(problema|pobrema|defeito|dor de cabeca|quebra\w*)/.test(folded)
      ? "É, sim"
      : "Pode ficar tranquilo";
  const gearbox = /\b(cambio|cvt|transmissao)\b/.test(folded);
  const fact = spec?.manutencao
    ? `${lead}: ${o} ${name} tem ${spec.manutencao.replace(/^(?:uma das|motor|mecanica|mecânica)/i, (m) => m.toLowerCase())}.`
    : `${cap(o)} ${name} é um modelo bem conhecido pelas oficinas.`;
  return `${fact} ${gearbox ? "O estado do câmbio e as revisões desta unidade" : "O estado e as revisões desta unidade"} o consultor mostra pra você no WhatsApp.`.replace("tem uma das", "é uma das").replace(/tem (câmbio|cambio)/, "usa $1");
}

/* ---------- Pontos positivos ---------- */

const ITEM_PRIORITY: Array<[RegExp, string]> = [
  [/carplay|android auto/, "CarPlay/Android Auto"],
  [/multimidia|media ?nav|central/, "multimídia"],
  [/camera/, "câmera de ré"],
  [/bancos?.{0,25}couro|couro.{0,12}bancos?/, "bancos de couro"],
  [/teto solar/, "teto solar"],
  [/chave presencial|keyless|partida (?:no|por) botao|smart key/, "chave presencial"],
  [/paddle|borboleta/, "troca de marchas no volante"],
  [/piloto automatico|cruise/, "piloto automático"],
  [/sensor(?:es)? de (?:estacionamento|re)|sensor traseiro/, "sensor de estacionamento"],
  [/ar[- ]condicionado digital|digital automatico|climatiz/, "ar digital"],
  [/air ?bags? (?:laterais|de cortina)|6 air ?bags|seis air ?bags/, "airbags laterais"],
  [/controle de (?:estabilidade|tracao)/, "controle de estabilidade"],
  [/rodas? de liga/, "rodas de liga leve"],
  [/painel digital/, "painel digital"],
  [/freios? (?:cbs|combinad)|\bcbs\b/, "freio combinado (CBS)"],
  [/partida eletrica/, "partida elétrica"],
  [/injecao eletronica/, "injeção eletrônica"],
  [/ar[- ]condicionado/, "ar-condicionado"],
  [/direcao eletrica/, "direção elétrica"],
  [/direcao hidraulica/, "direção hidráulica"],
  [/\babs\b/, "freios ABS"],
  [/vidros? eletric/, "vidros elétricos"],
];

/** Até 3 destaques da ficha do anúncio (nunca da base genérica). */
export function fichaHighlights(vehicle: ChatVehicleRecord, max = 3) {
  const items = (vehicle.accessories ?? []).map((item) => fold(item));
  const out: string[] = [];
  for (const [pattern, label] of ITEM_PRIORITY) {
    if (out.length >= max) break;
    if (items.some((item) => pattern.test(item)) && !out.includes(label)) out.push(label);
  }
  return out;
}

const join = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`);

/** 4 a 6 pontos curtos, adaptados ao tipo de carro. */
export function positivePoints(vehicle: ChatVehicleRecord): Array<[string, string]> {
  const spec = findVehicleSpec(vehicle);
  const power = powerOf(spec);
  const moto = isMoto(vehicle);
  const body = vehicleBodyStyle(vehicle);
  const engine = engineLabel(vehicle, spec);
  const points: Record<string, [string, string] | null> = {};
  const adjective = power ? ["esperto na cidade e na estrada", "disposto no dia a dia", "ágil na cidade", "focado em economia"][power.level - 1] : "boa disposição no dia a dia";
  if (moto) {
    points.motor = power ? ["Motor", `${power.approx}${num(power.cv)} cv, ágil no trânsito`] : null;
  } else {
    points.motor = power ? ["Motor", `${engine ? `${engine} de ` : ""}${power.approx}${num(power.cv)} cv${power.fuel}, ${adjective}`] : engine ? ["Motor", `${engine}, ${adjective}`] : null;
  }
  const gear = gearOf(vehicle);
  points.cambio = ["Câmbio", {
    auto: "automático, confortável no trânsito",
    cvt: "CVT, suave e econômico na cidade",
    semi: "semiautomático, sem embreagem no trânsito",
    manual: moto ? "manual, simples de pilotar" : "manual, simples e barato de manter",
  }[gear]];
  const city = spec?.cidade?.gasolina;
  points.economia = spec?.consumoMoto
    ? ["Economia", `na casa dos ${num(spec.consumoMoto)} km/l`]
    : city != null && city >= 10.8
      ? ["Economia", `cerca de ${num(city)} km/l na cidade (gasolina, Inmetro)`]
      : null;
  const care = spec?.manutencao?.split(/;|, com |, que /)[0]?.trim();
  points.confianca = moto
    ? ["Manutenção", care ? care.replace(/^uma das motos mais /, "das mais ") : "simples e barata"]
    : care ? ["Confiabilidade", care] : null;
  const trunk = spec?.portaMalas ? `${num(spec.portaMalas)} litros` : null;
  points.espaco = moto
    ? ["Praticidade", "leve e fácil de estacionar"]
    : body === "suv"
      ? ["Altura e espaço", `posição de dirigir alta${trunk ? ` e porta-malas de ${trunk}` : ""}`]
      : body === "sedan"
        ? trunk ? ["Porta-malas", `${trunk}, ótimo pra viagem`] : ["Espaço", "sedã com bom espaço pra família"]
        : body === "wagon"
          ? ["Espaço", `perua com porta-malas de ${trunk ?? "bom tamanho"}`]
          : ["Praticidade", "compacto e fácil de estacionar"];
  const highlights = fichaHighlights(vehicle, 3);
  points.itens = highlights.length ? ["Itens da ficha", join(highlights)] : null;
  const order = moto
    ? ["economia", "confianca", "motor", "cambio", "itens", "espaco"]
    : body === "suv" || body === "sedan" || body === "wagon"
      ? ["espaco", "motor", "cambio", "itens", "confianca", "economia"]
      : ["motor", "cambio", "economia", "confianca", "itens", "espaco"];
  return order.map((key) => points[key]).filter((point): point is [string, string] => Boolean(point)).slice(0, 6);
}

function pointsBlock(vehicle: ChatVehicleRecord, limit = 6) {
  return positivePoints(vehicle)
    .slice(0, limit)
    .map(([label, text]) => `• **${label}:** ${text}`)
    .join("\n");
}

function pointsReply(vehicle: ChatVehicleRecord) {
  const spec = findVehicleSpec(vehicle);
  const desse = isMoto(vehicle) ? "dessa" : "desse";
  return `Os pontos fortes ${desse} ${opinionName(vehicle, spec)}:\n${pointsBlock(vehicle)}\n\nQuer ver de perto? O consultor te mostra no WhatsApp.`;
}

function worthReply(vehicle: ChatVehicleRecord) {
  const spec = findVehicleSpec(vehicle);
  const desse = isMoto(vehicle) ? "dessa" : "desse";
  return `Vale a pena, sim! Os destaques ${desse} ${opinionName(vehicle, spec)}:\n${pointsBlock(vehicle, 4)}`;
}

/** Resposta da conversa (texto + carros do card). */
export function opinionReply(plan: { kinds: OpinionKind[]; units: ChatVehicleRecord[] }, message: string) {
  const units = plan.units.slice(0, 2);
  const kinds = plan.kinds;
  if (kinds.includes("pontos")) return { reply: pointsReply(units[0]!), vehicles: [units[0]!] };
  if (kinds.includes("valeapena") && !kinds.includes("desempenho") && !kinds.includes("economia")) {
    return { reply: worthReply(units[0]!), vehicles: [units[0]!] };
  }
  // Duas unidades do mesmo modelo (ex.: dois Civic 2.0): um texto só; o câmbio só entra quando é igual nas duas.
  const sameModel = units.length > 1 && units.every((vehicle) => opinionName(vehicle) === opinionName(units[0]!));
  const withGear = !sameModel || units.every((vehicle) => gearOf(vehicle) === gearOf(units[0]!));
  const parts = (sameModel ? units.slice(0, 1) : units).map((vehicle) => {
    const lines: string[] = [];
    if (kinds.includes("desempenho") || kinds.includes("valeapena")) lines.push(performanceReply(vehicle, message, withGear));
    if (kinds.includes("economia")) lines.push(economyReply(vehicle, message, withGear));
    if (kinds.includes("confiavel")) lines.push(reliabilityReply(vehicle, message));
    // Duas perguntas na mesma fala: a segunda sem repetir o "Sim!" de abertura.
    return lines.slice(0, 2).map((line, index) => (index === 0 ? line : line.replace(/^(?:Sim!|É, sim!|Anda bem, sim!)\s*/, ""))).join(" ");
  });
  return { reply: parts.join("\n\n"), vehicles: units };
}
