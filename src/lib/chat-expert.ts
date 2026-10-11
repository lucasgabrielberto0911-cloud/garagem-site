/**
 * Modo especialista do assistente: perguntas técnicas sobre modelos (cv,
 * torque, consumo, autonomia, câmbio, porta-malas, segurança, manutenção…)
 * e comparações. Responde primeiro o que foi perguntado, com a base de fichas
 * (`chat-specs`) e, quando faltar, com o conhecimento do modelo de linguagem.
 *
 * Aqui ficam as decisões puras: de qual(is) carro(s) a pessoa está falando,
 * quais fichas entram no prompt, quando dá para responder direto, quais
 * cards mostrar e a resposta de reserva sem o modelo de linguagem.
 */
import type { ChatTurn } from "@/lib/chat-gemini";
import { matchVehiclesInReply } from "@/lib/chat-cards";
import { parseEngineDisplacementLiters } from "@/lib/chat-consumption";
import {
  CHAT_WHATSAPP_URL,
  parseBodyStyleFilter,
  parsePriceLimit,
} from "@/lib/chat-prompt";
import { parseChatSearchRanges, parseChatDisplacementFilter } from "@/lib/chat-search-filters";
import { isAnaphoricVehicleFollowUp } from "@/lib/chat-text";
import {
  asksForTurbo,
  mentionedModelPools,
  parseTransmissionFilter,
  type ChatVehicleRecord,
} from "@/lib/chat-stock";
import {
  CHAT_SPEC_BASE_NOTE,
  VEHICLE_SPECS,
  detectSpecTopics,
  directSpecReply,
  fallbackSpecReply,
  findVehicleSpec,
  formatSpecCompact,
  formatSpecForPrompt,
  rankingSpecReply,
  rankSpecs,
  specCriterionFromMessage,
  type NamedSpec,
  type SpecTopic,
  type VehicleSpec,
} from "@/lib/chat-specs";

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Compactar a partir de quantas fichas no mesmo prompt. */
const FULL_SHEET_LIMIT = 4;

/**
 * O visitante está falando do veículo DELE na troca ("tenho um Gol 2014 com
 * 120 mil km, serve na troca?"). Nada aqui é pergunta sobre o carro do estoque.
 */
export function isTradeInMessage(message: string) {
  const text = fold(message);
  const trade = /\b(troca|trocar|trocando|trocaria|na troca|dar de entrada|dar na troca|entra na troca|entrar na troca|dar como entrada)\b/.test(text);
  const owns = /\b(tenho|tinha|meu|minha|meus|minhas|possuo|o meu|a minha)\b/.test(text);
  return trade && owns;
}

export type ExpertContext = {
  mensagem: string;
  /** Mensagem com o recorte já dito na conversa (orçamento, câmbio…); decide se é pedido de lista. */
  recorte?: string;
  historico: ChatTurn[];
  stock: ChatVehicleRecord[];
  activeVehicle?: ChatVehicleRecord;
  /** Recorte do estoque que vai no prompt; limita as fichas quando a conversa não fixa um carro. */
  promptStock?: ChatVehicleRecord[];
};

export type ExpertSubject = {
  vehicles: ChatVehicleRecord[];
  /** `stock`: pergunta de ranking sem carro fixo; compara o estoque. `outside`: modelo citado que não está no estoque. */
  source: "named" | "active" | "context" | "stock" | "outside" | "none";
  /** Fichas de modelos citados que a base conhece mas o estoque não tem. */
  specs?: VehicleSpec[];
  /** Anúncios do modelo citado que NÃO batem com o ano/motor pedido. */
  unmatched?: ChatVehicleRecord[];
  /** Modelos citados que não estão no estoque nem na base (ex.: “onix”). */
  outside?: string[];
};

/** Fichas da base cujos modelos aparecem no texto (ex.: “e o Corolla?”), mesmo fora do estoque. */
export function specsMentioned(message: string): VehicleSpec[] {
  const text = fold(message);
  const years = [...new Set(message.match(/\b(?:19|20)\d{2}\b/g) ?? [])].map(Number);
  let found = VEHICLE_SPECS.filter(
    (spec) => spec.model.test(text) && !spec.not?.test(text),
  );
  if (years.length) {
    const byYear = found.filter((spec) => years.some((y) => y >= spec.anos[0] && y <= spec.anos[1]));
    if (byYear.length) found = byYear;
  }
  return found.slice(0, 3);
}

