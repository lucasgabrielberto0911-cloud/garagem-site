import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import {
  parseEngineDisplacementLiters,
  typicalConsumptionHint,
  typicalConsumptionRange,
} from "@/lib/chat-consumption";
import { formatChatPrice, parsePriceLimit, type ChatStockLine } from "@/lib/chat-prompt";

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

export async function loadChatStock(): Promise<ChatVehicleRecord[]> {
  try {
    return await prisma.vehicle.findMany({
      where: { status: "disponivel", historical: false },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: CHAT_VEHICLE_SELECT,
    });
  } catch (error) {
    if (!isMissingColumnError(error, "historical")) throw error;
    return prisma.vehicle.findMany({
      where: { status: "disponivel" },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: CHAT_VEHICLE_SELECT,
    });
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

function vehicleShortName(vehicle: ChatVehicleRecord) {
  return `${vehicle.brand} ${vehicle.model}`.trim();
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

function consumptionBit(vehicle: ChatVehicleRecord) {
  const range = typicalConsumptionRange({
    fuel: vehicle.fuel,
    engine: vehicle.engine,
    version: vehicle.version,
    category: vehicle.category ?? "carro",
  });
  if (!range) return typicalConsumptionHint(vehicle);
  return `${range.label} ~${range.city}`;
}

/** Compara os 2–3 anúncios da tela com dados reais + faixa de catálogo. */
export function compareChatStockPicks(vehicles: ChatVehicleRecord[]) {
  if (vehicles.length === 0) return "";
  if (vehicles.length === 1) {
    const vehicle = vehicles[0]!;
    return `${vehicleShortName(vehicle)} ${vehicle.yearModel}: ${vehicle.transmission}, ${formatChatKm(vehicle.km)}, ${formatChatPrice(vehicle.price)}. ${typicalConsumptionHint(vehicle)}.`;
  }

  const cheapest = vehicles.reduce((best, vehicle) =>
    vehicle.price < best.price ? vehicle : best,
  );
  const lowestKm = vehicles.reduce((best, vehicle) =>
    vehicle.km < best.km ? vehicle : best,
  );
  const newest = vehicles.reduce((best, vehicle) =>
    vehicle.yearModel > best.yearModel ? vehicle : best,
  );
  const autos = vehicles.filter(isAutomaticVehicle);
  const manuals = vehicles.filter(isManualVehicle);

  const sentences: string[] = [];
  sentences.push(
    `Entre esses, o ${vehicleShortName(cheapest)} é o mais em conta (${formatChatPrice(cheapest.price)}).`,
  );
  if (lowestKm.id !== cheapest.id) {
    sentences.push(
      `O ${vehicleShortName(lowestKm)} tem menos km (${formatChatKm(lowestKm.km)}).`,
    );
  } else if (newest.id !== cheapest.id) {
    sentences.push(
      `O ${vehicleShortName(newest)} é o mais novo (${newest.yearModel}).`,
    );
  }

  if (autos.length > 0 && manuals.length > 0) {
    const auto = autos[0]!;
    sentences.push(
      `O ${vehicleShortName(auto)} é automático — mais conforto no trânsito; o manual equivalente costuma ser um pouco mais econômico na mesma motorização.`,
    );
  } else if (autos.length === vehicles.length) {
    sentences.push(
      vehicles.length === 2
        ? "Os dois são automático, então o recorte fica em preço, km e motor."
        : "Todos são automático, então o recorte fica em preço, km e motor.",
    );
  }

  const withLiters = vehicles.map((vehicle) => ({
    vehicle,
    liters: parseEngineDisplacementLiters(
      vehicle.engine,
      vehicle.version,
      vehicle.category ?? "carro",
    ),
  }));
  const known = withLiters.filter(
    (item): item is { vehicle: ChatVehicleRecord; liters: number } =>
      item.liters != null,
  );
  const smallest = [...known].sort((a, b) => a.liters - b.liters)[0];
  const largest = [...known].sort((a, b) => b.liters - a.liters)[0];
  if (
    smallest &&
    largest &&
    smallest.vehicle.id !== largest.vehicle.id &&
    smallest.liters !== largest.liters
  ) {
    sentences.push(
      `No consumo, faixa típica de catálogo: ${vehicleShortName(smallest.vehicle)} ${consumptionBit(smallest.vehicle)}; ${vehicleShortName(largest.vehicle)} ${consumptionBit(largest.vehicle)}. Nenhum desses usados foi medido na loja.`,
    );
  } else {
    sentences.push(
      `Consumo: ${typicalConsumptionHint(vehicles[0]!)}.`,
    );
  }

  return sentences.join(" ");
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

/** Se o modelo vier seco, completa com comparação e consumo dos cards. */
export function enrichChatStockReply(
  reply: string,
  vehicles: ChatVehicleRecord[],
) {
  if (vehicles.length === 0) return reply;
  const foldedAll = foldReply(reply);
  if (replyAlreadyCompares(reply, vehicles)) {
    if (
      /consumo|km\/l|catalogo/.test(foldedAll) &&
      !/medido/.test(foldedAll)
    ) {
      return `${reply.trim()} Nenhum desses usados foi medido na loja.`;
    }
    return reply;
  }
  const extra = compareChatStockPicks(vehicles);
  if (!extra) return reply;
  return `${reply.trim()}\n${extra}`;
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
    return `Neste valor até ${ceiling} não tem anúncio agora. Posso mostrar outra faixa, ou um consultor te ajuda no WhatsApp: https://wa.me/5527996330706`;
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
  return `Até ${ceiling} eu começaria por estes:\n${lines.join("\n")}\n${compareChatStockPicks(picks)}`;
}

export const CHAT_FINANCE_REPLY =
  "A gente financia em até 60x e aceita carro ou moto na troca. Parcela o consultor monta no WhatsApp — eu não fecho valor pelo chat. https://wa.me/5527996330706";

export const CHAT_TRADE_REPLY =
  "Sempre aceitamos carro ou moto na troca. A avaliação o consultor faz no WhatsApp, de preferência com fotos. https://wa.me/5527996330706";

/** Atalhos do chat (chips) — política fixa, sem perguntar de novo o modelo. */
export function chatPolicyShortcut(mensagem: string): "finance" | "troca" | null {
  const folded = normalize(mensagem);
  if (
    /^(financiamento em 60x|financiar em 60x|como funciona o financiamento|voces financiam(?: em quantas vezes)?)$/.test(
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
  const byBudget = listStockByBudget(mensagem, stock);
  if (byBudget) return byBudget;

  const policy = chatPolicyShortcut(mensagem);
  if (policy === "finance") return CHAT_FINANCE_REPLY;
  if (policy === "troca") return CHAT_TRADE_REPLY;

  if (/\b(financi\w*|parcela|juros|60x)\b/.test(text)) {
    return CHAT_FINANCE_REPLY;
  }
  if (/\bgarantia\b/.test(text)) {
    return "Garantia padrão de 3 meses em todos os veículos. Se quiser, te mostro um carro do estoque ou um consultor detalha no WhatsApp: https://wa.me/5527996330706";
  }
  if (/\b(horario|atendimento|endereco|localizacao)\b/.test(text)) {
    return "Atendemos Aracruz, Vitória, Linhares, Serra e Vila Velha (loja digital). Um consultor confirma o melhor horário no WhatsApp: https://wa.me/5527996330706";
  }
  if (/\btroca\b/.test(text)) {
    return CHAT_TRADE_REPLY;
  }

  const match =
    matchInterestVehicle(mensagem, stock) ??
    matchInterestVehicle(mensagem, stock, 1);
  if (match) {
    const version = match.version?.trim() ? ` ${match.version.trim()}` : "";
    return `Temos o ${match.brand} ${match.model}${version} ${match.yearModel}, ${match.km.toLocaleString("pt-BR")} km, ${formatChatPrice(match.price)}, ${match.transmission}. ${typicalConsumptionHint(match)}.`;
  }

  const looksLikeVehicle = /\b(tem|vende|estoque|carro|modelo|marca|km)\b/.test(
    text,
  );
  const specific = text
    .split(" ")
    .filter((token) => token.length >= 3 && !GENERIC_STOCK_TOKEN.test(token));
  if (looksLikeVehicle && specific.length > 0) {
    return "Esse modelo não está na lista atual. Fala com a gente no WhatsApp: https://wa.me/5527996330706";
  }
  if (looksLikeVehicle && stock.length > 0) {
    const sample = stock
      .slice(0, 3)
      .map((vehicle) => `${vehicle.brand} ${vehicle.model} ${vehicle.yearModel}`)
      .join("; ");
    return `No estoque agora tem, entre outros: ${sample}. Me diz marca ou modelo que eu afino. WhatsApp: https://wa.me/5527996330706`;
  }
  return null;
}
