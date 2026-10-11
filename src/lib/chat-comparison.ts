import { findVehicleSpec, specMaxCv } from "@/lib/chat-specs";
import { vehicleBodyStyle } from "@/lib/chat-prompt";
import { compareChatStockPicks, rankLineName, type ChatVehicleRecord } from "@/lib/chat-stock";

const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Dados por unidade, sem eleger um vencedor entre os carros da Garagem. */
export function neutralChatComparison(vehicles: ChatVehicleRecord[], message: string) {
  const picks = vehicles.slice(0, 3);
  const asked = fold(message);
  const consumption = /consum|consom|economi|km\s*\/\s*l|gasta|bebe/.test(asked);
  const power = /forte|poten|\bcv\b|motor|desempenho/.test(asked);
  const torque = /torque|kgfm/.test(asked);
  const space = /espac|porta.?malas|familia|diferenca/.test(asked);
  const ethanol = /etanol|alcool/.test(asked);
  const gasoline = /gasolina/.test(asked);
  const road = /estrada|rodovia/.test(asked);
  if (!consumption && !power && !space && !torque) return compareChatStockPicks(picks);
  const rows = picks.map(vehicle => {
    const spec = findVehicleSpec(vehicle);
    const data: string[] = [];
    if (/diferenca/.test(asked)) {
      const body = vehicleBodyStyle(vehicle);
      if (body) data.push(body === "suv" ? "SUV" : body === "pickup" ? "picape" : body === "wagon" ? "perua" : body);
    }
    const consumptionRef = road ? spec?.estrada : spec?.cidade;
    const kml = ethanol ? consumptionRef?.etanol : consumptionRef?.gasolina ?? spec?.consumoMoto;
    if (consumption && kml != null) data.push(`${String(kml).replace(".", ",")} km/l (${vehicle.category === "moto" ? "referência aproximada" : `${ethanol ? "etanol" : "gasolina"}, ${road ? "estrada" : "cidade"}/Inmetro`})`);
    const cv = spec ? (ethanol ? spec.cv.etanol : gasoline ? spec.cv.gasolina : specMaxCv(spec)) : null;
    if (power && cv != null && cv > 0) data.push(`${cv} cv${ethanol ? " (etanol)" : gasoline ? " (gasolina)" : ""}`);
    const kgfm = spec ? (ethanol ? spec.torque.etanol : gasoline ? spec.torque.gasolina : spec.torque.etanol ?? spec.torque.gasolina) : null;
    if (torque && kgfm != null) data.push(`${String(kgfm).replace(".", ",")} kgfm`);
    if (space && spec?.portaMalas != null) data.push(`${spec.aprox ? "cerca de " : ""}${spec.portaMalas} L de porta-malas`);
    if (!data.length) data.push(`${vehicle.transmission}, ${vehicle.km.toLocaleString("pt-BR")} km`);
    return `• ${rankLineName(vehicle)} — ${data.join("; ")}`;
  });
  return `${picks.length === 2 ? "Os dois são" : "São"} ótimas escolhas, cada um tem seu ponto forte:\n${rows.join("\n")}`;
}

/** Também protege respostas técnicas do modelo, mantendo os dados úteis da lista. */
export function guardChatComparisonWinner(text: string, vehicles: ChatVehicleRecord[]) {
  if (vehicles.length < 2) return text;
  const winner = /\bvantagem\b|\bganha(?:m)?\b|\bvence(?:m)?\b|\bvencedor\w*\b|\bsuperior\b|\bmelhor\b|\bsupera\b|sai na frente/;
  const parts = text.split(/(?<=[.!?:])\s+|\n/);
  if (!parts.some(part => winner.test(fold(part)))) return text;
  const rows = parts.filter(part => /^• /.test(part) && !winner.test(fold(part))).slice(0, 3);
  if (rows.length !== Math.min(vehicles.length, 3)) return neutralChatComparison(vehicles, "");
  return `${rows.length === 2 ? "Os dois são" : "São"} ótimas escolhas, cada um tem seu ponto forte:\n${rows.join("\n")}`;
}
