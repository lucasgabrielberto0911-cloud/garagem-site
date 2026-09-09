import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { formatModelName } from "@/lib/format";
import {
  parseEngineDisplacementLiters,
  typicalConsumptionHint,
  typicalConsumptionRange,
} from "@/lib/chat-consumption";
import {
  CHAT_WHATSAPP_URL,
  formatChatPrice,
  parsePriceLimit,
  type ChatStockLine,
} from "@/lib/chat-prompt";

/** Teto da carga atual. Se o estoque chegar aqui, consultar pela pergunta — não só aumentar o take. */
export const CHAT_STOCK_TAKE = 80;

export function chatStockAtCap(count: number, take = CHAT_STOCK_TAKE) {
  return count >= take;
}

/**
 * Campos públicos do bot. `id` fica só no servidor para amarrar o lead.
 * NUNCA incluir fipePrice (nem placa, compra, custos).
 */
export const CHAT_VEHICLE_SELECT = {
  id: true,
  brand: true,
  model: true,
  version: true,
  yearModel: true,
  km: true,
  price: true,
  color: true,
  transmission: true,
  fuel: true,
  category: true,
  engine: true,
  doors: true,
  accessories: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true, thumbnailUrl: true },
  },
} as const;

export type ChatVehicleRecord = {
  id: string;
  brand: string;
  model: string;
  version: string | null;
  yearModel: number;
  km: number;
  price: number;
  color: string | null;
  transmission: string;
  fuel: string;
  category?: string;
  engine?: string | null;
  doors?: number | null;
  accessories?: string[];
  photos?: Array<{ url: string; thumbnailUrl?: string | null }>;
};

export function toChatStockLine(vehicle: ChatVehicleRecord): ChatStockLine {
  return {
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    year: vehicle.yearModel,
    km: vehicle.km,
    price: vehicle.price,
    color: vehicle.color,
    transmission: vehicle.transmission,
    fuel: vehicle.fuel,
    category: vehicle.category ?? "carro",
    engine: vehicle.engine ?? null,
    doors: vehicle.doors ?? null,
    accessories: vehicle.accessories ?? [],
  };
}

function noteChatStockCap(rows: ChatVehicleRecord[]) {
  if (chatStockAtCap(rows.length)) {
    console.warn(
      `[chat] estoque no teto de ${CHAT_STOCK_TAKE} anúncios — migrar para consulta orientada pela pergunta`,
    );
  }
  return rows;
}