/** Palavras que seguem “do/da/com o…” sem ser um modelo de carro. */
const NOT_A_MODEL = new Set(
  (
    "carro carros veiculo veiculos modelo modelos motor motores anuncio anuncios consumo cambio torque potencia combustivel porta desempenho ficha " +
    "esse essa este esta esses essas estes estas aquele aquela tanque freio freios banco bancos painel meu minha meus minhas seu sua estoque ano km " +
    "preco valor cor estado segundo primeiro outro outra outros outras mesmo mesma ele ela eles elas qual quais quanto quantos quantas que como tem tudo " +
    "mais menos melhor pior seguranca airbag airbags abs manutencao revisao pecas dimensoes tamanho peso autonomia aceleracao marchas cv cvs cavalos hp " +
    "media gasolina etanol alcool flex diesel turbo aspirado automatico automatica manual cvt hatch sedan suv picape perua moto motos garantia troca " +
    "financiamento parcela entrada whatsapp consultor loja voces garagem ar condicionado multimidia lugar dia mes tempo uma um dois tres"
  ).split(" "),
);

const OUTSIDE_PHRASE =
  /\b(?:com o|com a|ou o|ou a|vs|versus|contra o|contra a|do|da|dos|das|sobre o|sobre a|sobre|pelo|pela|e o|e a|tem o|tem a|de um|de uma)\s+([a-z0-9][a-z0-9-]{2,})/g;
const COMPARATIVE_THAN =
  /\b(?:melhor|pior|maior|menor|mais|menos|igual|parecido|diferente)\s+(?:\w+\s+)?(?:que|do que|de que)\s+(?:o|a)\s+([a-z0-9][a-z0-9-]{2,})/g;
const CAPITALIZED_MODEL =
  /\b(?:o|a|do|da|um|uma|com o|com a|ou o|ou a|vs|versus)\s+([A-Z][A-Za-z0-9-]{2,})/g;

/**
 * Modelos que a pessoa citou e que não estão no estoque nem na base de fichas
 * (“o Onix”, “do Taycan”). Heurística: a palavra depois de “do/com o/vs…”.
 */
export function outsideModelCandidates(message: string, stock: ChatVehicleRecord[]): string[] {
  const found: string[] = [];
  const consider = (raw: string) => {
    const token = fold(raw);
    if (!token || /^\d/.test(token) || NOT_A_MODEL.has(token)) return;
    if (mentionedModelPools(stock, token).length) return;
    if (specsMentioned(token).length) return;
    if (!found.includes(token)) found.push(token);
  };
  for (const match of fold(message).matchAll(OUTSIDE_PHRASE)) consider(match[1]!);
  for (const match of fold(message).matchAll(COMPARATIVE_THAN)) consider(match[1]!);
  for (const match of message.matchAll(CAPITALIZED_MODEL)) consider(match[1]!);
  return found;
}


const GENERIC_VERSION_WORD =
  /^(flex|flexone|automatico|automatica|manual|completo|completa|aut|at|mt|turbo|plus|tgdi|tsi|de|do|da|com)$/;

/** Anos pedidos na mensagem; “2013/2014” (fabricação/modelo) vale o segundo. */
function askedYears(message: string) {
  const pairs = message.replace(/\b((?:19|20)\d{2})\s*\/\s*((?:19|20)\d{2})\b/g, "$2");
  return [...new Set(pairs.match(/\b(?:19|20)\d{2}\b/g) ?? [])].map(Number);
}

/**
 * Afina um modelo citado pelo ano, motor ou versão que a pessoa disse. Ano ou
 * motor que o estoque não tem NÃO caem na ficha de outro: devolve vazio.
 */
function narrowNamed(vehicles: ChatVehicleRecord[], message: string) {
  let rows = vehicles;
  const years = askedYears(message);
  if (years.length) rows = rows.filter((v) => years.includes(v.yearModel));
  const liters = parseEngineDisplacementLiters(message, null);
  if (liters != null) {
    rows = rows.filter(
      (v) => parseEngineDisplacementLiters(v.engine, v.version, v.category) === liters,
    );
  }
  // Moto: “biz 125”, “cg 160”. O número do cilindro afina entre Biz 110i e Biz 125.
  const cc = fold(message).match(/\b(50|100|110|125|150|160|200|250|300|400|500|600)\b/)?.[1];
  if (cc && rows.some((v) => v.category === "moto")) {
    rows = rows.filter((v) => new RegExp(`\\b${cc}`).test(fold(`${v.version ?? ""} ${v.engine ?? ""}`)));
  }
  const words = new Set(fold(message).split(" "));
  const markers = new Set(
    rows
      .flatMap((v) => fold(v.version ?? "").split(" "))
      .filter((token) => token.length >= 3 && !GENERIC_VERSION_WORD.test(token) && !/^\d+$/.test(token) && words.has(token)),
  );
  if (markers.size) {
    const byTrim = rows.filter((v) => {
      const own = new Set(fold(v.version ?? "").split(" "));
      return [...markers].every((marker) => own.has(marker));
    });
    if (byTrim.length) rows = byTrim;
  }
  return rows;
}

