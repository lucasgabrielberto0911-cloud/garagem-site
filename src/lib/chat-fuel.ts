import type { ChatVehicleRecord } from "@/lib/chat-stock";
import { formatModelName } from "@/lib/format";
import { site } from "@/lib/site";

const fold = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** "a Biz 125 é flex?", "aceita etanol?", "qual o combustível?": pergunta de combustível de um carro. */
export function asksAboutFuel(mensagem: string): boolean {
  const text = fold(mensagem);
  return (
    /\b(?:e|eh|ela e|ele e)\s+(?:flex|bicombustivel|a gasolina|so gasolina|gasolina|a alcool|alcool|a etanol|etanol|diesel|a diesel)\b/.test(text) ||
    /\b(?:aceita|roda com|anda com|pode (?:por|colocar|abastecer com)|da (?:pra|para) (?:por|colocar|abastecer com)|abastece com)\s+(?:alcool|etanol|gasolina)\b/.test(text) ||
    /\b(?:qual (?:o |e o )?combustivel|que combustivel|combustivel dela|combustivel dele)\b/.test(text)
  );
}

function spokenName(vehicle: ChatVehicleRecord) {
  const name = formatModelName(vehicle.model.trim());
  return `${vehicle.category === "moto" ? "a" : "o"} ${name}`;
}

function fuelLabel(fuel: string) {
  const text = fold(fuel);
  if (/flex/.test(text)) return "flex (gasolina e etanol)";
  if (/gasolina/.test(text)) return "a gasolina";
  if (/etanol|alcool/.test(text)) return "a etanol";
  if (/diesel/.test(text)) return "a diesel";
  return fuel.trim().toLowerCase();
}

/** Resposta direta pela ficha (campo combustível). Sem ficha, null (segue o fluxo). */
export function fuelFactReply(mensagem: string, units: ChatVehicleRecord[]): string | null {
  if (!asksAboutFuel(mensagem)) return null;
  const known = units.filter((vehicle) => vehicle.fuel && vehicle.fuel.trim());
  if (!known.length || known.length !== units.length) return null;
  const labels = [...new Set(known.map((vehicle) => fuelLabel(vehicle.fuel!)))];
  const first = known[0]!;
  const name = spokenName(first);
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  const bare = name.replace(/^(o|a) /, "");
  if (labels.length === 1) {
    const label = labels[0]!;
    const text = fold(mensagem);
    const askedFlex = /\b(flex|bicombustivel|alcool|etanol)\b/.test(text);
    if (known.length > 1) {
      return askedFlex && label.startsWith("flex")
        ? `Sim, as ${known.length} unidades do ${bare} que temos são ${label}.`
        : `As ${known.length} unidades do ${bare} que temos são ${label}, conforme a ficha.`;
    }
    return askedFlex && label.startsWith("flex")
      ? `Sim, ${name} é ${label}.`
      : `${cap} é ${label}, conforme a ficha.`;
  }
  const lines = known.map((vehicle) => `${spokenName(vehicle).replace(/^(o|a) /, "")} ${vehicle.yearModel} é ${fuelLabel(vehicle.fuel!)}`);
  return `Temos ${known.length}: ${lines.join("; ")}.`;
}

/** Todas as unidades do mesmo nome-base ("Biz" → BIZ 125 e BIZ 110i). */
export function fuelUnits(pool: ChatVehicleRecord[], stock: ChatVehicleRecord[]): ChatVehicleRecord[] {
  if (!pool.length) return [];
  const base = fold(pool[0]!.model).split(/\s+/)[0];
  const kind = pool[0]!.category ?? "carro";
  const all = stock.filter((vehicle) => (vehicle.category ?? "carro") === kind && fold(vehicle.model).split(/\s+/)[0] === base);
  return all.length ? all : pool;
}

/** "tem algum diesel?" sem diesel no estoque: resposta direta com os combustíveis que temos. */
export function dieselWishReply(mensagem: string, stock: ChatVehicleRecord[], named: boolean): string | null {
  if (named || !/\bdiesel\b/.test(fold(mensagem))) return null;
  if (stock.some((vehicle) => /diesel/.test(fold(vehicle.fuel ?? "")))) return null;
  const fuels = [...new Set(stock.map((vehicle) => fuelLabel(vehicle.fuel ?? "")).filter(Boolean))]
    .map((label) => label.replace(/ \(gasolina e etanol\)/, "").replace(/^a /, ""));
  return `Diesel não temos agora: o estoque da Garagem hoje é ${fuels.join(" e ")}. Se quiser, o consultor te avisa quando chegar um diesel: https://wa.me/${site.whatsappNumber}`;
}

/** "é flex?" depois de uma lista: responde unidade por unidade do que foi mostrado. */
export function fuelListReply(mensagem: string, shown: ChatVehicleRecord[]): string | null {
  if (!asksAboutFuel(mensagem) || shown.length < 2) return null;
  if (shown.some((vehicle) => !vehicle.fuel || !vehicle.fuel.trim())) return null;
  const lines = shown.map((vehicle) => `${spokenName(vehicle).replace(/^(o|a) /, "")} ${vehicle.yearModel} é ${fuelLabel(vehicle.fuel!)}`);
  return `Dos que separei: ${lines.join("; ")}.`;
}