export async function loadChatStock(): Promise<ChatVehicleRecord[]> {
  try {
    const rows = await prisma.vehicle.findMany({
      where: { status: "disponivel", historical: false },
      orderBy: { updatedAt: "desc" },
      take: CHAT_STOCK_TAKE,
      select: CHAT_VEHICLE_SELECT,
    });
    return noteChatStockCap(rows);
  } catch (error) {
    if (!isMissingColumnError(error, "historical")) throw error;
    const rows = await prisma.vehicle.findMany({
      where: { status: "disponivel" },
      orderBy: { updatedAt: "desc" },
      take: CHAT_STOCK_TAKE,
      select: CHAT_VEHICLE_SELECT,
    });
    return noteChatStockCap(rows);
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** “carros até 70 mil” não mistura moto; “moto até 15 mil” não mistura carro. */
export function parseVehicleCategoryFilter(
  mensagem: string,
): "carro" | "moto" | null {
  const folded = normalize(mensagem);
  const wantsMoto = /\b(moto|motos|motocicleta|motoca|scooter)\b/.test(folded);
  const wantsCar = /\b(carro|carros|hatch|sedan|suv|pickup|caminhonete)\b/.test(
    folded,
  );
  if (wantsMoto && !wantsCar) return "moto";
  if (wantsCar && !wantsMoto) return "carro";
  return null;
}

/** Na faixa de preço, o padrão da loja é carro — moto só se o visitante pedir. */
export function resolveChatCategory(mensagem: string): "carro" | "moto" | null {
  return parseVehicleCategoryFilter(mensagem) ??
    (parsePriceLimit(mensagem) != null ? "carro" : null);
}

export function filterStockByCategory(
  stock: ChatVehicleRecord[],
  mensagem: string,
) {
  const category = resolveChatCategory(mensagem);
  if (!category) return stock;
  return stock.filter(
    (vehicle) => (vehicle.category ?? "carro") === category,
  );
}

export function foldedTransmission(value: string) {
  return normalize(value);
}

export function parseTransmissionFilter(
  mensagem: string,
): "automatico" | "manual" | null {
  const folded = normalize(mensagem);
  const auto = /\b(automatico|automatica|cvt)\b/.test(folded);
  const manual = /\bmanual(?:is)?\b/.test(folded);
  if (auto && !manual) return "automatico";
  if (manual && !auto) return "manual";
  return null;
}

export function filterStockByTransmission(
  stock: ChatVehicleRecord[],
  mensagem: string,
) {
  const wanted = parseTransmissionFilter(mensagem);
  if (!wanted) return stock;
  const matched = stock.filter((vehicle) => {
    const value = normalize(vehicle.transmission ?? "");
    if (wanted === "automatico") return /automatic|cvt/.test(value);
    return /manual/.test(value) && !/automatic/.test(value);
  });
  return matched.length > 0 ? matched : stock;
}

export function applyChatStockFilters(
  stock: ChatVehicleRecord[],
  mensagem: string,
) {
  return filterStockByTransmission(
    filterStockByCategory(stock, mensagem),
    mensagem,
  );
}

/** Casa o texto do interesse com um anúncio do estoque, se der. */
export function matchInterestVehicle(
  interest: string | undefined,
  stock: ChatVehicleRecord[],
  minScore = 2,
) {
  const needle = normalize(interest ?? "");
  if (!needle || stock.length === 0) return null;

  let best: ChatVehicleRecord | null = null;
  let bestScore = 0;

  for (const vehicle of stock) {
    const hay = normalize(
      `${vehicle.brand} ${vehicle.model} ${vehicle.version ?? ""} ${vehicle.yearModel}`,
    );
    let score = 0;
    for (const part of needle.split(" ").filter((token) => token.length >= 3)) {
      if (hay.includes(part)) score += 1;
    }
    if (hay.includes(needle)) score += 3;
    if (score > bestScore) {
      best = vehicle;
      bestScore = score;
    }
  }

  return bestScore >= minScore ? best : null;
}

const GENERIC_STOCK_TOKEN =
  /^(tem|vende|vendem|estoque|carro|carros|modelo|marca|ano|seminovo|preco|valor|qual|quanto|quais|ate|mil)$/;

export function formatVehicleLine(vehicle: ChatVehicleRecord) {
  const version = vehicle.version?.trim() ? ` ${vehicle.version.trim()}` : "";
  return `${vehicle.brand} ${vehicle.model}${version} ${vehicle.yearModel} · ${vehicle.km.toLocaleString("pt-BR")} km · R$ ${vehicle.price.toLocaleString("pt-BR")}`;
}

function talkName(vehicle: ChatVehicleRecord) {
  const name = formatModelName(vehicle.model || vehicle.brand).trim();
  const article = (vehicle.category ?? "carro") === "moto" ? "a" : "o";
  const labeled = `${article} ${name}`;
  return {
    name,
    labeled,
    cap: labeled.charAt(0).toUpperCase() + labeled.slice(1),
  };
}

function formatChatKm(km: number) {
  if (km >= 10_000) return `${Math.round(km / 1000)} mil km`;
  return `${km.toLocaleString("pt-BR")} km`;
}

function isAutomaticVehicle(vehicle: ChatVehicleRecord) {
  return /automatic|cvt/.test(normalize(vehicle.transmission ?? ""));
}

function isManualVehicle(vehicle: ChatVehicleRecord) {
  const value = normalize(vehicle.transmission ?? "");
  return /manual/.test(value) && !/automatic/.test(value);
}

function joinPtNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

function formatConsumptionCompare(vehicles: ChatVehicleRecord[]) {
  const rows = vehicles
    .map((vehicle) => {
      const range = typicalConsumptionRange({
        fuel: vehicle.fuel,
        engine: vehicle.engine,
        version: vehicle.version,
        category: vehicle.category ?? "carro",
      });
      if (!range) return null;
      return {
        name: talkName(vehicle).name,
        label: range.label,
        kmL: range.kmL,
        liters: parseEngineDisplacementLiters(
          vehicle.engine,
          vehicle.version,
          vehicle.category ?? "carro",
        ),
      };
    })
    .filter(
      (
        row,
      ): row is {
        name: string;
        label: string;
        kmL: string;
        liters: number | null;
      } => row != null,
    )
    .sort((a, b) => (a.liters ?? 99) - (b.liters ?? 99));

  if (rows.length === 0) {
    return typicalConsumptionHint(vehicles[0]!);
  }
  if (rows.length === 1) {
    return `Na cidade, o consumo de catálogo fica por aí: ${rows[0]!.label} ~${rows[0]!.kmL}. Nenhum desses usados foi medido na loja.`;
  }

  const groups: { names: string[]; label: string; kmL: string }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.kmL === row.kmL && last.label === row.label) {
      last.names.push(row.name);
      continue;
    }
    groups.push({ names: [row.name], label: row.label, kmL: row.kmL });
  }
  const bits = groups.map((group) => {
    const motor = group.label.replace(/\s*flex$/i, "");
    return `${joinPtNames(group.names)} ${motor} ~${group.kmL}`;
  });
  return `Na cidade, o consumo de catálogo fica por aí: ${bits.join(" · ")}. Nenhum desses usados foi medido na loja.`;
}