/** De qual(is) carro(s) do estoque a pergunta técnica está falando. */
export function expertSubject(ctx: ExpertContext): ExpertSubject {
  const named = mentionedModelPools(ctx.stock, ctx.mensagem).flat();
  const outside = outsideModelCandidates(ctx.mensagem, ctx.stock);
  if (named.length) {
    // “Esse HB20…” na ficha de um HB20: é o carro da tela, não a família toda.
    if (
      ctx.activeVehicle &&
      isAnaphoricVehicleFollowUp(ctx.mensagem) &&
      named.some((vehicle) => vehicle.id === ctx.activeVehicle?.id)
    ) {
      return { vehicles: [ctx.activeVehicle], source: "active", outside };
    }
    const rows = narrowNamed(named, ctx.mensagem);
    // Pediu um ano ou motor que o estoque não tem: não responde com a ficha de outro carro.
    if (rows.length === 0) {
      return { vehicles: [], source: "named", unmatched: dedupeById(named), outside };
    }
    // "e de consumo, o Civic?" depois de "o Civic 2020…": com dois Civic no estoque,
    // segue o ano/versão já dito na conversa (ou o carro da tela), sem listar os dois.
    const topicsNow = detectSpecTopics(ctx.mensagem);
    const sameModel = new Set(rows.map((vehicle) => fold(vehicle.model))).size === 1;
    if (rows.length > 1 && sameModel && !topicsNow.includes("ranking") && !topicsNow.includes("comparacao")) {
      const said = ctx.historico.filter((turn) => turn.role === "user").slice(-4).map((turn) => turn.content);
      for (let index = said.length - 1; index >= 0; index -= 1) {
        if (!mentionedModelPools(rows, said[index]!).length) continue;
        const earlier = narrowNamed(rows, said.slice(index).join(" "));
        if (earlier.length >= 1 && earlier.length < rows.length) {
          return { vehicles: dedupeById(earlier), source: "named", outside };
        }
        break;
      }
      const onScreen = rows.find((vehicle) => vehicle.id === ctx.activeVehicle?.id);
      if (onScreen) return { vehicles: [onScreen], source: "named", outside };
    }
    return { vehicles: rows, source: "named", outside };
  }
  const outsideSpecs = specsMentioned(ctx.mensagem);
  if (outsideSpecs.length) return { vehicles: [], source: "outside", specs: outsideSpecs, outside };
  // Citou um modelo que não está no estoque nem na base: nunca responde com o carro aberto.
  if (outside.length) return { vehicles: [], source: "outside", outside };
  const topics = detectSpecTopics(ctx.mensagem);
  const comparing = topics.includes("ranking") || topics.includes("comparacao");
  // “E o torque?”, “o 2020”, “quantos cavalos ela tem?”: segue o modelo dito antes pelo visitante.
  if (!comparing) {
    const userTurns = ctx.historico.filter((turn) => turn.role === "user").slice(-4);
    for (let index = userTurns.length - 1; index >= 0; index -= 1) {
      const previous = mentionedModelPools(ctx.stock, userTurns[index]!.content).flat();
      if (!previous.length) continue;
      // O modelo e as respostas curtas que vieram depois (ano, versão) contam como uma frase só.
      const said = userTurns.slice(index).map((turn) => turn.content).join(" ");
      const rows = narrowNamed(previous, said);
      if (rows.length) return { vehicles: dedupeById(rows), source: "context" };
      break;
    }
  }
  // Veículo em tela responde por "esse", "ele" e por pergunta técnica solta sobre o carro aberto.
  if (ctx.activeVehicle && !comparing) {
    return { vehicles: [ctx.activeVehicle], source: "active" };
  }
  // "qual o mais forte?": os carros que acabaram de aparecer na conversa.
  const recent = [...ctx.historico].reverse().slice(0, 4);
  for (const turn of recent) {
    const found =
      turn.role === "assistant"
        ? matchVehiclesInReply(turn.content, ctx.stock, 5, ctx.activeVehicle?.id)
        : mentionedModelPools(ctx.stock, turn.content).flat();
    if (found.length) {
      const rows = turn.role === "user" ? narrowNamed(found, turn.content) : found;
      if (rows.length) return { vehicles: dedupeById(rows), source: "context" };
    }
  }
  if (ctx.activeVehicle) return { vehicles: [ctx.activeVehicle], source: "active" };
  return { vehicles: [], source: "none" };
}

