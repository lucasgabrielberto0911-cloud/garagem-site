import type { ChatVehicleRecord } from "@/lib/chat-stock";
import { formatModelName } from "@/lib/format";

const fold = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const COLORS: Array<{ ask: RegExp; stock: RegExp; male: string; female: string }> = [
  { ask: /\bpret[oa]s?\b/, stock: /\bpret/, male: "preto", female: "preta" },
  { ask: /\bbranc[oa]s?\b/, stock: /\bbranc/, male: "branco", female: "branca" },
  { ask: /\bpratas?\b|\bprateado\b/, stock: /\bprat/, male: "prata", female: "prata" },
  { ask: /\bcinzas?\b|\bgrafite\b|\bchumbo\b/, stock: /\bcinza|grafite|chumbo/, male: "cinza", female: "cinza" },
  { ask: /\bvermelh[oa]s?\b|\bvinho\b/, stock: /\bvermelh|vinho/, male: "vermelho", female: "vermelha" },
  { ask: /\bazu(?:l|is)\b/, stock: /\bazul/, male: "azul", female: "azul" },
  { ask: /\bverdes?\b/, stock: /\bverde/, male: "verde", female: "verde" },
  { ask: /\bamarel[oa]s?\b/, stock: /\bamarel/, male: "amarelo", female: "amarela" },
  { ask: /\bbeges?\b/, stock: /\bbege/, male: "bege", female: "bege" },
  { ask: /\bmarrom\b/, stock: /\bmarrom/, male: "marrom", female: "marrom" },
  { ask: /\blaranjas?\b/, stock: /\blaranja/, male: "laranja", female: "laranja" },
];

function isMoto(vehicle: ChatVehicleRecord) {
  return (vehicle.category ?? "carro") === "moto";
}

function displayName(vehicle: ChatVehicleRecord) {
  return formatModelName(vehicle.model.trim());
}

function colorWord(vehicle: ChatVehicleRecord) {
  const raw = (vehicle.color ?? "").trim();
  if (!raw) return null;
  const hit = COLORS.find((color) => color.stock.test(fold(raw)));
  if (!hit) return raw.toLowerCase();
  // "Azul Meia-Noite" mantém o nome da ficha.
  return fold(raw).split(/\s+/).length > 1 ? raw.toLowerCase() : isMoto(vehicle) ? hit.female : hit.male;
}

/** Cor pedida na mensagem ("tem carro preto?", "moto vermelha"). */
export function parseColorWish(mensagem: string) {
  const text = fold(mensagem);
  // "carro preto" é cor; "pretendo" não; "pneus pretos" etc. ficam fora por exigirem veículo ou pergunta de cor.
  const color = COLORS.find((item) => item.ask.test(text));
  if (!color) return null;
  return color;
}

export function asksColorOf(mensagem: string) {
  return /\b(qual (?:e |é )?a cor|que cor|cor del[ae]|cor d[oa]|qual cor)\b/.test(fold(mensagem));
}

/**
 * "qual a cor do Nivus?" (modelo citado) → cor pela ficha.
 * "tem carro preto?" → os da cor pedida, mais novos primeiro (3 cards).
 * Sem nenhum na cor → diz as cores que temos, sem cards de outra cor como se fossem da pedida.
 */
export function colorReply(
  mensagem: string,
  stock: ChatVehicleRecord[],
  named: ChatVehicleRecord[] | null,
  category: "carro" | "moto" | null,
  filtered = false,
  allStock: ChatVehicleRecord[] = stock,
): { reply: string; vehicles: ChatVehicleRecord[] } | null {
  const wish = parseColorWish(mensagem);
  const asksOf = asksColorOf(mensagem);
  if (named?.length && (asksOf || wish)) {
    const units = named.filter((vehicle) => vehicle.color && vehicle.color.trim());
    if (!units.length) return null;
    const first = units[0]!;
    const article = isMoto(first) ? "A" : "O";
    if (units.length === 1) {
      const color = colorWord(first)!;
      if (wish && !wish.stock.test(fold(first.color!))) {
        return { reply: `${article} ${displayName(first)} que temos é ${color}.`, vehicles: [first] };
      }
      return { reply: wish ? `Sim, ${article.toLowerCase()} ${displayName(first)} que temos é ${color}.` : `${article} ${displayName(first)} que temos é ${color}.`, vehicles: [first] };
    }
    const lines = units.map((vehicle) => `${vehicle.yearModel} ${colorWord(vehicle)}`);
    return { reply: `Temos ${units.length} ${displayName(first)}: ${lines.join(", ")}.`, vehicles: units.slice(0, 3) };
  }
  if (!wish || named?.length) return null;
  const pool = stock.filter((vehicle) => !category || (isMoto(vehicle) ? "moto" : "carro") === category);
  const found = pool
    .filter((vehicle) => wish.stock.test(fold(vehicle.color ?? "")))
    .sort((a, b) => b.yearModel - a.yearModel || a.km - b.km);
  const noun = category === "moto" ? "moto" : category === "carro" ? "carro" : "veículo";
  const label = category === "moto" ? wish.female : wish.male;
  const scope = filtered ? "Nesse recorte, " : "";
  if (!found.length) {
    const colors = [...new Set(pool.map((vehicle) => colorWord(vehicle)).filter(Boolean))].slice(0, 5);
    // Carro vermelho não, mas moto vermelha sim: diz.
    const other = !filtered && category ? allStock.filter((vehicle) => (isMoto(vehicle) ? "moto" : "carro") !== category && wish.stock.test(fold(vehicle.color ?? ""))) : [];
    const otherText = other.length
      ? ` Na cor ${wish.female}, temos ${other.length === 1 ? `a ${displayName(other[0]!)}` : `${other.length} ${category === "carro" ? "motos" : "carros"}`}.`
      : "";
    const head = filtered ? `Nesse recorte, ${noun} ${label} não temos agora.` : `${noun.charAt(0).toUpperCase() + noun.slice(1)} ${label} não temos agora.`;
    return {
      reply: `${head}${colors.length ? ` As cores ${filtered ? "nesse recorte" : "do estoque hoje"}: ${colors.join(", ")}.` : ""}${otherText} Se quiser, o consultor te avisa quando chegar.`,
      vehicles: other.slice(0, 3),
    };
  }
  const shown = found.slice(0, 3);
  const count = found.length === 1 ? `1 ${noun}` : `${found.length} ${noun}s`;
  return {
    reply: `${scope}${scope ? "na" : "Na"} cor ${wish.female} temos ${count}${found.length > 3 ? ", separei os mais novos" : ""}.`,
    vehicles: shown,
  };
}

/** Marca do estoque citada sozinha ("tem Hyundai?", "carros da Honda"). */
export function mentionedStockBrand(mensagem: string, stock: ChatVehicleRecord[]): string | null {
  const text = fold(mensagem);
  for (const brand of new Set(stock.map((vehicle) => fold(vehicle.brand).trim()))) {
    if (!brand) continue;
    if (new RegExp(`\\b${brand}\\b`).test(text) || (brand === "volkswagen" && /\bvw\b/.test(text))) return brand;
  }
  return null;
}