/** Compara os 2–3 anúncios da tela com dados reais + faixa de catálogo. */
export function compareChatStockPicks(
  vehicles: ChatVehicleRecord[],
  opts: { withLeadin?: boolean } = {},
) {
  if (vehicles.length === 0) return "";
  if (vehicles.length === 1) {
    const vehicle = vehicles[0]!;
    return `Achei ele no estoque: ${talkName(vehicle).cap} ${vehicle.yearModel}, ${vehicle.transmission}, ${formatChatKm(vehicle.km)}, ${formatChatPrice(vehicle.price)}.\n\n${typicalConsumptionHint(vehicle)}.`;
  }

  const cheapest = vehicles.reduce((best, vehicle) =>
    vehicle.price < best.price ? vehicle : best,
  );
  const lowestKm = vehicles.reduce((best, vehicle) =>
    vehicle.km < best.km ? vehicle : best,
  );
  const autos = vehicles.filter(isAutomaticVehicle);
  const manuals = vehicles.filter(isManualVehicle);
  const mixed = autos.length > 0 && manuals.length > 0;
  const auto = autos[0];

  const cheap = talkName(cheapest);
  const picks: string[] = [
    `${cheap.cap} é o mais em conta (${formatChatPrice(cheapest.price)}) — um bom começo.`,
  ];
  const mentioned = new Set<string>([cheapest.id]);

  if (lowestKm.id !== cheapest.id) {
    const low = talkName(lowestKm);
    if (mixed && auto?.id === lowestKm.id) {
      picks.push(
        `${low.cap} tem menos km (${formatChatKm(lowestKm.km)}) e é o automático da lista — mais conforto no trânsito.`,
      );
      mentioned.add(lowestKm.id);
    } else {
      picks.push(`${low.cap} tem menos km (${formatChatKm(lowestKm.km)}).`);
      mentioned.add(lowestKm.id);
      if (mixed && auto && !mentioned.has(auto.id)) {
        picks.push(
          `${talkName(auto).cap} é o automático da lista — mais conforto no trânsito.`,
        );
        mentioned.add(auto.id);
      }
    }
  } else if (mixed && auto && auto.id !== cheapest.id) {
    picks.push(
      `${talkName(auto).cap} é o automático da lista — mais conforto no trânsito.`,
    );
    mentioned.add(auto.id);
  }

  if (mixed && auto?.id === cheapest.id) {
    picks[0] =
      `${cheap.cap} é o mais em conta (${formatChatPrice(cheapest.price)}) e o automático da lista — mais conforto no trânsito.`;
  }

  const leftover = vehicles.filter((vehicle) => !mentioned.has(vehicle.id));
  const newest = vehicles.reduce((best, vehicle) =>
    vehicle.yearModel > best.yearModel ? vehicle : best,
  );
  const maxPrice = Math.max(...vehicles.map((vehicle) => vehicle.price));
  const distinctPrices = [...new Set(vehicles.map((vehicle) => vehicle.price))].sort(
    (a, b) => a - b,
  );
  const middlePrice = distinctPrices.length >= 3 ? distinctPrices[1] : null;
  for (const vehicle of leftover) {
    const name = talkName(vehicle);
    if (vehicle.price === cheapest.price) {
      picks.push(
        `${name.cap} também está em ${formatChatPrice(vehicle.price)}.`,
      );
    } else if (
      vehicle.id === newest.id &&
      vehicles.some((other) => other.yearModel < newest.yearModel)
    ) {
      picks.push(`${name.cap} é o mais novo (${vehicle.yearModel}).`);
    } else if (middlePrice != null && vehicle.price === middlePrice) {
      picks.push(
        `${name.cap} fica no meio do preço (${formatChatPrice(vehicle.price)}).`,
      );
    } else if (vehicle.price === maxPrice && vehicle.price > cheapest.price) {
      picks.push(
        `${name.cap} fica um pouco acima (${formatChatPrice(vehicle.price)}).`,
      );
    }
  }

  const body = `${picks.join(" ")}\n\n${formatConsumptionCompare(vehicles)}`;
  if (opts.withLeadin === false) return body;
  return `Vou te ajudar a escolher.\n\n${body}`;
}