function dedupeById(rows: ChatVehicleRecord[]) {
  const seen = new Set<string>();
  return rows.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
}

/** Fichas dos carros, uma por modelo/versão, com um nome falado que não se repete. */
export type ExpertEntry = NamedSpec & { vehicle?: ChatVehicleRecord };

export function namedSpecsFor(vehicles: ChatVehicleRecord[], extraSpecs: VehicleSpec[] = []) {
  const entries: ExpertEntry[] = [];
  const missing: ChatVehicleRecord[] = [];
  const seen = new Set<string>();
  for (const vehicle of vehicles) {
    const spec = findVehicleSpec(vehicle);
    if (!spec) {
      missing.push(vehicle);
      continue;
    }
    if (seen.has(spec.id)) continue;
    seen.add(spec.id);
    entries.push({ spec, nome: spec.curto, vehicle });
  }
  for (const spec of extraSpecs) {
    if (seen.has(spec.id)) continue;
    seen.add(spec.id);
    entries.push({ spec, nome: spec.curto });
  }
  // Mesmo nome falado em duas fichas (dois Civic): o ano desfaz a dúvida.
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.nome, (counts.get(entry.nome) ?? 0) + 1);
  for (const entry of entries) {
    if ((counts.get(entry.nome) ?? 0) > 1) {
      entry.nome = `${entry.nome} ${entry.vehicle?.yearModel ?? entry.spec.anos[0]}`;
    }
  }
  return { entries, missing };
}

/** “E o City?” mantém só o assunto técnico imediatamente anterior, sem filtros de busca. */
export function expertQuestion(ctx: ExpertContext) {
  if (mentionedModelPools(ctx.stock, ctx.mensagem).length >= 2 && /\s+x\s+/i.test(ctx.mensagem)) return `comparação ${ctx.mensagem}`;
  if (detectSpecTopics(ctx.mensagem).length || !/^\s*e (?:o|a) .{2,45}[?!., ]*$/i.test(ctx.mensagem)) return ctx.mensagem;
  if (!mentionedModelPools(ctx.stock, ctx.mensagem).length) return ctx.mensagem;
  const previous = ctx.historico.filter(turn => turn.role === "user").at(-1)?.content;
  if (!previous) return ctx.mensagem;
  const topics = detectSpecTopics(previous);
  const labels: Partial<Record<SpecTopic, string>> = {
    cambio: "quantas marchas", consumo: "consumo", autonomia: "autonomia", potencia: "potência",
    torque: "torque", aceleracao: "0 a 100", portamalas: "porta-malas", manutencao: "manutenção",
  };
  return `${topics.map(topic => labels[topic] ?? "").filter(Boolean).join(" e ")} ${ctx.mensagem}`.trim();
}

export type ExpertPlan = {
  topics: SpecTopic[];
  subject: ExpertSubject;
  entries: ExpertEntry[];
  missing: ChatVehicleRecord[];
  stockRanking?: string;
};

/**
 * “Qual o mais forte?” com um carro só (ou nenhum) na conversa compara a
 * família dele no estoque; sem carro nenhum, compara todo o estoque disponível de carros.
 */
function widenForComparison(ctx: ExpertContext, subject: ExpertSubject): ExpertSubject {
  if (subject.vehicles.length >= 2) return subject;
  const family = subject.vehicles.length
    ? mentionedModelPools(
        ctx.stock,
        subject.vehicles.map((vehicle) => vehicle.model).join(" "),
      ).flat()
    : [];
  if (family.length >= 2) return { vehicles: dedupeById(family), source: "context" };
  const pool = ctx.stock.filter(vehicle => vehicle.category !== "moto");
  return { vehicles: pool, source: "stock" };
}

