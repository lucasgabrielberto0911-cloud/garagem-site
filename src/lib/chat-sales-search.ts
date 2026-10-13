import type { ChatTurn } from "./chat-gemini";
import { formatChatCarBlocks } from "./chat-multicriterio";
import { parsePriceLimit, formatChatPrice } from "./chat-prompt";
import { asksForMoreChatVehicles, chatSearchText, parseChatDisplacementFilter, parseChatSearchRanges } from "./chat-search-filters";
import {
  formatVehicleLine,
  asksForTurbo,
  chatWaitlistWhatsAppUrl,
  parseTransmissionFilter,
  searchChatInventory,
  formatChatWaitlistQuery,
  parseVehicleCategoryFilter,
  resolveChatCategory,
  talkName,
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

/** Continua a busca; oferece automático como alternativa ao manual, avisando a mudança. */
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
  const minPrice = parseChatSearchRanges(scopedMessage).minPrice;
  const category = parseVehicleCategoryFilter(scopedMessage) ?? resolveChatCategory(scopedMessage);
  // As buscas iniciais continuam nos atalhos existentes; filtros vazios de câmbio/preço
  // e novas sugestões precisam de uma resposta honesta antes de qualquer fallback.
  const initialEmpty = !more && !shownIds.size;
  if (initialEmpty && !(gear && price != null && !exact && !asksForTurbo(scopedMessage) && parseChatDisplacementFilter(scopedMessage) == null)) return null;
  if (found) {
    const blocks = formatChatCarBlocks(found.picks, scopedMessage);
    return { policy: "inventory-alternatives", picks: found.picks, reply: `${blocks}\n\nQual ${found.picks.length === 1 ? (found.picks[0]?.category === "moto" ? "detalhe dessa moto você quer conhecer" : "detalhe desse você quer conhecer") : "desses você quer conhecer melhor"}?` };
  }

  // Alternativa semiautomática: informa o câmbio cadastrado, sem assumir detalhes mecânicos.
  if (gear === "automatico" && category === "moto") {
    const semi = unseen.filter(
      v => (v.category === "moto" || /biz/i.test(v.model)) &&
           /semi/.test(chatSearchText(v.transmission ?? "")) &&
           (price == null || v.price <= price) &&
           (minPrice == null || v.price >= minPrice)
    );
    if (semi.length) {
      const picks = semi.slice(0, 3);
      const names = [...new Set(picks.map(v => talkName(v).labeled))].join(" e ");
      const blocks = formatChatCarBlocks(picks, scopedMessage);
      const question = picks.length === 1 ? "Quer conhecer melhor essa moto?" : "Qual dessas motos você quer conhecer melhor?";
      return {
        policy: "inventory-alternatives",
        picks,
        reply: `Moto automática (scooter) não temos agora, mas ${names} ${picks.length > 1 ? "são semi-automáticas" : "é semi-automática"}. O consultor confirma os detalhes do câmbio no WhatsApp.\n\n${blocks}\n\n${question}`,
      };
    }
  }

  const label =
    category === "moto"
      ? gear === "automatico"
        ? "Moto automática"
        : gear === "manual"
          ? "Moto manual"
          : "Moto"
      : gear === "manual"
        ? "Manual"
        : gear === "automatico"
          ? "Automático"
          : "Veículo";
  const recorte = price != null ? "nessa faixa" : "com esses filtros";
  const exactCount = exact?.candidates.length ?? 0;
  const intro = exactCount === 1
    ? `${label} ${recorte} é só esse que já te mostrei.`
    : exactCount > 1
      ? `Já te mostrei todos os veículos ${recorte} com os filtros que você pediu.`
      : `Não tenho ${label.toLowerCase()} ${recorte} com todos os critérios que você pediu agora.`;

  // Quem pediu automático precisa confirmar outro câmbio antes de receber manuais.
  if (gear === "manual") {
    const otherGear = "automatico";
    const relaxed = chatSearchText(scopedMessage).replace(/\b(manual|manuais|automatic[oa]s?|automatic|automtico|automtatico|autmatico|autimatico|cvt)\b/g, " ");
    const alternatives = searchChatInventory(`${relaxed} ${otherGear}`, unseen);
    if (alternatives) {
      const kind = "automáticos";
      const blocks = formatChatCarBlocks(alternatives.picks, `${relaxed} ${otherGear}`).split("\n").slice(1).join("\n").trim();
      return {
        policy: initialEmpty ? "waitlist" : "inventory-alternatives",
        picks: alternatives.picks,
        reply: `${intro} Mas tenho ${kind} ${recorte}, mantendo os outros filtros:\n\n${blocks}${initialEmpty ? `\n\nSe preferir manter o câmbio, o consultor te avisa quando chegar: ${chatWaitlistWhatsAppUrl(scopedMessage)}` : ""}\n\nVocê consideraria ${kind}?`,
      };
    }
  }

  if (initialEmpty) {
    return {
      policy: "waitlist", picks: [],
      reply: `Não tenho ${formatChatWaitlistQuery(scopedMessage)} agora. O consultor pode te avisar quando chegar: ${chatWaitlistWhatsAppUrl(scopedMessage)}\n\nQuer considerar outro câmbio ou ampliar um pouco essa faixa?`,
    };
  }

  const nextStep = price != null
    ? `Quer considerar outro câmbio ou ampliar um pouco a faixa de ${minPrice == null ? "" : `${formatChatPrice(minPrice)} a `}${formatChatPrice(price)}?`
    : "Quer considerar outro câmbio ou outro tipo de veículo?";
  return { policy: "inventory-alternatives", picks: [], reply: `${intro} Não tenho outras opções próximas sem repetir as que já mostrei. ${nextStep}` };
}
