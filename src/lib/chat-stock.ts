import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { formatModelName } from "@/lib/format";
import {
  joinNameAndMotor,
  parseEngineDisplacementLiters,
  typicalConsumptionRange,
} from "@/lib/chat-consumption";
import { shortVersion } from "@/lib/vehicle-display";
import {
  CHAT_WHATSAPP_URL,
  formatChatPrice,
  parseCheapIntent,
  parsePriceLimit,
  type ChatStockLine,
  type ChatStockPromptOpts,
} from "@/lib/chat-prompt";
import { isAnaphoricVehicleFollowUp } from "@/lib/chat-text";
import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";

/** Teto da carga atual. Se o estoque chegar aqui, consultar pela pergunta — não só aumentar o take. */
export const CHAT_STOCK_TAKE = 80;

/** Linhas no prompt do Gemini — Hobby Functions / payload enxuto. */
export const CHAT_PROMPT_STOCK_LIMIT = 16;

const MOTO_NAME_HINT =
  /\b(biz|bros|titan|twister|crosser|xre|factor|fazer|pcx|nmax|n max|scooter|cg\s?\d{2,3}|fan\s?\d{2,3}|pop\s?\d{2,3}|yamaha|kawasaki|harley)\b/;

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

function compactAlnum(value: string) {
  return normalize(value).replace(/ /g, "");
}

/** Distância de edição ≤ 1: onixx→onix, civc→civic. */
export function isEditDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let shorter = a;
  let longer = b;
  if (a.length > b.length) {
    shorter = b;
    longer = a;
  }
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (shorter.length === longer.length) {
      i += 1;
      j += 1;
    } else {
      j += 1;
    }
  }
  if (i < shorter.length || j < longer.length) edits += 1;
  return edits <= 1;
}

/** “carros até 70 mil” não mistura moto; “moto até 15 mil” / “tem biz” não mistura carro. */
export function parseVehicleCategoryFilter(
  mensagem: string,
): "carro" | "moto" | null {
  const folded = normalize(mensagem);
  const wantsMoto =
    /\b(moto|motos|motocicleta|motoca|scooter)\b/.test(folded) ||
    MOTO_NAME_HINT.test(folded);
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
  return stock.filter((vehicle) => {
    const value = normalize(vehicle.transmission ?? "");
    if (wanted === "automatico") return /automatic|cvt/.test(value);
    return /manual/.test(value) && !/automatic/.test(value);
  });
}

export function hasChatStockFilter(mensagem: string) {
  return (
    parseTransmissionFilter(mensagem) != null ||
    parsePriceLimit(mensagem) != null ||
    parseVehicleCategoryFilter(mensagem) != null
  );
}

function filterStockByPrice(stock: ChatVehicleRecord[], mensagem: string) {
  const limit = parsePriceLimit(mensagem);
  if (limit == null) return stock;
  return stock.filter((vehicle) => vehicle.price <= limit);
}

export function applyChatStockFilters(
  stock: ChatVehicleRecord[],
  mensagem: string,
) {
  let next = filterStockByTransmission(
    filterStockByCategory(stock, mensagem),
    mensagem,
  );
  if (parseCheapIntent(mensagem)) {
    const modelPool = singleMentionedModelPool(next, mensagem);
    if (modelPool) next = modelPool;
    if (parsePriceLimit(mensagem) == null) {
      const cap = cheapPriceCap(next);
      if (cap != null) {
        next = next.filter((vehicle) => vehicle.price <= cap);
      }
    }
  }
  return next;
}

/** Filtro da pergunta sem o critério que esvaziou — para sugerir similares. */
export function relaxChatStockFilters(
  stock: ChatVehicleRecord[],
  mensagem: string,
) {
  const withoutGear = filterStockByPrice(
    filterStockByCategory(stock, mensagem),
    mensagem,
  );
  if (withoutGear.length > 0 && parseTransmissionFilter(mensagem)) {
    return withoutGear;
  }
  const categoryOnly = filterStockByCategory(stock, mensagem);
  if (categoryOnly.length > 0) return categoryOnly;
  return stock;
}

export function cheapPriceCap(stock: ChatVehicleRecord[]): number | null {
  if (stock.length === 0) return null;
  const sorted = [...stock].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0]!.price;
  const soft = Math.round(cheapest * 1.35);
  let cap = cheapest;
  for (const vehicle of sorted.slice(0, 3)) {
    if (vehicle.price <= soft) cap = Math.max(cap, vehicle.price);
  }
  return cap;
}

function modelMatchNeedles(model: string) {
  const full = normalize(model);
  const compact = compactAlnum(model);
  const first = full.split(" ").find((token) => /[a-z]/.test(token) && token.length >= 3);
  const needles = [full];
  if (compact.length >= 3 && compact !== full.replace(/ /g, "")) {
    needles.push(compact);
  } else if (compact.length >= 3) {
    needles.push(compact);
  }
  if (first && first !== full) needles.push(first);
  return [...new Set(needles.filter((item) => item.length >= 3))];
}

function messageMentionsModel(mensagem: string, model: string) {
  const folded = normalize(mensagem);
  const compactMsg = compactAlnum(mensagem);
  for (const needle of modelMatchNeedles(model)) {
    if (needle.includes(" ") ? folded.includes(needle) : new RegExp(`\\b${needle}\\b`).test(folded)) {
      return true;
    }
    if (!needle.includes(" ") && compactMsg.includes(needle) && needle.length >= 3) {
      return true;
    }
  }
  const compactModel = compactAlnum(model);
  if (compactModel.length >= 4) {
    for (const token of compactMsg
      ? normalize(mensagem).split(" ").flatMap((part) => {
          const compact = compactAlnum(part);
          return compact.length >= 4 ? [compact] : [];
        })
      : []) {
      if (isEditDistanceAtMostOne(token, compactModel)) return true;
      const first = compactAlnum(model.split(/[\s./-]+/)[0] ?? "");
      if (first.length >= 4 && isEditDistanceAtMostOne(token, first)) return true;
    }
  }
  return false;
}

function mentionedModelGroups(stock: ChatVehicleRecord[], mensagem: string) {
  const models = new Map<string, ChatVehicleRecord[]>();
  for (const vehicle of stock) {
    if (!messageMentionsModel(mensagem, vehicle.model)) continue;
    const model = normalize(vehicle.model);
    const list = models.get(model) ?? [];
    list.push(vehicle);
    models.set(model, list);
  }
  return models;
}