export function planExpertTurn(ctx: ExpertContext): ExpertPlan {
  const question = expertQuestion(ctx);
  const topics = detectSpecTopics(question);
  let subject = expertSubject({ ...ctx, mensagem: question });
  if (
    (topics.includes("ranking") || topics.includes("comparacao")) &&
    subject.source !== "named" &&
    subject.source !== "outside"
  ) {
    subject = widenForComparison(ctx, subject);
  }
  const { entries, missing } = namedSpecsFor(subject.vehicles, subject.specs);
  const criterion = specCriterionFromMessage(question);
  const whole = namedSpecsFor(ctx.stock.filter(vehicle => vehicle.category !== "moto"));
  const global = criterion && topics.includes("ranking") ? rankSpecs(criterion === "forca" ? "potencia" : criterion, whole.entries)[0] : undefined;
  const values = global ? {
    economia: [`${global.spec.cidade?.gasolina ?? global.spec.consumoMoto} km/l na cidade, na gasolina`, "em economia"],
    aceleracao: [`0 a 100 em cerca de ${global.spec.zeroACem} s`, "em aceleração"],
    espaco: [`${global.spec.portaMalas} litros de porta-malas`, "em espaço de porta-malas"],
    torque: [`${Math.max(global.spec.torque.etanol ?? 0, global.spec.torque.gasolina ?? 0)} kgfm`, "em torque"],
    potencia: [`${Math.max(global.spec.cv.etanol ?? 0, global.spec.cv.gasolina ?? 0)} cv${global.spec.cv.etanol != null ? " com etanol" : " na gasolina"}`, "em potência"],
  } : undefined;
  const summary = values && criterion ? values[criterion === "forca" ? "potencia" : criterion] : undefined;
  const stockRanking = global && summary && !summary[0]!.includes("undefined")
    ? `No estoque inteiro, o destaque ${summary[1]} é o ${global.nome}: ${summary[0]!.replace(/(\d)\.(\d)/g, "$1,$2")}.${whole.missing.length ? " Entre os modelos com dados de referência disponíveis." : ""}`
    : undefined;
  return { topics, subject, entries, missing, stockRanking };
}

/** Pedido de lista (“quais automáticos…”, “até 70 mil”): continua sendo busca no estoque. */
function isListRequest(message: string) {
  const text = fold(message);
  // Só filtro de verdade: a palavra “carro” solta (“consumo desse carro?”) não faz lista.
  return (
    (/\b(tem|ha|algum|carros?|veiculos?)\b/.test(text) && (asksForTurbo(message) || parseChatDisplacementFilter(message) != null)) ||
    parsePriceLimit(message) != null ||
    Object.keys(parseChatSearchRanges(message)).length > 0 ||
    parseTransmissionFilter(message) != null ||
    parseBodyStyleFilter(message) != null ||
    /\b(quero|procuro|busco|preciso de|to atras|estou atras|opcoes|me mostra|mostre)\b/.test(text) ||
    /\b(quais|qual)\s+(?:(?:o|os|a|as)\s+)?(automatic[oa]s?|manuais|suvs?|carros|motos)\b/.test(text) ||
    /\b(mostrar|mostra|ver|buscar|procurar|procuro|quero ver)\s+(?:(?:o|os|a|as)\s+)?(automatic[oa]s?|manuais|suvs?|carros|motos)\b/.test(text)
  );
}

/**
 * A pergunta é técnica o bastante para o modo especialista? Pedido de lista
 * com filtro (“SUV forte até 70 mil”) continua sendo busca; modelo nomeado,
 * “esse”/“qual o mais forte?” na conversa e perguntas de ficha entram aqui.
 */
export function wantsExpertAnswer(ctx: ExpertContext) {
  const topics = detectSpecTopics(expertQuestion(ctx));
  if (topics.length === 0) return false;
  const named = mentionedModelPools(ctx.stock, ctx.mensagem);
  // Com duas fichas conhecidas, compara perfis; sem ficha, conserva a comparação dos anúncios.
  if (topics.every((topic) => topic === "comparacao")) {
    return (named.length >= 2 && named.flat().every(vehicle => findVehicleSpec(vehicle))) || named.length === 1 || outsideModelCandidates(ctx.mensagem, ctx.stock).length > 0;
  }
  if (named.length > 0) return true;
  if (/\b(manual ou automatico|automatico ou manual)\b/.test(fold(ctx.mensagem))) return false;
  return !isListRequest(ctx.mensagem);
}

/** A pergunta também quer preço ou km do anúncio (“preço, km e consumo?”). */
export function asksListingFacts(message: string) {
  const text = fold(message).replace(/\bkm l\b/g, " ");
  return /\b(preco|valor|quanto custa|km|quilometragem|rodad[oa]|rodou)\b/.test(text);
}

