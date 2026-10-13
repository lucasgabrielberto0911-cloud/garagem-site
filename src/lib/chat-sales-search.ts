import type { ChatTurn } from "./chat-gemini";
import { formatChatCarBlocks } from "./chat-multicriterio";
import { parsePriceLimit, formatChatPrice } from "./chat-prompt";
import { asksForMoreChatVehicles, chatSearchText, parseChatDisplacementFilter } from "./chat-search-filters";
import {
  formatVehicleLine,
  asksForTurbo,
  chatWaitlistWhatsAppUrl,
  parseTransmissionFilter,
  searchChatInventory,
  type ChatVehicleRecord,
} from "./chat-stock";
import { vehiclePath } from "./vehicle-slug";

/** Links e IDs identificam unidades; o texto do cliente nunca altera dados da ficha. */
export function shownChatVehicleIds(
  history: ChatTurn[],
  stock: ChatVehicleRecord[],
  previousIds: string[] = [],
) {
  const ids = new Set(previousIds);
  for (const turn of history) {
    if (turn.role !== "assistant") continue;
    const paths = new Set([...turn.content.matchAll(/\/estoque\/[a-z0-9-]+/gi)].map(match => match[0]));
    for (const vehicle of stock) {
      if (paths.has(vehiclePath(vehicle)) || turn.content.includes(formatVehicleLine(vehicle))) ids.add(vehicle.id);
    }
  }
  return ids;
}

/** Continua a busca e só relaxa o câmbio, dizendo exatamente o que mudou. */
export function planChatSalesSearch(
  message: string,
  scopedMessage: string,
  stock: ChatVehicleRecord[],
  shownIds: Set<string>,
) {
  const more = asksForMoreChatVehicles(message);
  const exact = searchChatInventory(scopedMessage, stock);
  const unseen = stock.filter(vehicle => !shownIds.has(vehicle.id));
  const found = searchChatInventory(scopedMessage, unseen);
  const gear = parseTransmissionFilter(scopedMessage);
  const price = parsePriceLimit(scopedMessage);
  // As buscas iniciais continuam nos atalhos existentes; filtros vazios de câmbio/preço
  // e novas sugestões precisam de uma resposta honesta antes de qualquer fallback.
  const initialEmpty = !more && !shownIds.size;
  if (initialEmpty && !(gear && price != null && !exact && !asksForTurbo(scopedMessage) && parseChatDisplacementFilter(scopedMessage) == null)) return null;
  if (found) {
    const blocks = formatChatCarBlocks(found.picks, scopedMessage);
    return { policy: "inventory-alternatives", picks: found.picks, reply: `${blocks}\n\nQual ${found.picks.length === 1 ? "detalhe desse você quer conhecer" : "desses você quer conhecer melhor"}? Vem dar uma olhada!` };
  }

  const label = gear === "manual" ? "Manual" : gear === "automatico" ? "Automático" : "Veículo";
  const recorte = price != null ? "nessa faixa" : "com esses filtros";
  const exactCount = exact?.candidates.length ?? 0;
  const intro = exactCount === 1
    ? `${label} ${recorte} é só esse que já te mostrei.`
    : exactCount > 1
      ? `Já te mostrei todos os veículos ${recorte} com os filtros que você pediu.`
      : `Não tenho ${label.toLowerCase()} ${recorte} com todos os critérios que você pediu agora.`;

  if (gear) {
    const otherGear = gear === "manual" ? "automatico" : "manual";
    const relaxed = chatSearchText(scopedMessage).replace(/\b(manual|manuais|automatic[oa]s?|automatic|automtico|automtatico|autmatico|autimatico|cvt)\b/g, " ");
    const alternatives = searchChatInventory(`${relaxed} ${otherGear}`, unseen);
    if (alternatives) {
      const kind = otherGear === "automatico" ? "automáticos" : "manuais";
      const blocks = formatChatCarBlocks(alternatives.picks, `${relaxed} ${otherGear}`).split("\n").slice(1).join("\n").trim();
      return {
        policy: initialEmpty ? "waitlist" : "inventory-alternatives",
        picks: alternatives.picks,
        reply: `${intro} Mas tenho ${kind} ${recorte}, mantendo os outros filtros:\n\n${blocks}${initialEmpty ? `\n\nSe preferir manter o câmbio, o consultor te avisa quando chegar: ${chatWaitlistWhatsAppUrl(scopedMessage)}` : ""}\n\nVocê consideraria ${kind}? Me conta qual chamou sua atenção!`,
      };
    }
  }

  if (initialEmpty) return null;

  const nextStep = price != null
    ? `Quer considerar outro câmbio ou ampliar um pouco a faixa de ${formatChatPrice(price)}? Me conta até quanto você se sente confortável.`
    : "Quer considerar outro câmbio ou outro tipo de veículo? Me conta o que você prefere.";
  return { policy: "inventory-alternatives", picks: [], reply: `${intro} Não tenho outras opções próximas sem repetir as que já mostrei. ${nextStep}` };
}