/** Um único modelo citado (ex.: “hb20 baratinho”) — não mistura irmão de outra família. */
export function singleMentionedModelPool(
  stock: ChatVehicleRecord[],
  mensagem: string,
): ChatVehicleRecord[] | null {
  const models = mentionedModelGroups(stock, mensagem);
  if (models.size !== 1) return null;
  return [...models.values()][0] ?? null;
}

/** Dois ou três modelos nomeados (“HB20 ou Onix”, “Pulse vs Argo”). */
export function mentionedModelPools(
  stock: ChatVehicleRecord[],
  mensagem: string,
): ChatVehicleRecord[][] {
  const models = mentionedModelGroups(stock, mensagem);
  return [...models.values()].filter((group) => group.length > 0);
}

function pickFromModelGroup(group: ChatVehicleRecord[]) {
  return [...group].sort((a, b) => a.price - b.price || a.km - b.km)[0] ?? null;
}

export function pickComparedModelVehicles(
  stock: ChatVehicleRecord[],
  mensagem: string,
  limit = 2,
): ChatVehicleRecord[] {
  const groups = mentionedModelPools(stock, mensagem);
  if (groups.length < 2) return [];
  const picks: ChatVehicleRecord[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    const vehicle = pickFromModelGroup(group);
    if (!vehicle || seen.has(vehicle.id)) continue;
    seen.add(vehicle.id);
    picks.push(vehicle);
    if (picks.length >= limit) break;
  }
  return picks.length >= 2 ? picks : [];
}

export function matchFocusedVehicle(
  mensagem: string,
  stock: ChatVehicleRecord[],
  preferredVehicleId?: string,
): ChatVehicleRecord | null {
  if (stock.length === 0) return null;
  const mentioned = singleMentionedModelPool(stock, mensagem);
  if (
    preferredVehicleId &&
    isAnaphoricVehicleFollowUp(mensagem) &&
    !mentioned
  ) {
    return stock.find((vehicle) => vehicle.id === preferredVehicleId) ?? null;
  }
  const pool = mentioned ?? stock;
  const matched = matchInterestVehicle(
    mensagem,
    pool,
    mentioned ? 1 : 2,
    preferredVehicleId,
  );
  if (matched) return matched;
  if (mentioned?.length === 1) return mentioned[0]!;
  if (mentioned && mentioned.length > 1) {
    const withRange = mentioned.find((vehicle) =>
      typicalConsumptionRange({
        fuel: vehicle.fuel,
        engine: vehicle.engine,
        version: vehicle.version,
        category: vehicle.category ?? "carro",
      }),
    );
    return withRange ?? mentioned[0]!;
  }
  return matchInterestVehicle(mensagem, stock, 1, preferredVehicleId);
}

export function chatPromptStockOpts(mensagem: string): ChatStockPromptOpts {
  return {
    consumption: asksAboutConsumption(mensagem),
    equipment:
      asksAboutEquipment(mensagem) || asksAboutNamedGear(mensagem),
  };
}

/** Recorte enxuto do estoque para o prompt — não manda 80 fichas completas. */
export function selectVehiclesForChatPrompt(
  stock: ChatVehicleRecord[],
  mensagem: string,
  activeVehicle?: ChatVehicleRecord,
  limit = CHAT_PROMPT_STOCK_LIMIT,
): ChatVehicleRecord[] {
  if (stock.length === 0) return [];
  const compared = pickComparedModelVehicles(stock, mensagem);
  if (compared.length >= 2) {
    return uniqueChatVehicles([activeVehicle, ...compared], limit);
  }
  const mentioned = mentionedModelGroups(stock, mensagem);
  if (mentioned.size > 0) {
    const rows = [...mentioned.values()].flat();
    return uniqueChatVehicles([activeVehicle, ...rows], limit);
  }
  const focused = matchFocusedVehicle(mensagem, stock, activeVehicle?.id);
  if (
    focused &&
    (asksAboutConsumption(mensagem) ||
      asksAboutEquipment(mensagem) ||
      asksAboutNamedGear(mensagem) ||
      asksAboutKm(mensagem) ||
      asksAboutAvailability(mensagem))
  ) {
    return uniqueChatVehicles([activeVehicle, focused], limit);
  }
  const filtered = matchedChatStock(mensagem, stock);
  const pool = filtered.length > 0 ? filtered : stock;
  const sorted =
    parsePriceLimit(mensagem) != null || parseCheapIntent(mensagem)
      ? [...pool].sort((a, b) => a.price - b.price)
      : pool;
  return uniqueChatVehicles([activeVehicle, ...sorted], limit);
}

function uniqueChatVehicles(
  rows: Array<ChatVehicleRecord | undefined>,
  limit: number,
) {
  const seen = new Set<string>();
  const next: ChatVehicleRecord[] = [];
  for (const vehicle of rows) {
    if (!vehicle || seen.has(vehicle.id)) continue;
    seen.add(vehicle.id);
    next.push(vehicle);
    if (next.length >= limit) break;
  }
  return next;
}

