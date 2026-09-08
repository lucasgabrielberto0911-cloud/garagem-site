import {
  formatBrandName,
  formatCurrencyBRL,
  formatKmBR,
  formatModelName,
  formatVehicleLabel,
} from "@/lib/format";
import { parsePriceLimit } from "@/lib/chat-prompt";
import { coverSrc } from "@/lib/stock-query";
import { vehiclePath } from "@/lib/vehicle-slug";
import {
  applyChatStockFilters,
  foldedTransmission,
  parseTransmissionFilter,
  parseVehicleCategoryFilter,
  resolveChatCategory,
  type ChatVehicleRecord,
} from "@/lib/chat-stock";

export const CHAT_CARD_LIMIT = 3;

const CHAT_BRANDS =
  "honda|hyundai|fiat|chevrolet|ford|jeep|toyota|volkswagen|vw|renault|nissan|mitsubishi|bmw|mercedes|peugeot|citroen|kia|byd|caoa|chery|yamaha|kawasaki";

const BUDGET_QUERY_NOISE =
  /^(quais|qual|tem|temos|quero|procuro|mostrar|mostra|ver|me|os|as|uns|um|uma|de|do|da|dos|das|no|na|em|por|com|ate|abaixo|menos|maximo|orcamento|faixa|preco|valor|carros|carro|veiculos|veiculo|seminovos|opcoes|opcao|automatico|automatica|manual|cvt|hatch|sedan|suv|mil|k|\d+)$/;

export type ChatVehicleCard = {
  id: string;
  href: string;
  title: string;
  brand: string;
  model: string;
  version: string | null;
  year: number;
  km: number;
  price: number;
  color: string | null;
  transmission: string | null;
  photo: string | null;
};

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function priceInText(text: string, price: number) {
  const rounded = Math.round(price);
  const br = rounded.toLocaleString("pt-BR");
  return text.includes(br) || text.includes(String(rounded));
}

export function looksLikeLooseVehicleTitle(line: string) {
  const trimmed = line.trim().replace(/^[-•*\d.)\s]+/, "");
  if (trimmed.length < 8 || trimmed.length > 90) return false;
  if (/[?]/.test(trimmed)) return false;
  if (
    /até r\$|orcamento|orçamento|financi|troca|qual perfil|aqui estao|aqui estão|cabem no|mais em conta|whatsapp/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  return new RegExp(`^(${CHAT_BRANDS})\\b`, "i").test(trimmed);
}

/** “Quais carros até 70 mil?” — sem marca/modelo. */
export function isBareBudgetQuery(mensagem: string) {
  if (parsePriceLimit(mensagem) == null) return false;
  const folded = fold(mensagem);
  if (new RegExp(`\\b(${CHAT_BRANDS})\\b`, "i").test(folded)) return false;
  const tokens = folded.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => BUDGET_QUERY_NOISE.test(token));
}

export function isChatVehicleListingLine(line: string) {
  const trimmed = line.trim().replace(/^[-•*\d.)\s]+/, "");
  if (!trimmed) return false;
  const hasKm = /[\d.]+\s*km/i.test(trimmed);
  const hasPrice = /R\$\s*\d/.test(trimmed);
  if (!hasKm || !hasPrice) return false;
  if (
    /^(temos o|temos um|aceita|financi|garantia|atendemos|sempre|parcela)/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  return /·/.test(trimmed) || trimmed.length < 160;
}

