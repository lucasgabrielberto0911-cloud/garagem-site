import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { parsePriceLimit, type ChatStockLine } from "@/lib/chat-prompt";

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
  return `Até ${ceiling} eu começaria por estes:\n${lines.join("\n")}\n\nQual perfil te serve — hatch, automático ou o mais barato?`;
}

/** Resposta da loja sem Gemini — só dados reais do estoque e política fixa. */
export function localGarageReply(
  mensagem: string,
  stock: ChatVehicleRecord[],
) {
  const text = normalize(mensagem);
  const byBudget = listStockByBudget(mensagem, stock);
  if (byBudget) return byBudget;

  if (/\b(financi\w*|parcela|juros|60x)\b/.test(text)) {
    return "A gente financia em até 60x e aceita seu carro ou moto na troca como parte do negócio. Parcela, entrada e aprovação um consultor monta no WhatsApp com o carro que você escolher — eu não fecho valor de parcela pelo chat. Qual carro do estoque você tem em mente? https://wa.me/5527996330706";
  }
  if (/\bgarantia\b/.test(text)) {
    return "Garantia padrão de 3 meses em todos os veículos. Se quiser, te mostro um carro do estoque ou um consultor detalha no WhatsApp: https://wa.me/5527996330706";
  }
  if (/\b(horario|atendimento|endereco|localizacao)\b/.test(text)) {
    return "Atendemos Aracruz, Vitória, Linhares, Serra e Vila Velha (loja digital). Um consultor confirma o melhor horário no WhatsApp: https://wa.me/5527996330706";
  }
  if (/\btroca\b/.test(text)) {
    return "Sempre aceitamos veículo na troca — carro ou moto. A avaliação um consultor faz no WhatsApp, de preferência com fotos. Qual carro do estoque você quer cruzar com a troca? https://wa.me/5527996330706";
  }

  const match =
    matchInterestVehicle(mensagem, stock) ??
    matchInterestVehicle(mensagem, stock, 1);
  if (match) {
    const version = match.version?.trim() ? ` ${match.version.trim()}` : "";
    return `Temos o ${match.brand} ${match.model}${version} ${match.yearModel}, ${match.km} km, R$ ${match.price}. Quer que um consultor te chame no WhatsApp? https://wa.me/5527996330706`;
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