function foldReply(value: string) {
  return normalize(value);
}

export function replyAlreadyCompares(
  reply: string,
  vehicles: ChatVehicleRecord[],
) {
  const remainder = reply
    .split("\n")
    .filter((line) => !(/·/.test(line) && /R\$/.test(line)))
    .join(" ");
  const folded = foldReply(remainder);
  if (/consumo|km\/l|catalogo|faixa tipica/.test(folded)) return true;
  if (vehicles.length < 2) return false;
  const mentioned = vehicles.filter((vehicle) =>
    folded.includes(normalize(vehicle.model)),
  ).length;
  return (
    mentioned >= 2 &&
    /(mais em conta|menos km|menor km|mais novo|entre ess|compar|conforto)/.test(
      folded,
    )
  );
}

function chatListIntro(reply: string) {
  const remainder = reply
    .split("\n")
    .filter((line) => !(/·/.test(line) && /R\$/.test(line)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!remainder) return "";
  const first = (remainder.split(/(?<=[.!?:])\s+/)[0] ?? "")
    .replace(/:+$/, "")
    .trim();
  if (!first || first.length > 180) return "";
  const folded = foldReply(first);
  if (
    /consumo|km\/l|catalogo|entre ess|mais em conta|menos km|conforto|medido|^temos |separei \d|otimas opcoes|^aqui estao|vou te ajudar/.test(
      folded,
    )
  ) {
    return "";
  }
  return /[.!?]$/.test(first) ? first : `${first}.`;
}

/** Recorte da pergunta quando o modelo começa com “Separei 3 / ótimas opções”. */
export function chatFilterIntro(mensagem: string) {
  const budget = parsePriceLimit(mensagem);
  const gear = parseTransmissionFilter(mensagem);
  const category = parseVehicleCategoryFilter(mensagem);
  const ceiling = budget != null ? `até ${formatChatPrice(budget)}` : "";

  if (gear === "automatico" && ceiling) {
    return category === "moto"
      ? `Olha só: motos automáticas ${ceiling} no estoque agora.`
      : `Olha só: automáticos ${ceiling} no estoque agora.`;
  }
  if (gear === "manual" && ceiling) {
    return `Olha só: manuais ${ceiling} no estoque agora.`;
  }
  if (category === "moto" && ceiling) {
    return `Olha só: motos ${ceiling} no estoque agora.`;
  }
  if (category === "carro" && ceiling) {
    return `Olha só: carros ${ceiling} no estoque agora.`;
  }
  if (ceiling) {
    return `Olha só: ${ceiling} no estoque agora.`;
  }
  if (gear === "automatico") return "Olha só: automáticos do estoque agora.";
  if (gear === "manual") return "Olha só: manuais do estoque agora.";
  return "";
}

/** Comparação sempre dos cards na tela — o modelo não pode falar de outro carro. */
export function enrichChatStockReply(
  reply: string,
  vehicles: ChatVehicleRecord[],
  mensagem = "",
) {
  if (vehicles.length === 0) return reply;
  if (vehicles.length >= 2) {
    const intro = chatListIntro(reply) || chatFilterIntro(mensagem);
    const compare = compareChatStockPicks(vehicles, { withLeadin: !intro });
    if (!compare) return reply;
    return intro ? `${intro.trim()}\n\n${compare}` : compare;
  }
  if (replyAlreadyCompares(reply, vehicles)) {
    if (
      /consumo|km\/l|catalogo/.test(foldReply(reply)) &&
      !/medido/.test(foldReply(reply))
    ) {
      return `${reply.trim()} Nenhum desses usados foi medido na loja.`;
    }
    return reply;
  }
  const extra = compareChatStockPicks(vehicles);
  if (!extra) return reply;
  return `${reply.trim()}\n\n${extra}`;
}

export function isIncompleteStockReply(reply: string) {
  const text = reply.trim();
  if (!text) return true;
  if (/:\s*$/.test(text)) return true;
  const pricedCars = (text.match(/·\s*R\$\s*\d/g) ?? []).length;
  if (
    /op[cç][oõ]es|no estoque|no momento|cabem no orcamento|cabem no orçamento/i.test(
      text,
    ) &&
    pricedCars < 2
  ) {
    return true;
  }
  return false;
}

export function listStockByBudget(mensagem: string, stock: ChatVehicleRecord[]) {
  const limit = parsePriceLimit(mensagem);
  if (limit == null) return null;
  const matches = applyChatStockFilters(stock, mensagem)
    .filter((vehicle) => vehicle.price <= limit)
    .sort((a, b) => a.price - b.price);
  const ceiling = `R$ ${limit.toLocaleString("pt-BR")}`;
  if (matches.length === 0) {
    return `Nessa faixa até ${ceiling} ainda não tem anúncio agora. Sem estresse: posso olhar outra faixa com você, ou um consultor te ajuda no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }
  const picks = matches.slice(0, 3);
  const cheapestId = picks[0]?.id;
  const lowestKmId = [...picks].sort((a, b) => a.km - b.km)[0]?.id;
  const lines = picks.map((vehicle) => {
    const bits: string[] = [];
    if (vehicle.id === cheapestId) bits.push("mais em conta");
    if (vehicle.id === lowestKmId) bits.push("menor km");
    if (/automatic/.test(normalize(vehicle.transmission))) bits.push("automático");
    const why = bits.length ? ` — ${bits.join(", ")}` : "";
    return `${formatVehicleLine(vehicle)}${why}`;
  });
  return `Beleza — até ${ceiling}, estes aqui fazem sentido pra começar.\n${lines.join("\n")}\n\n${compareChatStockPicks(picks, { withLeadin: false })}`;
}

export const CHAT_FINANCE_REPLY =
  `Dá sim — a gente parcela o seminovo em até 60 vezes no financiamento, e no cartão de crédito aceitamos em até 18 vezes. O usado também pode entrar na conta. A condição certinha depende do seu perfil e do carro, então o consultor monta no WhatsApp com o modelo que você escolher, bem no seu caso. ${CHAT_WHATSAPP_URL}`;

export const CHAT_CARD_REPLY =
  `Dá sim — no cartão de crédito a gente parcela em até 18 vezes. Se preferir, o seminovo também financia em até 60 vezes, e o usado pode entrar na conta. O consultor confirma a melhor forma no WhatsApp, no seu caso. ${CHAT_WHATSAPP_URL}`;

export const CHAT_TRADE_REPLY =
  `Aceitamos sim — carro ou moto entram na conta. Manda umas fotos no WhatsApp que o consultor avalia e já encaixa no negócio com você. ${CHAT_WHATSAPP_URL}`;

/** Atalhos do chat (chips) — política fixa, sem perguntar de novo o modelo. */
export function chatPolicyShortcut(
  mensagem: string,
): "finance" | "card" | "troca" | null {
  const folded = normalize(mensagem);
  if (
    /^(aceita cartao|aceitam cartao|cartao de credito|parcela no cartao|da para parcelar no cartao|da pra parcelar no cartao|aceita cartao de credito)$/.test(
      folded,
    )
  ) {
    return "card";
  }
  if (
    /^(financiamento em 60x|financiar em 60x|como funciona o financiamento|da para parcelar|da pra parcelar|voces financiam(?: em quantas vezes)?)$/.test(
      folded,
    )
  ) {
    return "finance";
  }
  if (/^(aceita troca|faz troca|tem troca)$/.test(folded)) return "troca";
  return null;
}

/** Resposta da loja sem Gemini — só dados reais do estoque e política fixa. */
export function localGarageReply(
  mensagem: string,
  stock: ChatVehicleRecord[],
) {
  const text = normalize(mensagem);
  const policy = chatPolicyShortcut(mensagem);
  if (policy === "card") return CHAT_CARD_REPLY;
  if (policy === "finance") return CHAT_FINANCE_REPLY;
  if (policy === "troca") return CHAT_TRADE_REPLY;

  if (/\b(cartao|credito|18x)\b/.test(text)) {
    return CHAT_CARD_REPLY;
  }
  if (/\b(financi\w*|parcela|juros|60x)\b/.test(text)) {
    return CHAT_FINANCE_REPLY;
  }

  const byBudget = listStockByBudget(mensagem, stock);
  if (byBudget) return byBudget;
  if (/\bgarantia\b/.test(text)) {
    return `Fica tranquilo: todos os seminovos saem com garantia de 3 meses. Se quiser, eu já te mostro um carro do estoque, ou o consultor detalha no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }
  if (/\b(horario|atendimento|endereco|localizacao)\b/.test(text)) {
    return `A gente atende online todos os dias, das 8h às 23h — Aracruz, Vitória, Linhares, Serra e Vila Velha. Loja digital, visita combinada. Um consultor confirma o melhor jeito no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }
  if (/\btroca\b/.test(text)) {
    return CHAT_TRADE_REPLY;
  }

  const match =
    matchInterestVehicle(mensagem, stock) ??
    matchInterestVehicle(mensagem, stock, 1);
  if (match) {
    const version = match.version?.trim() ? ` ${match.version.trim()}` : "";
    return `Achei no estoque: ${match.brand} ${match.model}${version} ${match.yearModel}, ${match.km.toLocaleString("pt-BR")} km, ${formatChatPrice(match.price)}, ${match.transmission}. ${typicalConsumptionHint(match)}.`;
  }

  const looksLikeVehicle = /\b(tem|vende|estoque|carro|modelo|marca|km)\b/.test(
    text,
  );
  const specific = text
    .split(" ")
    .filter((token) => token.length >= 3 && !GENERIC_STOCK_TOKEN.test(token));
  if (looksLikeVehicle && specific.length > 0) {
    return `Esse modelo não está na lista atual. Posso olhar outro na mesma ideia, ou o consultor procura no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }
  if (looksLikeVehicle && stock.length > 0) {
    const sample = stock
      .slice(0, 3)
      .map((vehicle) => `${vehicle.brand} ${vehicle.model} ${vehicle.yearModel}`)
      .join("; ");
    return `No estoque agora tem, entre outros: ${sample}. Me diz marca ou modelo que eu afino pra você.`;
  }
  return null;
}