export function stripChatVehicleListingLines(
  text: string,
  vehicles: ChatVehicleCard[] = [],
) {
  return text
    .split("\n")
    .filter((line) => {
      if (isChatVehicleListingLine(line)) return false;
      if (vehicles.length === 0) return true;
      if (looksLikeLooseVehicleTitle(line)) return false;
      const folded = fold(line);
      return !vehicles.some((vehicle) => {
        const title = fold(vehicle.title);
        return title.length >= 5 && folded.includes(title);
      });
    })
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CARD_INTRO_MAX = 220;
const CARD_FILLER =
  /tem o mais em conta|o de menor km|automatico se houver|se quiser esticar|logo acima/;

function sentenceMentionsUnshownVehicle(
  sentence: string,
  vehicles: ChatVehicleCard[],
) {
  const folded = fold(sentence);
  const brandRe = new RegExp(`\\b(${CHAT_BRANDS})\\b`, "g");
  for (const match of folded.matchAll(brandRe)) {
    const brand = match[1];
    const rest = folded.slice(
      (match.index ?? 0) + brand.length,
      (match.index ?? 0) + brand.length + 28,
    );
    const token = rest.trim().split(/\s+/)[0] ?? "";
    const covered = vehicles.some((vehicle) => {
      if (fold(vehicle.brand) !== brand) return false;
      if (!token || token.length < 2) return true;
      const model = fold(vehicle.model);
      const title = fold(vehicle.title);
      return model.includes(token) || title.includes(token);
    });
    if (!covered) return true;
  }
  return false;
}

/** Com mini-anúncio na tela, a bolha fica só com o gancho curto. */
export function polishChatReplyWithCards(
  text: string,
  vehicles: ChatVehicleCard[],
) {
  const stripped = stripChatVehicleListingLines(text, vehicles);
  if (vehicles.length === 0) return stripped;

  const parts = stripped
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      if (looksLikeLooseVehicleTitle(part)) return false;
      if (isChatVehicleListingLine(part)) return false;
      if (CARD_FILLER.test(fold(part))) return false;
      if (sentenceMentionsUnshownVehicle(part, vehicles)) return false;
      return true;
    });

  let intro = parts.join(" ").replace(/\s+/g, " ").trim();
  if (intro.length > CARD_INTRO_MAX) {
    intro = parts.slice(0, 2).join(" ");
  }
  if (!intro) {
    return vehicles.length === 1
      ? "Achei este no estoque:"
      : `Separei ${vehicles.length} do estoque pra você escolher:`;
  }
  return intro;
}

function scoreVehicleInText(
  vehicle: ChatVehicleRecord,
  foldedHay: string,
  raw: string,
) {
  const brand = fold(vehicle.brand);
  const model = fold(vehicle.model);
  let score = 0;
  if (brand && foldedHay.includes(brand)) score += 2;
  if (model && foldedHay.includes(model)) score += 3;
  if (raw.includes(String(vehicle.yearModel))) score += 1;
  if (priceInText(raw, vehicle.price)) score += 2;
  return score;
}