/** Resposta direta, sem o modelo de linguagem, quando a base cobre a pergunta. */
export function expertDirectReply(plan: ExpertPlan, message: string) {
  if (plan.entries.length === 0) return null;
  if (/\b(bebe muito|consumo alto)\b/.test(fold(message)) && plan.entries.length === 1) {
    const entry = plan.entries[0]!;
    const city = entry.spec.cidade?.gasolina;
    const road = entry.spec.estrada?.gasolina;
    if (city && road) return `Para um ${entry.nome}, a referência na gasolina é cerca de ${String(city).replace(".", ",")} km/l na cidade e ${String(road).replace(".", ",")} km/l na estrada; no trânsito pesado pode gastar mais. A favor dele: ${entry.spec.manutencao}. Se a prioridade for economia, posso comparar outras opções do estoque; o vendedor confirma os detalhes no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }
  if (/\b(problema|defeito|ponto fraco)\b/.test(fold(message))) return null;
  // Algum carro citado sem ficha: o modelo de linguagem completa com cautela.
  if (plan.missing.length > 0) return null;
  return directSpecReply(plan.topics, plan.entries, message);
}

/** Bloco do prompt: regras do modo especialista e as fichas dos carros em conversa. */
export function buildExpertPromptBlock(plan: ExpertPlan) {
  const lines: string[] = [];
  lines.push("MODO ESPECIALISTA (a pergunta é técnica sobre um modelo):");
  lines.push(
    "- Responda PRIMEIRO e direto ao que foi perguntado, como vendedor que entende de carro: 1 a 4 frases faladas, sem lista, sem markdown. Não abra com “No estoque”, contagem de anúncios nem “Achei”. Nada de resposta seca ou de recusa.",
  );
  lines.push(
    "- Dados de fábrica do MODELO (potência, torque, consumo do Inmetro, autonomia, 0 a 100, câmbio e marchas, porta-malas, dimensões, segurança, manutenção típica): use as FICHAS abaixo quando existir a do carro. Se não houver ficha, use o que você conhece do modelo, só com números de que tenha segurança, com “cerca de”; se não tiver segurança, diga com naturalidade que não tem o número exato aí e que o consultor confirma no WhatsApp. Nunca invente.",
  );
  lines.push(
    "- Avise de leve, uma vez só, que pode variar (etanol ou gasolina, versão, ano, jeito de dirigir). Consumo é de teste; na rua muda com trânsito e estado do carro. Autonomia é teórica (tanque × consumo): use o valor já calculado na ficha, sem refazer a conta.",
  );
  lines.push(
    "- NUNCA afirme nada sobre a UNIDADE do estoque: estado, revisões, histórico, dono, laudo, garantia além da política da loja, ou equipamento que não esteja na linha do estoque. Equipamentos da base genérica não comprovam versão e ano exatos; só dados cadastrados ou pesquisa exata confirmada permitem afirmá-los; “esta unidade tem…” só com o que está na linha do estoque. Estado e histórico: consultor. Manutenção: destaque mecânica conhecida e oferta de peças. NÃO traga pontos de atenção, defeitos ou críticas espontaneamente. Só responda a uma crítica quando o visitante perguntar diretamente, com tato e sem mentir. Nunca diga que a unidade tem laudo, garantia de fábrica, revisões feitas, “original”, dono único, ausência de batida/sinistro nem que passou por “conferência de qualidade”: esse dado não está no anúncio e o consultor confirma. Marca sempre a dos dados (o HB20 é Hyundai, o City é Honda).",
  );
  lines.push(
    "- Comparação (“qual o mais forte / que gasta menos / mais espaçoso?”): compare os carros da conversa (os que acabaram de aparecer) usando os números das fichas, aponte quem ganha e por qual critério, e diga a nuance quando houver (ex.: um tem mais cv, o outro mais torque em baixa). Sem inventar critério. Para modelo que não está no estoque (ex.: Onix), compare com o que você conhece dele e diga que no momento não temos esse no estoque.",
  );
  lines.push(
    "- Não despeje a lista do estoque nem repita preço e km se a pergunta não pediu. Nunca mostre preço de carro vendido nem a cidade do veículo. Só convide para o consultor/WhatsApp quando ajudar de verdade.",
  );
  if (plan.entries.length >= 2 && plan.topics.some((topic) => topic === "potencia" || topic === "torque")) {
    // "Qual o mais forte?": potência e torque juntos, já montado a partir das fichas, para não se contradizer.
    const brief = rankingSpecReply("forca", plan.entries);
    if (brief) {
      lines.push(
        "- Para “qual o mais forte?”: olhe potência E torque juntos e não se contradiga (não chame um de mais forte e depois de mais fraco). Se quem tem mais cv não tem mais torque, diga que depende: um leva em potência de pico, o outro entrega o torque mais cedo. Resposta-base montada das fichas (reescreva com suas palavras, mantendo os números): " + brief,
      );
    }
  }
  if (plan.stockRanking) lines.push(`- Além do recorte da conversa, mencione em uma linha este resultado calculado com TODO o estoque: ${plan.stockRanking}`);
  const sheets = plan.entries;
  const sheetLines = sheets.map((entry) =>
    sheets.length > FULL_SHEET_LIMIT
      ? formatSpecCompact(entry.spec, entry.nome)
      : formatSpecForPrompt(entry.spec, entry.nome),
  );
  if (sheetLines.length) {
    lines.push("");
    lines.push(`FICHAS TÉCNICAS DE REFERÊNCIA (${CHAT_SPEC_BASE_NOTE}):`);
    lines.push(...sheetLines);
  }
  if (plan.subject.unmatched?.length) {
    lines.push("");
    lines.push(
      `O visitante pediu uma versão ou ano que o estoque não tem. No estoque desse modelo há só: ${plan.subject.unmatched.map((v) => `${v.brand} ${v.model} ${v.version ?? ""} ${v.yearModel}`.replace(/\s+/g, " ").trim()).join("; ")}. Diga isso com naturalidade, não use a ficha de outra versão como se fosse a pedida, e só dê números da versão pedida se tiver segurança (com “cerca de”); senão, o consultor confirma.`,
    );
  }
  if (plan.subject.outside?.length) {
    lines.push("");
    lines.push(
      `O visitante também citou ${plan.subject.outside.join(", ")}, que não está no estoque e não tem ficha aqui. Responda com o que você conhece desse modelo, só com números de que tenha segurança (com “cerca de”), e diga com naturalidade que esse não está no estoque agora; se não tiver segurança, diga que não tem o dado exato e que o consultor confirma.`,
    );
  } else if (plan.subject.source === "none" && plan.entries.length === 0) {
    lines.push("");
    lines.push(
      "A pergunta não diz de qual carro. Se a mensagem citar algum modelo, mesmo fora do estoque, responda com o que você conhece dele (com cautela). Só se não houver modelo nenhum, pergunte qual (uma pergunta curta e simpática) e ofereça os dados de fábrica.",
    );
  }
  if (plan.missing.length) {
    lines.push("");
    lines.push(
      `Sem ficha na base: ${plan.missing.map((v) => `${v.brand} ${v.model} ${v.version ?? ""} ${v.yearModel}`.replace(/\s+/g, " ").trim()).join("; ")}. Use seu conhecimento do modelo com cautela, ou diga que o consultor confirma.`,
    );
  }
  return `\n\n${lines.join("\n")}`;
}

/** Carros do pool cujo modelo a resposta cita; vários do mesmo modelo se afinam por ano ou versão dita. */
export function vehiclesNamedInReply(reply: string, pool: ChatVehicleRecord[], limit = 3) {
  const text = ` ${fold(reply)} `;
  const picks: ChatVehicleRecord[] = [];
  const byModel = new Map<string, ChatVehicleRecord[]>();
  for (const vehicle of pool) {
    const model = fold(vehicle.model);
    if (model.length < 2 || !text.includes(` ${model} `)) continue;
    byModel.set(model, [...(byModel.get(model) ?? []), vehicle]);
  }
  const ordered = [...byModel.entries()].sort(
    (a, b) => text.indexOf(` ${a[0]} `) - text.indexOf(` ${b[0]} `),
  );
  for (const [model, rows] of ordered) {
    const years = rows.filter((v) => text.includes(` ${v.yearModel} `));
    const trims = rows.filter((v) =>
      fold(v.version ?? "")
        .split(" ")
        .some((token) => token.length >= 3 && !/^\d+$/.test(token) && !GENERIC_VERSION_WORD.test(token) && text.includes(` ${token} `)),
    );
    // “HB20 1.6” na resposta: o motor dito logo depois do nome diferencia HB20 1.6 de HB20 1.0.
    const engines = rows.filter((v) => {
      const liters = parseEngineDisplacementLiters(v.engine, v.version, v.category);
      if (liters == null) return false;
      const token = liters.toFixed(1).replace(".", " ");
      return new RegExp(` ${model} (?:\\w+ )?${token} `).test(text);
    });
    picks.push(...(years.length ? years : trims.length ? trims : engines.length ? engines : rows));
  }
  return dedupeById(picks).slice(0, limit);
}

/** Cards só quando ajudam: o carro do estoque de que se falou, nunca o que já está em tela sozinho. */
export function expertCards(
  reply: string,
  ctx: ExpertContext,
  plan: ExpertPlan,
  limit = 3,
) {
  const comparing = plan.topics.includes("ranking") || plan.topics.includes("comparacao");
  const fromReply = (pool: ChatVehicleRecord[]) =>
    vehiclesNamedInReply(reply, pool, limit);
  let picks: ChatVehicleRecord[] = [];
  if (plan.subject.source === "named" || (plan.subject.source === "context" && !comparing)) {
    // A pergunta nomeou o modelo (ou segue o da conversa): o(s) anúncio(s) dele, afinados por ano/motor/versão.
    picks = plan.subject.vehicles;
  } else if (plan.subject.source !== "active") {
    // Comparação: só os carros que a resposta de fato cita.
    const pool = plan.subject.source === "stock" ? ctx.stock : plan.subject.vehicles.length ? plan.subject.vehicles : ctx.stock;
    picks = fromReply(pool);
  }
  picks = dedupeById(picks).slice(0, limit);
  // Só o carro que a pessoa já está vendo: o card não acrescenta nada.
  if (picks.length === 1 && picks[0]!.id === ctx.activeVehicle?.id) return [];
  return picks;
}

function capitalFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const EXPERT_ASK_MODEL_REPLY =
  "De qual carro você quer saber? Me diz o modelo (e o ano, se souber) que eu passo os dados de fábrica.";

export const EXPERT_UNKNOWN_REPLY =
  `Esse dado eu não tenho aqui com segurança, e prefiro não chutar. O consultor confere certinho com você no WhatsApp: ${CHAT_WHATSAPP_URL}`;

/** Resposta de reserva quando o modelo de linguagem não responde, só com a base. */
export function expertFallbackReply(plan: ExpertPlan, message: string) {
  const direct = expertDirectReply(plan, message) ?? (plan.missing.length === 0 ? fallbackSpecReply(plan.topics, plan.entries, message) : null);
  if (direct) return direct;
  const criterion = specCriterionFromMessage(message);
  if (criterion && plan.entries.length === 1 && plan.stockRanking) {
    const local = directSpecReply([criterion === "economia" ? "consumo" : criterion === "aceleracao" ? "aceleracao" : "potencia"], plan.entries, message);
    if (local) return `${local} ${plan.stockRanking}`;
  }
  if (criterion && plan.entries.length >= 2) {
    const ranked = rankingSpecReply(criterion, plan.entries);
    if (ranked) return `${ranked}${plan.stockRanking && plan.subject.source !== "stock" ? ` ${plan.stockRanking}` : ""}`;
  }
  if (plan.subject.vehicles.length && !plan.subject.outside?.length && plan.entries.length && (plan.topics.includes("pontosfortes") || plan.topics.includes("comparacao"))) {
    return plan.entries.slice(0, 2).map(entry => {
      const spec = entry.spec;
      const year = entry.vehicle ? ` ${entry.vehicle.yearModel}` : "";
      const km = entry.vehicle ? ` (${entry.vehicle.km.toLocaleString("pt-BR")} km na ficha)` : "";
      const city = spec.cidade?.gasolina;
      return `O ${entry.nome}${year}${km} é uma boa escolha para quem busca ${city && city >= 11 ? "economia no dia a dia" : "conforto e espaço"}: ${spec.manutencao}${/CVT/.test(spec.cambio) ? ", com a suavidade do câmbio CVT" : ""}${spec.portaMalas ? ` e porta-malas de referência de ${spec.portaMalas} litros` : ""}.`;
    }).join(" ");
  }
  if (plan.subject.unmatched?.length) {
    const list = plan.subject.unmatched
      .map((v) => `${v.brand} ${v.model} ${v.version ?? ""} ${v.yearModel}`.replace(/\s+/g, " ").trim())
      .join("; ");
    return `Dessa versão eu não tenho o dado aqui com segurança. No estoque tenho: ${list}. Se quiser os dados de fábrica de algum deles, é só pedir; o resto o consultor confere no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }
  if (plan.missing.length > 0 && plan.entries.length === 0) {
    const names = [...new Set(plan.missing.map((v) => `${v.model} ${v.yearModel}`))].join(" e ");
    return `Do ${names} eu não tenho esse dado de fábrica aqui com segurança, e prefiro não chutar. O consultor confere certinho com você no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }
  if (plan.subject.outside?.length) {
    const names = plan.subject.outside.map(capitalFirst).join(" e do ");
    const known =
      plan.entries.length > 0 && plan.entries.length <= 3
        ? directSpecReply(["potencia"], plan.entries, message)
        : null;
    return `Do ${names} eu não tenho nem estoque nem ficha de fábrica aqui, e prefiro não chutar.${known ? ` O que tenho de fábrica dos outros: ${known}` : ""} O consultor te passa o restante certinho no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }
  if (plan.subject.source === "none" && plan.entries.length === 0) return EXPERT_ASK_MODEL_REPLY;
  return EXPERT_UNKNOWN_REPLY;
}
