/**
 * Guardas determinísticas sobre o texto que o modelo de linguagem escreve (não valem para as
 * respostas montadas pelo código, que já saem das fichas e do estoque):
 *
 * 1. Afirmações sobre a UNIDADE que os dados do anúncio não trazem (laudo, batida, revisão feita,
 *    "original", dono único, garantia de fábrica…) viram "confirmo com o consultor".
 * 2. Marca errada de modelo conhecido ("Honda Corolla") é trocada pela marca dos dados.
 */

import { VEHICLE_SPECS } from "@/lib/chat-specs";
import type { ChatVehicleRecord } from "@/lib/chat-stock";

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export const UNIT_CLAIM_REPLACEMENT =
  "Sobre laudo, histórico e revisões desta unidade eu não tenho esse dado aqui, então o consultor confirma com a loja pelo WhatsApp.";

/**
 * Frases (sem acento) que afirmam algo da unidade. Nenhum campo do anúncio traz laudo, histórico,
 * revisão ou procedência, então qualquer afirmação assim seria invenção.
 */
const UNIT_CLAIMS: RegExp[] = [
  /\blaudos?\b/,
  /\b(?:sem|nenhum|nenhuma|zero)\s+(?:historico\s+de\s+|registro\s+de\s+)?(?:batidas?|sinistros?|leilao|leiloes|colisao|colisoes|acidentes?|remarcacao|enchente|alagamento)/,
  /\bnao\s+(?:tem|teve|possui|passou\s+por|sofreu|foi)\s+(?:historico\s+de\s+)?(?:batidas?|sinistros?|leilao|colisao|acidentes?|batido|sinistrad\w+)/,
  /\b(?:nunca|jamais)\s+(?:foi\s+)?(?:batid[oa]|sinistrad[oa]|bateu|colidiu)/,
  /\bdono\s+unico|\bunico\s+(?:dono|proprietario)|\bprimeiro\s+dono|\bum\s+unico\s+dono|\bsegundo\s+dono/,
  /\b(?:todo|toda|tudo|pintura|motor|lataria|pecas|interior)\s+original\b|\boriginal\s+de\s+fabrica|\bsem\s+retoques?\b|\bsem\s+repintura/,
  /\brevisad[oa]s?\b|\brevisoes?\s+(?:em\s+dia|feitas?|realizadas?|na\s+concessionaria|completas?)|\brevisao\s+(?:feita|completa|em\s+dia|realizada)|\bmanutencao\s+(?:em\s+dia|toda\s+feita|completa)|\bhistorico\s+de\s+(?:manutencao|revisoes)/,
  /\bconferencia\s+de\s+qualidade|\bpassou\s+por\s+(?:uma\s+)?(?:inspecao|vistoria|checklist|conferencia|revisao|avaliacao)|\binspecionad[oa]s?\b|\bvistoriad[oa]s?\b|\bcheck-?up\b/,
  /\bgarantia\s+(?:de\s+fabrica|estendida|de\s+procedencia|total|integral)|\bprocedencia\s+(?:e\s+|eh\s+)?(?:garantida|comprovada|confirmada|conhecida)/,
];

/** A frase já diz que não sabe ou que confirma depois: não é afirmação. */
const UNIT_HEDGE =
  /\bnao\s+(?:tenho|consta|constam|sei|posso\s+(?:afirmar|garantir|confirmar))|\bnao\s+(?:tem|ha)\s+(?:essa|esse|esta|este)\s+(?:informacao|dado)|\bpreciso\s+confirmar|\bconfirmo\s+com|\bconsultor\s+(?:confirma|verifica|te\s+passa\s+isso)|\bvale\s+(?:pedir|perguntar|conferir)|\bo\s+ideal\s+e\s+(?:pedir|conferir|perguntar)|\bpergunte|\bpeca\s+(?:ao|pro)\s+consultor|\bsem\s+essa\s+informacao/;