/** Casa o texto do interesse com um anúncio do estoque, se der. */
export function matchInterestVehicle(
  interest: string | undefined,
  stock: ChatVehicleRecord[],
  minScore = 2,
  preferredVehicleId?: string,
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
    const compactNeedle = compactAlnum(interest ?? "");
    const compactHay = compactAlnum(
      `${vehicle.brand} ${vehicle.model} ${vehicle.version ?? ""} ${vehicle.yearModel}`,
    );
    const compactModel = compactAlnum(vehicle.model);
    if (compactModel.length >= 3 && compactNeedle.includes(compactModel)) {
      score += 3;
    }
    if (compactModel.length >= 4) {
      for (const token of needle.split(" ").map((part) => compactAlnum(part)).filter((part) => part.length >= 4)) {
        if (isEditDistanceAtMostOne(token, compactModel)) score += 3;
      }
    }
    if (compactHay && compactNeedle && compactHay.includes(compactNeedle) && compactNeedle.length >= 4) {
      score += 2;
    }
    const model = normalize(vehicle.model);
    const brand = normalize(vehicle.brand);
    const version = normalize(vehicle.version ?? "");
    if (model.length >= 3 && needle.includes(model)) score += 2;
    if (brand.length >= 3 && needle.includes(brand)) score += 1;
    for (const part of needle.split(" ").filter((token) => token.length >= 4)) {
      if (version.includes(part)) score += 2;
    }
    if (hay.includes(needle)) score += 3;
    if (preferredVehicleId && vehicle.id === preferredVehicleId) {
      if (needle.includes(model) || (brand && needle.includes(brand))) {
        score += 3;
      }
    }
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
  const version = shortVersion(vehicle.version, vehicle.model);
  return `${vehicle.brand} ${vehicle.model}${version ? ` ${version}` : ""} ${vehicle.yearModel} · ${vehicle.km.toLocaleString("pt-BR")} km · R$ ${vehicle.price.toLocaleString("pt-BR")}`;
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

export function hasConsumptionFigures(text: string) {
  return /\d+\s*[–\-]\s*\d+\s*km\s*\/?\s*l/i.test(text);
}

export function consumptionReplyLooksBroken(text: string) {
  const trimmed = text.trim();
  const folded = normalize(trimmed);
  if (/fica\s+nenhum desses/.test(folded)) return true;
  if (/catalogo fica\s*(nenhum desses|este usado)/.test(folded)) return true;
  if (
    /faixa t[ií]pica de catalogo fica\s*$/i.test(trimmed) ||
    /catalogo fica\s*$/.test(folded)
  ) {
    return true;
  }
  if (
    /(consumo|catalogo|faixa tipica)/.test(folded) &&
    !hasConsumptionFigures(trimmed) &&
    /\bfica\b/.test(folded)
  ) {
    return true;
  }
  if (!hasConsumptionFigures(trimmed)) {
    if (
      /faixa t[ií]pica de catalogo/.test(folded) &&
      !/\d+\s*[–\-]\s*\d+/.test(trimmed)
    ) {
      return true;
    }
    if (
      (/^(para o|para a)\b/.test(folded) ||
        (/^(no|na)\b/.test(folded) &&
          /\b(motor|flex|catalogo|consumo)\b/.test(folded))) &&
      trimmed.length < 180 &&
      !/nao tenho faixa|nao foi medido|whatsapp|wa\.me/.test(folded)
    ) {
      return true;
    }
  }
  return false;
}

const MEASURED_DISCLAIMER = "Este usado não foi medido na loja.";
const MEASURED_DISCLAIMER_PLURAL =
  "Nenhum desses usados foi medido na loja.";

export function formatFocusedConsumptionReply(vehicle: ChatVehicleRecord) {
  const named = talkName(vehicle);
  const range = typicalConsumptionRange({
    fuel: vehicle.fuel,
    engine: vehicle.engine,
    version: vehicle.version,
    category: vehicle.category ?? "carro",
  });
  if (!range?.kmL || range.label === "elétrico") {
    if (range?.label === "elétrico") {
      return `Para ${named.labeled}, o catálogo não fala em km/l — é elétrico (autonomia da bateria). ${MEASURED_DISCLAIMER}`;
    }
    return `Não tenho faixa de catálogo na ficha d${named.labeled} — a loja não mediu este usado. Se quiser, o consultor confirma no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }
  const subject = joinNameAndMotor(named.labeled, range.label);
  const gas = range.gasolineKmL ?? range.kmL;
  if (range.ethanolKmL) {
    return `Para ${subject}, a faixa típica de catálogo fica ${gas} na cidade na gasolina e ${range.ethanolKmL} no álcool. ${MEASURED_DISCLAIMER}`;
  }
  return `Para ${subject}, a faixa típica de catálogo fica ${gas} na cidade. ${MEASURED_DISCLAIMER}`;
}

export function formatFocusedEquipmentReply(
  vehicle: ChatVehicleRecord,
  mensagem: string,
) {
  const folded = normalize(mensagem);
  const named = talkName(vehicle);
  const items = (vehicle.accessories ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  if (/ar condicionado|arcondicionado|\btem ar\b|\bar[- ]condicionado\b/.test(folded)) {
    const has = items.some((item) => {
      const key = normalize(item).replace(/\s+/g, "");
      return (
        key.includes("arcondicionado") ||
        key === "ar" ||
        /\bar\b/.test(normalize(item))
      );
    });
    if (has) {
      return `Sim — ${named.labeled} tem ar-condicionado na ficha. Se quiser conferir no detalhe, o consultor confirma no WhatsApp: ${CHAT_WHATSAPP_URL}`;
    }
    return `Na ficha d${named.labeled} não está escrito ar-condicionado. O consultor confirma no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }

  if (/\b(automatico|automatica|cvt)\b/.test(folded) && !/\bmanual\b/.test(folded)) {
    if (isAutomaticVehicle(vehicle)) {
      return `Sim — ${named.labeled} é ${vehicle.transmission}.`;
    }
    return `${named.cap} nesta unidade está como ${vehicle.transmission}.`;
  }

  if (/\bmanual\b/.test(folded) && !/\b(automatico|cvt)\b/.test(folded)) {
    if (isManualVehicle(vehicle)) {
      return `Sim — ${named.labeled} é ${vehicle.transmission}.`;
    }
    return `${named.cap} nesta unidade está como ${vehicle.transmission}.`;
  }

  if (items.length === 0) {
    return `Na ficha d${named.labeled} não tem opcional listado. O consultor confirma no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }
  return `${named.cap} na ficha tem ${items.slice(0, 6).join(", ")}. O que não estiver escrito a gente não inventa — o consultor confirma no WhatsApp: ${CHAT_WHATSAPP_URL}`;
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
      if (!range?.kmL) return null;
      return {
        name: talkName(vehicle).name,
        label: range.label,
        kmL: range.kmL,
        ethanolKmL: range.ethanolKmL ?? null,
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
        ethanolKmL: string | null;
        liters: number | null;
      } => row != null,
    )
    .sort((a, b) => (a.liters ?? 99) - (b.liters ?? 99));

  if (rows.length === 0) {
    return `Não tenho faixa de catálogo na ficha desses usados. ${MEASURED_DISCLAIMER_PLURAL}`;
  }
  if (rows.length === 1) {
    const row = rows[0]!;
    const ethanol = row.ethanolKmL
      ? ` gasolina / ${row.ethanolKmL} álcool`
      : "";
    return `Na cidade, o consumo de catálogo fica por aí: ${row.label} ~${row.kmL}${ethanol}. ${MEASURED_DISCLAIMER_PLURAL}`;
  }

  const groups: {
    names: string[];
    label: string;
    kmL: string;
    ethanolKmL: string | null;
  }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.kmL === row.kmL &&
      last.label === row.label &&
      last.ethanolKmL === row.ethanolKmL
    ) {
      last.names.push(row.name);
      continue;
    }
    groups.push({
      names: [row.name],
      label: row.label,
      kmL: row.kmL,
      ethanolKmL: row.ethanolKmL,
    });
  }
  const bits = groups.map((group) => {
    const motor = group.label.replace(/\s*flex$/i, "");
    const ethanol = group.ethanolKmL
      ? ` gasolina / ${group.ethanolKmL} álcool`
      : "";
    const subject = joinNameAndMotor(joinPtNames(group.names), motor);
    return `${subject} ~${group.kmL}${ethanol}`;
  });
  return `Na cidade, o consumo de catálogo fica por aí: ${bits.join(" · ")}. ${MEASURED_DISCLAIMER_PLURAL}`;
}

/** Identifica se o visitante perguntou especificamente sobre consumo / economia de combustível. */
export function asksAboutConsumption(mensagem: string): boolean {
  const folded = normalize(mensagem);
  return /\b(consumo|km\s*l|kml|quanto faz|beb\w*|economico|economica|economia|gasta|gasto|litros?|autonomia)\b/.test(
    folded,
  );
}

export function asksAboutEquipment(mensagem: string): boolean {
  const folded = normalize(mensagem);
  return /\b(ar condicionado|arcondicionado|multimidia|bluetooth|direcao|airbag|abs|couro|teto solar|sensor|camera|vidros? eletricos|piloto|acessorios?|opcionais|equipado)\b/.test(
    folded,
  );
}

export function asksAboutNamedGear(mensagem: string): boolean {
  const folded = normalize(mensagem);
  if (
    /\b(tem|e|eh|possui)\s+(automatico|automatica|manual|cvt)\b/.test(folded)
  ) {
    return true;
  }
  if (/\b(cambio|transmissao)\b/.test(folded)) return true;
  if (
    /\b(automatico|automatica|cvt|manual)\b/.test(folded) &&
    /\b(e|eh|tem|qual|quais|desse|dessa|deste|desta|nele|nela|esse|essa|este|esta)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  return /\b(manual ou auto|auto ou manual|automatico ou manual|manual ou automatico)\b/.test(
    folded,
  );
}

/** Diferença automático vs manual no estoque (não “esse é automático?”). */
export function asksAboutTransmissionCompare(mensagem: string): boolean {
  const folded = normalize(mensagem);
  const hasAuto = /\b(automatico|automatica|cvt)\b/.test(folded);
  const hasManual = /\bmanual(?:is)?\b/.test(folded);
  if (!hasAuto || !hasManual) return false;
  if (
    /\b(diferenc\w*|vs|versus|estoque atual|no estoque|do estoque)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  return /\b(automatico ou manual|manual ou automatico|auto ou manual|manual ou auto)\b/.test(
    folded,
  );
}

export function asksAboutKm(mensagem: string): boolean {
  const folded = normalize(mensagem);
  if (asksAboutConsumption(mensagem)) return false;
  if (asksAboutListedFacts(mensagem)) return false;
  return /\b(km|quilometragem|rodado|rodagem|quanto tem de km|quantos km)\b/.test(
    folded,
  );
}

export function asksAboutAvailability(mensagem: string): boolean {
  const folded = normalize(mensagem);
  if (/\bamanha\b/.test(folded)) return false;
  return /\b(ainda tem|ainda esta|ainda ta|tem ainda|ainda vende|ja vendeu|ja foi vendido|esse carro ainda|essa moto ainda|ainda esta no estoque|tem no estoque agora|esta disponivel|ta disponivel|disponivel ainda|ainda esta a venda|ainda ta a venda|tem esse (carro|modelo|ai)|essa unidade ainda)\b/.test(
    folded,
  );
}

export function asksToCompareModels(mensagem: string): boolean {
  const folded = normalize(mensagem);
  if (
    /\b(compar|vs|versus|qual dos dois|qual o melhor|melhor que)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  if (/\bdiferen/.test(folded) && !asksAboutTransmissionCompare(mensagem)) {
    return true;
  }
  return /\sou\s/.test(folded);
}

/** “qual o melhor?” / “compara” sem dois modelos — não despeja o estoque. */
export function asksWhichTwoToCompare(mensagem: string): boolean {
  const folded = normalize(mensagem);
  if (/\b(vs|versus)\b/.test(folded) || /\sou\s/.test(folded)) return false;
  if (waitlistInterestBits(mensagem).length >= 2) return false;
  return /\b(compar|qual dos dois|qual o melhor)\b/.test(folded);
}

export function asksAboutListedFacts(mensagem: string): boolean {
  const folded = normalize(mensagem);
  return /\b(preco|valor|quanto custa)\b/.test(folded);
}

export function formatFocusedKmReply(vehicle: ChatVehicleRecord) {
  const named = talkName(vehicle);
  return `${named.cap} nesta unidade está com ${formatChatKm(vehicle.km)} no hodômetro.`;
}

export function equipmentReplyLooksBroken(text: string) {
  const trimmed = text.trim();
  const folded = normalize(trimmed);
  if (!trimmed) return true;
  if (/[.!?]$/.test(trimmed) && trimmed.length >= 40) return false;
  if (/^(o|a|para o|para a)\b/.test(folded) && trimmed.length < 80) return true;
  if (/, ?dire[cç][aã]o$/i.test(trimmed)) return true;
  if (/\b(tem|possui)\b/.test(folded) && !/[.!?]$/.test(trimmed) && trimmed.length < 140) {
    return true;
  }
  return false;
}

export function formatAvailabilityReply(
  vehicle: ChatVehicleRecord | null | undefined,
  opts: { sold?: boolean } = {},
) {
  if (opts.sold) {
    return `Essa unidade já saiu do estoque. Se quiser, o consultor procura outra parecida e te avisa no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }
  if (!vehicle) {
    return CHAT_AVAILABILITY_ASK_REPLY;
  }
  const named = talkName(vehicle);
  return `Sim — ${named.labeled} ${vehicle.yearModel} ainda está no estoque (${formatChatPrice(vehicle.price)}). Confirma no WhatsApp antes de fechar, das 8h às 23h: ${CHAT_WHATSAPP_URL}`;
}

export function isFocusedVehicleFactQuestion(
  mensagem: string,
  stock: ChatVehicleRecord[] = [],
  preferredVehicleId?: string,
): boolean {
  const consumption = asksAboutConsumption(mensagem);
  const equipment = asksAboutEquipment(mensagem);
  const geared = asksAboutNamedGear(mensagem);
  const km = asksAboutKm(mensagem);
  const availability = asksAboutAvailability(mensagem);
  if (!consumption && !equipment && !geared && !km && !availability) {
    return false;
  }
  const mentioned = stock.length
    ? singleMentionedModelPool(stock, mensagem)
    : null;
  if (parsePriceLimit(mensagem) != null && !mentioned) return false;
  if (stock.length === 0) {
    return Boolean(preferredVehicleId && availability);
  }
  if (availability && preferredVehicleId && !mentioned) return true;
  return matchFocusedVehicle(mensagem, stock, preferredVehicleId) != null;
}

/** Compara os 2–3 anúncios da tela com dados reais. Consumo só se solicitado. */
export function compareChatStockPicks(
  vehicles: ChatVehicleRecord[],
  opts: { withLeadin?: boolean; includeConsumption?: boolean } = {},
) {
  if (vehicles.length === 0) return "";
  if (vehicles.length === 1) {
    const vehicle = vehicles[0]!;
    const base = `Achei no estoque: ${talkName(vehicle).cap} ${vehicle.yearModel}, ${vehicle.transmission}, ${formatChatKm(vehicle.km)}, ${formatChatPrice(vehicle.price)}.`;
    if (opts.includeConsumption) {
      return `${base}\n\n${formatFocusedConsumptionReply(vehicle)}`;
    }
    return base;
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
  const autoOnly = autos.length <= 1;
  const autoBit = autoOnly
    ? "é o automático da lista — mais conforto no trânsito"
    : "é automático — mais conforto no trânsito";

  const cheap = talkName(cheapest);
  const picks: string[] = [
    `${cheap.cap} é o mais em conta (${formatChatPrice(cheapest.price)}) — um bom começo.`,
  ];
  const mentioned = new Set<string>([cheapest.id]);

  if (lowestKm.id !== cheapest.id) {
    const low = talkName(lowestKm);
    if (mixed && auto?.id === lowestKm.id) {
      picks.push(
        `${low.cap} tem menos km (${formatChatKm(lowestKm.km)}) e ${autoBit}.`,
      );
      mentioned.add(lowestKm.id);
    } else {
      picks.push(`${low.cap} tem menos km (${formatChatKm(lowestKm.km)}).`);
      mentioned.add(lowestKm.id);
      if (mixed && auto && !mentioned.has(auto.id)) {
        picks.push(`${talkName(auto).cap} ${autoBit}.`);
        mentioned.add(auto.id);
      }
    }
  } else if (mixed && auto && auto.id !== cheapest.id) {
    picks.push(`${talkName(auto).cap} ${autoBit}.`);
    mentioned.add(auto.id);
  }

  if (mixed && auto?.id === cheapest.id) {
    picks[0] = autoOnly
      ? `${cheap.cap} é o mais em conta (${formatChatPrice(cheapest.price)}) e o automático da lista — mais conforto no trânsito.`
      : `${cheap.cap} é o mais em conta (${formatChatPrice(cheapest.price)}) e é automático — mais conforto no trânsito.`;
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

  const body = opts.includeConsumption
    ? `${picks.join(" ")}\n\n${formatConsumptionCompare(vehicles)}`
    : picks.join(" ");
  if (opts.withLeadin === false) return body;
  return `Vou te ajudar a escolher.\n\n${body}`;
}

function foldReply(value: string) {
  return normalize(value);
}

function looksTruncatedReply(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return !/[.!?]$/.test(trimmed);
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
  if (vehicles.length === 1) {
    const vehicle = vehicles[0]!;
    const model = normalize(vehicle.model);
    const brand = normalize(vehicle.brand);
    if (folded.includes(model) || folded.includes(brand)) {
      return true;
    }
    return false;
  }
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
  if (
    looksLikeMissingModelReply(reply) ||
    /nessa combinacao/.test(foldReply(reply))
  ) {
    return reply;
  }
  const wantsConsumption = asksAboutConsumption(mensagem);
  const focusedFact = isFocusedVehicleFactQuestion(
    mensagem,
    vehicles,
    vehicles.length === 1 ? vehicles[0]?.id : undefined,
  );
  if (
    wantsConsumption &&
    vehicles.length === 1 &&
    (consumptionReplyLooksBroken(reply) || !hasConsumptionFigures(reply))
  ) {
    return formatFocusedConsumptionReply(vehicles[0]!);
  }
  if (focusedFact) {
    const focused =
      vehicles.length === 1
        ? vehicles[0]!
        : (matchFocusedVehicle(mensagem, vehicles) ?? vehicles[0]!);
    if (wantsConsumption) {
      if (
        vehicles.length > 1 ||
        consumptionReplyLooksBroken(reply) ||
        !hasConsumptionFigures(reply)
      ) {
        return formatFocusedConsumptionReply(focused);
      }
      if (!/medido/.test(foldReply(reply))) {
        const closed = /[.!?]$/.test(reply.trim())
          ? reply.trim()
          : `${reply.trim()}.`;
        return `${closed} ${MEASURED_DISCLAIMER}`;
      }
      return reply;
    }
    if (asksAboutEquipment(mensagem) || asksAboutNamedGear(mensagem)) {
      if (
        vehicles.length > 1 ||
        equipmentReplyLooksBroken(reply) ||
        looksTruncatedReply(reply)
      ) {
        return formatFocusedEquipmentReply(focused, mensagem);
      }
      return reply;
    }
    if (asksAboutKm(mensagem)) {
      if (vehicles.length > 1 || looksTruncatedReply(reply) || !/\bkm\b/i.test(reply)) {
        return formatFocusedKmReply(focused);
      }
      return reply;
    }
    if (asksAboutAvailability(mensagem)) {
      return formatAvailabilityReply(focused);
    }
  }
  if (vehicles.length >= 2) {
    const intro = chatListIntro(reply) || chatFilterIntro(mensagem);
    const compare = compareChatStockPicks(vehicles, {
      withLeadin: !intro,
      includeConsumption: wantsConsumption,
    });
    if (!compare) return reply;
    return intro ? `${intro.trim()}\n\n${compare}` : compare;
  }
  if (replyAlreadyCompares(reply, vehicles)) {
    if (
      wantsConsumption &&
      (consumptionReplyLooksBroken(reply) || !hasConsumptionFigures(reply))
    ) {
      return formatFocusedConsumptionReply(vehicles[0]!);
    }
    if (wantsConsumption && !/medido/.test(foldReply(reply))) {
      const closed = /[.!?]$/.test(reply.trim())
        ? reply.trim()
        : `${reply.trim()}.`;
      return `${closed} ${MEASURED_DISCLAIMER}`;
    }
    return reply;
  }

  const foldedMsg = foldReply(mensagem);
  const foldedReply = foldReply(reply);
  const isPolicyOrService =
    /troca|financi|parcela|cartao|garantia|contato|vendedor|consultor|video|avaliacao/.test(
      foldedMsg,
    ) ||
    /troca|financi|parcela|cartao|garantia|consultor/.test(foldedReply);

  if (isPolicyOrService) {
    return reply;
  }

  const extra = compareChatStockPicks(vehicles, {
    includeConsumption: wantsConsumption,
  });
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
    return (
      emptyFilterReply(mensagem, stock) ??
      `Nessa faixa até ${ceiling} ainda não tem anúncio agora. Sem estresse: posso olhar outra faixa com você, ou um consultor te ajuda no WhatsApp: ${CHAT_WHATSAPP_URL}`
    );
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
  const wantsConsumption = asksAboutConsumption(mensagem);
  return `Beleza — até ${ceiling}, estes aqui fazem sentido pra começar.\n${lines.join("\n")}\n\n${compareChatStockPicks(picks, { withLeadin: false, includeConsumption: wantsConsumption })}`;
}

export function listStockByCheap(mensagem: string, stock: ChatVehicleRecord[]) {
  if (!parseCheapIntent(mensagem) || parsePriceLimit(mensagem) != null) {
    return null;
  }
  const matches = applyChatStockFilters(stock, mensagem).sort(
    (a, b) => a.price - b.price,
  );
  if (matches.length === 0) return null;
  const picks = matches.slice(0, 3);
  const lines = picks.map((vehicle) => formatVehicleLine(vehicle));
  const wantsConsumption = asksAboutConsumption(mensagem);
  return `Beleza — olha as opções mais em conta que achei agora.\n${lines.join("\n")}\n\n${compareChatStockPicks(picks, { withLeadin: false, includeConsumption: wantsConsumption })}`;
}

export function findSimilarVehicles(
  mensagem: string,
  stock: ChatVehicleRecord[],
  limit = 3,
): ChatVehicleRecord[] {
  const category = parseVehicleCategoryFilter(mensagem);
  const mentioned = singleMentionedModelPool(stock, mensagem);
  const mentionedIds = new Set((mentioned ?? []).map((vehicle) => vehicle.id));
  const pool = applyChatStockFilters(stock, mensagem)
    .filter((vehicle) => !mentionedIds.has(vehicle.id))
    .filter((vehicle) =>
      category ? (vehicle.category ?? "carro") === category : true,
    )
    .sort((a, b) => a.price - b.price);
  return pool.slice(0, limit);
}

export function similarAfterEmptyFilter(
  mensagem: string,
  stock: ChatVehicleRecord[],
  limit = 3,
): ChatVehicleRecord[] {
  const mentioned = singleMentionedModelPool(stock, mensagem);
  const mentionedIds = new Set((mentioned ?? []).map((vehicle) => vehicle.id));
  return relaxChatStockFilters(stock, mensagem)
    .filter((vehicle) => !mentionedIds.has(vehicle.id))
    .sort((a, b) => a.price - b.price)
    .slice(0, limit);
}

const WAITLIST_STOP =
  /^(tem|temos|vende|vendem|quero|procuro|mostrar|mostra|ver|me|os|as|uns|um|uma|de|do|da|dos|das|no|na|em|por|com|ate|ainda|disponivel|anuncio|estoque|carro|carros|moto|motos|automatico|automatica|manual|cvt|mil|k|reais|voces|voce|qual|quais|esse|essa|este|esta|ai|agora|chegou|chegar|sim|nao|mais|barato|baratinho)$/;

function waitlistInterestBits(mensagem: string) {
  return normalize(mensagem)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        !WAITLIST_STOP.test(token) &&
        !/^\d+$/.test(token),
    );
}

/** “automático até R$ 40.000” — texto humano pro WhatsApp da lista de espera. */
export function formatChatWaitlistQuery(mensagem: string) {
  const bits: string[] = [];
  const named = waitlistInterestBits(mensagem);
  if (named.length > 0) {
    bits.push(named.slice(0, 3).join(" "));
  }
  const category = parseVehicleCategoryFilter(mensagem);
  const gear = parseTransmissionFilter(mensagem);
  const limit = parsePriceLimit(mensagem);
  if (category === "moto" && !/\bmoto\b/.test(bits.join(" "))) bits.push("moto");
  if (category === "carro" && !/\bcarro\b/.test(bits.join(" "))) {
    bits.push("carro");
  }
  if (gear === "automatico" && !named.includes("automatico")) {
    bits.push("automático");
  }
  if (gear === "manual" && !named.includes("manual")) bits.push("manual");
  if (limit != null) bits.push(`até ${formatChatPrice(limit)}`);
  if (parseCheapIntent(mensagem) && limit == null) bits.push("mais em conta");
  return bits.join(" ").replace(/\s+/g, " ").trim();
}

export function chatWaitlistWhatsAppUrl(mensagem: string) {
  const query = formatChatWaitlistQuery(mensagem);
  return whatsappUrl(WHATSAPP_MESSAGES.wanted(query || undefined));
}

export function matchedChatStock(
  mensagem: string,
  stock: ChatVehicleRecord[],
) {
  const filtered = applyChatStockFilters(stock, mensagem);
  const limit = parsePriceLimit(mensagem);
  if (limit == null) return filtered;
  return filtered.filter((vehicle) => vehicle.price <= limit);
}

export function emptyFilterReply(
  mensagem: string,
  stock: ChatVehicleRecord[],
): string | null {
  if (!hasChatStockFilter(mensagem)) return null;
  if (
    asksAboutAvailability(mensagem) &&
    parseTransmissionFilter(mensagem) == null &&
    parsePriceLimit(mensagem) == null
  ) {
    return null;
  }
  if (matchedChatStock(mensagem, stock).length > 0) return null;
  const query = formatChatWaitlistQuery(mensagem);
  const recorte = query ? ` (${query})` : "";
  const similar = similarAfterEmptyFilter(mensagem, stock, 3);
  const wait = `Se quiser, o consultor anota e te avisa no WhatsApp quando chegar: ${chatWaitlistWhatsAppUrl(mensagem)}`;
  if (similar.length === 0) {
    return `Nessa combinação${recorte} ainda não tem anúncio agora. ${wait}`;
  }
  return `Nessa combinação${recorte} ainda não tem anúncio agora. Na mesma ideia, olha o que tem no estoque. ${wait}`;
}

export function looksLikeMissingModelReply(reply: string): boolean {
  const folded = normalize(reply);
  return /\b(nao esta na lista atual|nao tem anuncio|nao temos (esse|este) modelo|modelo nao esta|nessa combinacao ainda nao tem)\b/.test(
    folded,
  );
}

export function missingModelReply(
  mensagem: string,
  stock: ChatVehicleRecord[],
): string {
  const similar = findSimilarVehicles(mensagem, stock, 3);
  const wait = `o consultor anota e te avisa no WhatsApp quando chegar: ${chatWaitlistWhatsAppUrl(mensagem)}`;
  if (similar.length === 0) {
    return `Esse modelo não está na lista atual. Posso olhar outro na mesma ideia, ou ${wait}`;
  }
  return `Esse modelo não está na lista atual. Na mesma ideia, olha o que tem no estoque — ou ${wait}`;
}

export function enrichMissingModelReply(
  reply: string,
  mensagem: string,
  stock: ChatVehicleRecord[],
): { reply: string; vehicles: ChatVehicleRecord[] } {
  if (!looksLikeMissingModelReply(reply)) {
    return { reply, vehicles: [] };
  }
  const similar = findSimilarVehicles(mensagem, stock, 3);
  if (similar.length === 0) {
    if (!/whatsapp|wa\.me/i.test(reply)) {
      return {
        reply: `${reply.trim()} O consultor anota e te avisa no WhatsApp quando chegar: ${chatWaitlistWhatsAppUrl(mensagem)}`,
        vehicles: [],
      };
    }
    return { reply, vehicles: [] };
  }
  const alreadyLists = similar.some((vehicle) =>
    normalize(reply).includes(normalize(vehicle.model)),
  );
  if (alreadyLists) return { reply, vehicles: similar };
  const wait = /whatsapp|wa\.me/i.test(reply)
    ? reply
    : `${reply.trim()} O consultor anota e te avisa no WhatsApp quando chegar: ${chatWaitlistWhatsAppUrl(mensagem)}`;
  return { reply: wait, vehicles: similar };
}

export const CHAT_FINANCE_REPLY =
  `Dá sim — são duas formas diferentes: financiamento em até 60 vezes, e cartão de crédito em até 18 vezes. Não misturamos os prazos e não inventamos taxa nem valor de parcela. O usado também pode entrar na conta. A condição certinha o consultor monta no WhatsApp com o modelo que você escolher, bem no seu caso. ${CHAT_WHATSAPP_URL}`;

export const CHAT_CARD_REPLY =
  `Dá sim — no cartão de crédito a gente parcela em até 18 vezes. Isso é diferente do financiamento, que vai em até 60 vezes. Não inventamos taxa nem valor de parcela; o consultor confirma a melhor forma no WhatsApp, no seu caso. O usado também pode entrar na conta. ${CHAT_WHATSAPP_URL}`;

export const CHAT_TRADE_REPLY =
  `Aceitamos sim — carro ou moto entram na conta. Manda umas fotos no WhatsApp que o consultor avalia e já encaixa no negócio com você. ${CHAT_WHATSAPP_URL}`;

export const CHAT_WARRANTY_REPLY =
  `Fica tranquilo: todos os seminovos saem com garantia de 3 meses de motor e câmbio. Procedência conferida antes de entrar no estoque. Se quiser o detalhe no seu caso, o consultor confirma no WhatsApp, das 8h às 23h: ${CHAT_WHATSAPP_URL}`;

export const CHAT_DOCS_REPLY =
  `A transferência a gente combina com o consultor. Leva RG/CPF (ou CNH) e comprovante de residência; custos de Detran e despachante variam por caso — sem taxa padronizada no site. Confirma os passos no WhatsApp, das 8h às 23h: ${CHAT_WHATSAPP_URL}`;

export const CHAT_COMPARE_ASK_REPLY =
  "Me diz os dois modelos que você quer comparar — por exemplo HB20 ou Onix — que eu cruzo o estoque agora, com preço e km reais.";

export const CHAT_AVAILABILITY_ASK_REPLY =
  "Me diz o modelo que você quer conferir — eu olho no estoque agora e te falo se ainda tem.";

export function formatTransmissionCompareReply(
  stock: ChatVehicleRecord[],
  mensagem = "",
) {
  const mentioned = singleMentionedModelPool(stock, mensagem);
  const pool = mentioned ?? filterStockByCategory(stock, mensagem);
  const autos = pool.filter(isAutomaticVehicle);
  const manuals = pool.filter(isManualVehicle);
  const autoPick = [...autos].sort((a, b) => a.price - b.price).slice(0, 2);
  const manualPick = [...manuals].sort((a, b) => a.price - b.price).slice(0, 2);

  if (autos.length === 0 && manuals.length === 0) {
    return (
      emptyFilterReply(mensagem, stock) ??
      `Agora não tenho automático nem manual nessa recorte. O consultor anota e te avisa no WhatsApp quando chegar: ${CHAT_WHATSAPP_URL}`
    );
  }

  const bits: string[] = [];
  bits.push(
    "No automático o trânsito cansa menos; no manual você controla mais a troca de marcha e em geral o anúncio sai mais em conta.",
  );
  if (autoPick.length === 0) {
    bits.push(
      "Neste recorte do estoque agora só tem manual — automático a gente avisa no WhatsApp quando entrar.",
    );
  } else if (manualPick.length === 0) {
    bits.push(
      "Neste recorte do estoque agora só tem automático — manual a gente avisa no WhatsApp quando entrar.",
    );
  } else {
    bits.push("Olha o que tem agora, um de cada lado:");
  }
  const lines = [...autoPick, ...manualPick].map((vehicle) =>
    formatVehicleLine(vehicle),
  );
  const wait =
    autoPick.length === 0 || manualPick.length === 0
      ? ` Se faltar o câmbio que você quer, o consultor te avisa no WhatsApp: ${CHAT_WHATSAPP_URL}`
      : "";
  if (lines.length === 0) {
    return `${bits.join(" ")}${wait}`.trim();
  }
  return `${bits.join(" ")}\n${lines.join("\n")}${wait ? `\n\n${wait.trim()}` : ""}`;
}

/** Atalhos do chat (chips) — política fixa, sem perguntar de novo o modelo. */
export function chatPolicyShortcut(
  mensagem: string,
): "finance" | "card" | "troca" | "warranty" | "docs" | "gear" | null {
  const folded = normalize(mensagem);
  if (
    /^(aceita cartao|aceitam cartao|cartao de credito|parcela no cartao|da para parcelar no cartao|da pra parcelar no cartao|aceita cartao de credito)$/.test(
      folded,
    )
  ) {
    return "card";
  }
  if (
    /\b(financi\w*|parcela|60x)\b/.test(folded) &&
    /\b(cartao|credito|18x)\b/.test(folded)
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
  if (
    /\bgarantia\b/.test(folded) &&
    !/\b(troca|financi|cartao|fipe|preco|valor|estoque)\b/.test(folded)
  ) {
    return "warranty";
  }
  if (
    /\b(documentacao|transferencia|transferir|detran|despachante)\b/.test(
      folded,
    ) &&
    !/\b(fipe|preco|valor)\b/.test(folded)
  ) {
    return "docs";
  }
  if (asksAboutTransmissionCompare(mensagem)) return "gear";
  return null;
}

const NAMED_STOCK_SEEK =
  /\b(tem|vende|procuro|quero|ainda|estoque|chegou|modelo)\b/;
const POLICY_SEEK =
  /\b(financi|parcela|cartao|troca|garantia|document|horario|whatsapp|atendimento|transferenc|despachante|detran)\b/;

/** “tem civic?” sem civic no estoque — waitlist, sem despejar o inventário. */
export function seeksMissingNamedModel(
  mensagem: string,
  stock: ChatVehicleRecord[],
) {
  const folded = normalize(mensagem);
  if (POLICY_SEEK.test(folded)) return false;
  if (chatPolicyShortcut(mensagem)) return false;
  if (asksAboutTransmissionCompare(mensagem)) return false;
  if (parsePriceLimit(mensagem) != null && waitlistInterestBits(mensagem).length === 0) {
    return false;
  }
  const tokens = waitlistInterestBits(mensagem);
  if (tokens.length === 0) return false;
  if (!NAMED_STOCK_SEEK.test(folded)) return false;
  if (singleMentionedModelPool(stock, mensagem)) return false;
  if (matchFocusedVehicle(mensagem, stock)) return false;
  if (matchInterestVehicle(mensagem, stock, 2)) return false;
  return true;
}

/** Resposta da loja sem Gemini — só dados reais do estoque e política fixa. */
export function localGarageReply(
  mensagem: string,
  stock: ChatVehicleRecord[],
  activeVehicle?: ChatVehicleRecord,
) {
  const text = normalize(mensagem);
  const policy = chatPolicyShortcut(mensagem);
  if (policy === "card") return CHAT_CARD_REPLY;
  if (policy === "finance") return CHAT_FINANCE_REPLY;
  if (policy === "troca") return CHAT_TRADE_REPLY;
  if (policy === "warranty") return CHAT_WARRANTY_REPLY;
  if (policy === "docs") return CHAT_DOCS_REPLY;
  if (policy === "gear") return formatTransmissionCompareReply(stock, mensagem);

  if (/\b(cartao|credito|18x)\b/.test(text)) {
    return CHAT_CARD_REPLY;
  }
  if (/\b(financi\w*|parcela|juros|60x)\b/.test(text)) {
    return CHAT_FINANCE_REPLY;
  }

  const empty = emptyFilterReply(mensagem, stock);
  if (empty) return empty;

  const byBudget = listStockByBudget(mensagem, stock);
  if (byBudget) return byBudget;
  const byCheap = listStockByCheap(mensagem, stock);
  if (byCheap) return byCheap;
  if (/\bgarantia\b/.test(text)) {
    return CHAT_WARRANTY_REPLY;
  }
  if (/\b(horario|atendimento|endereco|localizacao)\b/.test(text)) {
    return `A gente atende online todos os dias, das 8h às 23h — Aracruz, Vitória, Linhares, Serra e Vila Velha. Loja digital, visita combinada. Um consultor confirma o melhor jeito no WhatsApp: ${CHAT_WHATSAPP_URL}`;
  }
  if (/\btroca\b/.test(text)) {
    return CHAT_TRADE_REPLY;
  }
  if (/\b(documentacao|transferencia|detran|despachante)\b/.test(text)) {
    return CHAT_DOCS_REPLY;
  }

  const match =
    matchFocusedVehicle(mensagem, stock, activeVehicle?.id) ??
    (activeVehicle && matchInterestVehicle(mensagem, [activeVehicle], 1)
      ? activeVehicle
      : null) ??
    matchInterestVehicle(mensagem, stock, 2, activeVehicle?.id) ??
    matchInterestVehicle(mensagem, stock, 1, activeVehicle?.id);
  if (match) {
    if (asksAboutConsumption(mensagem)) {
      const consumption = formatFocusedConsumptionReply(match);
      if (asksAboutListedFacts(mensagem) || /\bkm\b/.test(text)) {
        return `Achei no estoque: ${match.brand} ${match.model} ${match.yearModel}, ${match.km.toLocaleString("pt-BR")} km, ${formatChatPrice(match.price)}, ${match.transmission}.\n\n${consumption}`;
      }
      return consumption;
    }
    if (asksAboutEquipment(mensagem) || asksAboutNamedGear(mensagem)) {
      return formatFocusedEquipmentReply(match, mensagem);
    }
    return `Achei no estoque: ${match.brand} ${match.model} ${match.yearModel}, ${match.km.toLocaleString("pt-BR")} km, ${formatChatPrice(match.price)}, ${match.transmission}.`;
  }

  const looksLikeVehicle = /\b(tem|vende|estoque|carro|modelo|marca|km)\b/.test(
    text,
  );
  const specific = text
    .split(" ")
    .filter((token) => token.length >= 3 && !GENERIC_STOCK_TOKEN.test(token));
  if (looksLikeVehicle && specific.length > 0) {
    return missingModelReply(mensagem, stock);
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