function bestMatchForSnippet(
  snippet: string,
  stock: ChatVehicleRecord[],
  seen: Set<string>,
) {
  const folded = fold(snippet);
  let best: ChatVehicleRecord | null = null;
  let bestScore = 0;
  for (const vehicle of stock) {
    if (seen.has(vehicle.id)) continue;
    const score = scoreVehicleInText(vehicle, folded, snippet);
    if (score > bestScore) {
      best = vehicle;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : null;
}

/** Casa o texto do assistente com anúncios reais do estoque, na ordem citada. */
export function matchVehiclesInReply(
  reply: string,
  stock: ChatVehicleRecord[],
  limit = 5,
) {
  if (!reply.trim() || stock.length === 0) return [];

  const found: ChatVehicleRecord[] = [];
  const seen = new Set<string>();

  for (const line of reply.split("\n")) {
    const listing =
      isChatVehicleListingLine(line) ||
      looksLikeLooseVehicleTitle(line) ||
      (/[\d.]+\s*km/i.test(line) && /R\$\s*\d/.test(line));
    if (!listing) continue;
    const match = bestMatchForSnippet(line, stock, seen);
    if (!match) continue;
    seen.add(match.id);
    found.push(match);
    if (found.length >= limit) return found;
  }

  if (found.length > 0) return found;

  const foldedReply = fold(reply);
  const ranked = stock
    .map((vehicle) => ({
      vehicle,
      score: scoreVehicleInText(vehicle, foldedReply, reply),
    }))
    .filter((item) => item.score >= 5)
    .sort((a, b) => b.score - a.score);

  for (const item of ranked) {
    if (seen.has(item.vehicle.id)) continue;
    seen.add(item.vehicle.id);
    found.push(item.vehicle);
    if (found.length >= limit) break;
  }
  return found;
}

export function toChatVehicleCard(vehicle: ChatVehicleRecord): ChatVehicleCard {
  const version = vehicle.version?.trim() || null;
  const color = vehicle.color?.trim() || null;
  return {
    id: vehicle.id,
    href: vehiclePath(vehicle),
    title: formatVehicleLabel(vehicle.brand, vehicle.model),
    brand: formatBrandName(vehicle.brand),
    model: formatModelName(vehicle.model),
    version,
    year: vehicle.yearModel,
    km: vehicle.km,
    price: vehicle.price,
    color,
    transmission: vehicle.transmission?.trim() || null,
    photo: coverSrc(vehicle.photos ?? []) ?? null,
  };
}

function inBudgetStock(stock: ChatVehicleRecord[], budget: number) {
  return [...stock]
    .filter((vehicle) => vehicle.price <= budget)
    .sort((a, b) => a.price - b.price);
}

function fillBudgetCards(
  preferred: ChatVehicleRecord[],
  inBudget: ChatVehicleRecord[],
  limit: number,
) {
  const seen = new Set(preferred.map((vehicle) => vehicle.id));
  const merged = [...preferred];
  for (const vehicle of inBudget) {
    if (seen.has(vehicle.id)) continue;
    merged.push(vehicle);
    seen.add(vehicle.id);
    if (merged.length >= limit) break;
  }
  return (merged.length > 0 ? merged : inBudget).slice(0, limit);
}

/** Na faixa de preço, completa anúncios reais se o texto citou poucos. */
export function selectChatVehicles(
  reply: string,
  mensagem: string,
  stock: ChatVehicleRecord[],
  limit = CHAT_CARD_LIMIT,
) {
  const pool = applyChatStockFilters(stock, mensagem);
  const mentioned = matchVehiclesInReply(reply, pool, Math.max(limit, 5));
  const budget = parsePriceLimit(mensagem);
  if (budget == null) return mentioned.slice(0, limit);

  const inBudget = inBudgetStock(pool, budget);
  const mentionedInBudget = mentioned.filter((vehicle) => vehicle.price <= budget);

  if (mentionedInBudget.length > 0 && !isBareBudgetQuery(mensagem)) {
    return fillBudgetCards(mentionedInBudget, inBudget, limit);
  }
  return inBudget.slice(0, limit);
}

export function chatStockExploreHref(
  mensagem: string,
  stock: ChatVehicleRecord[],
  shown: number,
) {
  const budget = parsePriceLimit(mensagem);
  const category = resolveChatCategory(mensagem);
  const pool = applyChatStockFilters(stock, mensagem);
  const priced =
    budget == null
      ? pool
      : pool.filter((vehicle) => vehicle.price <= budget);
  if (priced.length <= shown) return null;
  if (
    shown === 0 &&
    budget == null &&
    parseTransmissionFilter(mensagem) == null &&
    parseVehicleCategoryFilter(mensagem) == null
  ) {
    return null;
  }
  const params = new URLSearchParams();
  if (budget != null) params.set("maxPrice", String(budget));
  if (category) params.set("category", category);
  const gear = parseTransmissionFilter(mensagem);
  if (gear === "automatico") {
    const label = priced.find((vehicle) =>
      /automatic|cvt/.test(foldedTransmission(vehicle.transmission)),
    )?.transmission;
    if (label) params.set("transmission", label);
  }
  if (gear === "manual") {
    const label = priced.find((vehicle) => {
      const value = foldedTransmission(vehicle.transmission);
      return /manual/.test(value) && !/automatic/.test(value);
    })?.transmission;
    if (label) params.set("transmission", label);
  }
  const query = params.toString();
  return query ? `/estoque?${query}` : "/estoque";
}

export function chatStockExploreLabel(href: string) {
  const match = href.match(/maxPrice=(\d+)/);
  if (!match) return "Ver o estoque completo";
  return `Ver todos até ${formatCurrencyBRL(Number(match[1]))}`;
}

export function chatVehicleKm(vehicle: ChatVehicleCard) {
  return formatKmBR(vehicle.km);
}

export function chatVehiclePrice(vehicle: ChatVehicleCard) {
  return formatCurrencyBRL(vehicle.price);
}

export function chatVehicleVersion(vehicle: ChatVehicleCard) {
  return vehicle.version ? formatModelName(vehicle.version) : null;
}

export function chatVehicleLabel(vehicle: ChatVehicleCard) {
  const version = vehicle.version?.trim();
  return `${vehicle.title}${version ? ` ${version}` : ""} ${vehicle.year}`.trim();
}