function splitSentences(text: string): string[] {
  return text.match(/[^.!?\n]+(?:[.!?]+["”')\]]*|$)|\n+/g) ?? [text];
}

/** Troca a(s) frase(s) que afirmam algo da unidade pela frase segura, uma única vez. */
export function guardUnitClaims(text: string): string {
  if (!text.trim()) return text;
  let replaced = false;
  const parts = splitSentences(text).map((sentence) => {
    const folded = fold(sentence);
    if (!UNIT_CLAIMS.some((pattern) => pattern.test(folded))) return sentence;
    if (UNIT_HEDGE.test(folded)) return sentence;
    if (replaced) return "";
    replaced = true;
    const lead = /^\s*/.exec(sentence)?.[0] ?? "";
    return `${lead}${UNIT_CLAIM_REPLACEMENT}`;
  });
  if (!replaced) return text;
  return parts.join("").replace(/[ \t]{2,}/g, " ").replace(/\s+\n/g, "\n").trim();
}

const EXTRA_BRANDS = [
  "honda",
  "toyota",
  "hyundai",
  "nissan",
  "chevrolet",
  "fiat",
  "volkswagen",
  "ford",
  "renault",
  "jeep",
  "peugeot",
  "citroen",
  "mitsubishi",
  "kia",
  "yamaha",
  "suzuki",
];

const BRAND_ALIASES: Record<string, string> = { vw: "volkswagen", gm: "chevrolet" };

function canonicalBrand(value: string) {
  const key = fold(value).trim();
  return BRAND_ALIASES[key] ?? key;
}

function displayBrand(key: string, stock: ChatVehicleRecord[]) {
  const fromStock = stock.find((vehicle) => canonicalBrand(vehicle.brand) === key)?.brand;
  if (fromStock) return fromStock;
  return key === "citroen" ? "Citroën" : key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * "Honda Corolla" → "Toyota Corolla". Só mexe quando o modelo é conhecido (estoque ou ficha) e
 * a marca escrita é de outra marca conhecida; modelo desconhecido fica como está.
 */
export function fixVehicleBrands(text: string, stock: ChatVehicleRecord[] = []): string {
  if (!text.trim()) return text;
  const brands = new Set<string>(EXTRA_BRANDS);
  for (const spec of VEHICLE_SPECS) brands.add(canonicalBrand(spec.brand));
  for (const vehicle of stock) brands.add(canonicalBrand(vehicle.brand));
  const aliases = Object.keys(BRAND_ALIASES);
  const names = [...brands, ...aliases].map((name) => (name === "citroen" ? "citro[eë]n" : name));
  const pattern = new RegExp(`\\b(${names.join("|")})\\s+([\\p{L}\\p{N}][\\p{L}\\p{N}.-]*(?:\\s+[\\p{L}\\p{N}][\\p{L}\\p{N}.-]*)?)`, "giu");

  return text.replace(pattern, (whole, brandRaw: string, tail: string) => {
    const written = canonicalBrand(brandRaw.replace(/ë/i, "e"));
    const foldedTail = fold(tail);
    // Marca certa do modelo: primeiro o estoque, depois as fichas.
    const owners = new Set<string>();
    for (const vehicle of stock) {
      const model = fold(vehicle.model).trim();
      if (model && new RegExp(`^${model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(foldedTail)) {
        owners.add(canonicalBrand(vehicle.brand));
      }
    }
    for (const spec of VEHICLE_SPECS) {
      if (spec.model.test(foldedTail.split(/\s+/).slice(0, 2).join(" "))) {
        owners.add(canonicalBrand(spec.brand));
      }
    }
    if (owners.size !== 1) return whole;
    const [owner] = [...owners];
    if (!owner || owner === written) return whole;
    return `${displayBrand(owner, stock)} ${tail}`;
  });
}

/** Tudo que se aplica ao texto do modelo de linguagem antes de chegar ao visitante. */
export function guardLlmReply(text: string, stock: ChatVehicleRecord[] = []): string {
  return guardUnitClaims(fixVehicleBrands(text, stock));
}
