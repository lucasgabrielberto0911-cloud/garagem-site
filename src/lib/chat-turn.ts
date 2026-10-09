import {
  CHAT_CARD_LIMIT,
  isBareBudgetQuery,
  chatStockExploreHref,
  selectChatVehicles,
  toChatVehicleCard,
  type ChatVehicleCard,
} from "@/lib/chat-cards";
import {
  isChatPing,
  isFipeQuestion,
  isOffScopeMessage,
  looksLikeOffScopeRedirect,
  offScopeReply,
} from "@/lib/chat-guard";
import {
  CHAT_FALLBACK_REPLY,
  CHAT_FIPE_REPLY,
  CHAT_PING_REPLY,
  CHAT_WHATSAPP_URL,
  buildChatSystemPrompt,
  chatRankMode,
  isPowerQuery,
  isChatSelectionQuery,
  parsePriceLimit,
} from "@/lib/chat-prompt";
import { applyChatReplyGuards, looksTruncated } from "@/lib/chat-polish";
import {
  confirmAfterLead,
  generateChatReply,
  generateChatReplyStream,
  type ChatTurn,
  type GeminiGenerateResult,
} from "@/lib/chat-gemini";
import {
  createChatLead,
  leadArgsAreComplete,
  parseCriarLeadArgs,
} from "@/lib/chat-lead";
import {
  CHAT_CARD_REPLY,
  CHAT_FINANCE_REPLY,
  CHAT_TRADE_REPLY,
  CHAT_WARRANTY_REPLY,
  CHAT_DOCS_REPLY,
  CHAT_COMPARE_ASK_REPLY,
  CHAT_AVAILABILITY_ASK_REPLY,
  asksAboutConsumption,
  asksAboutEquipment,
  asksAboutKm,
  asksAboutAvailability,
  asksAboutListedFacts,
  asksAboutNamedGear,
  asksToCompareModels,
  asksWhichTwoToCompare,
  chatPolicyShortcut,
  chatPromptStockOpts,
  compareChatStockPicks,
  enrichChatStockReply,
  enrichMissingModelReply,
  formatAvailabilityReply,
  formatFocusedConsumptionReply,
  formatFocusedEquipmentReply,
  formatFocusedKmReply,
  formatVehicleLine,
  isIncompleteStockReply,
  isFocusedVehicleFactQuestion,
  looksLikeMissingModelReply,
  looksLikeShortlistFollowUp,
  localGarageReply,
  matchFocusedVehicle,
  pickComparedModelVehicles,
  scopeChatMessage,
  searchChatInventory,
  selectVehiclesForChatPrompt,
  seeksMissingNamedModel,
  similarAfterEmptyFilter,
  singleMentionedModelPool,
  toChatStockLine,
  consumptionReplyLooksBroken,
  emptyFilterReply,
  equipmentReplyLooksBroken,
  formatShortlistFollowUp,
  formatTransmissionCompareReply,
  hasChatStockFilter,
  hasConsumptionFigures,
  missingModelReply,
  type ChatVehicleRecord,
} from "@/lib/chat-stock";
import { chatTurnMayCreateLead } from "@/lib/chat-guard";
import { parseChatSearchRanges } from "@/lib/chat-search-filters";
import { isAnaphoricVehicleFollowUp } from "@/lib/chat-text";
import {
  asksForTechnicalResearch,
  chatResearchTopic,
  researchChatVehicles,
} from "@/lib/chat-research";
import type { ChatResearch } from "@/lib/chat-research-data";

export type ChatTurnResult = {
  reply: string;
  leadCreated: boolean;
  vehicles: ChatVehicleCard[];
  stockHref: string | null;
  research?: ChatResearch;
  meta?: {
    finishReason?: string | null;
    truncated?: boolean;
    retried?: boolean;
    offScope?: boolean;
    fipe?: boolean;
    policy?: string | null;
    model?: string;
  };
};

export async function runChatTurn(input: {
  mensagem: string;
  historico: ChatTurn[];
  stock: ChatVehicleRecord[];
  vehicleId?: string;
  generate?: typeof generateChatReply;
  generateStream?: typeof generateChatReplyStream;
  confirm?: typeof confirmAfterLead;
  createLead?: typeof createChatLead;
  onToken?: (delta: string) => void;
  signal?: AbortSignal;
  research?: typeof researchChatVehicles;
}): Promise<ChatTurnResult> {
  input.signal?.throwIfAborted();
  const activeVehicle = input.vehicleId
    ? input.stock.find((v) => v.id === input.vehicleId)
    : undefined;
  const generate = input.generate ?? generateChatReply;
  const generateStream = input.generateStream ?? generateChatReplyStream;
  const confirm = input.confirm ?? confirmAfterLead;
  const createLead = input.createLead ?? createChatLead;
  const visitorMessage = input.mensagem;
  const roadUse = /\b(estrada|rodovias?|viagens?|viajar|ultrapassagens?|retomadas?)\b/i.test(
    visitorMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  );
  const requestsTechnical =
    asksForTechnicalResearch(visitorMessage) ||
    asksAboutConsumption(visitorMessage);
  const scopedMessage = scopeChatMessage(
    visitorMessage,
    input.historico,
    input.stock,
  );
  const emit = (text: string) => {
    if (text) input.onToken?.(text);
  };

  const systemPromptFor = () => {
    const promptStock = selectVehiclesForChatPrompt(
      input.stock,
      scopedMessage,
      activeVehicle,
    );
    return buildChatSystemPrompt(
      promptStock.map(toChatStockLine),
      scopedMessage,
      activeVehicle ? toChatStockLine(activeVehicle) : undefined,
      { ...chatPromptStockOpts(scopedMessage), consumption: false },
    );
  };

  const finish = (
    reply: string,
    leadCreated = false,
    opts: {
      cards?: boolean;
      forcedVehicles?: ChatVehicleRecord[];
      finishReason?: string | null;
      truncated?: boolean;
      retried?: boolean;
      offScope?: boolean;
      fipe?: boolean;
      policy?: string | null;
      model?: string;
    } = {},
  ): ChatTurnResult => {
    const allowCards = opts.cards !== false;
    let picked = allowCards
      ? selectChatVehicles(
          reply,
          scopedMessage,
          input.stock,
          CHAT_CARD_LIMIT,
          activeVehicle?.id,
        )
      : [];
    if (opts.forcedVehicles?.length) {
      picked = opts.forcedVehicles.slice(0, CHAT_CARD_LIMIT);
    }
    let text = applyChatReplyGuards(
      reply,
      picked.length ? picked : activeVehicle ? [activeVehicle] : [],
      { truncated: opts.truncated },
    );
    if (allowCards && picked.length === 0) {
      const missing = enrichMissingModelReply(text, scopedMessage, input.stock);
      text = missing.reply;
      if (missing.vehicles.length > 0) {
        picked = missing.vehicles.slice(0, CHAT_CARD_LIMIT);
      }
    }
    const enriched =
      picked.length > 0 && !requestsTechnical
        ? enrichChatStockReply(text, picked, scopedMessage, input.stock)
        : text;
    let guarded = applyChatReplyGuards(enriched, picked, {
      truncated: opts.truncated,
    });
    if (
      looksLikeMissingModelReply(guarded) &&
      !/whatsapp|wa\.me/i.test(guarded)
    ) {
      guarded = `${guarded.trim()} Se quiser, o consultor anota e te avisa no WhatsApp: ${CHAT_WHATSAPP_URL}`;
    }
    const vehicles = picked.map(toChatVehicleCard);
    return {
      reply: guarded,
      leadCreated,
      vehicles,
      stockHref: allowCards
        ? chatStockExploreHref(scopedMessage, input.stock, vehicles.length)
        : null,
      meta: {
        finishReason: opts.finishReason ?? null,
        truncated: Boolean(opts.truncated),
        retried: Boolean(opts.retried),
        offScope: Boolean(opts.offScope),
        fipe: Boolean(opts.fipe),
        policy: opts.policy ?? null,
        model: opts.model,
      },
    };
  };

  if (isOffScopeMessage(scopedMessage)) {
    const reply = offScopeReply(input.historico);
    emit(reply);
    return finish(reply, false, { cards: false, offScope: true });
  }
  if (isFipeQuestion(scopedMessage)) {
    emit(CHAT_FIPE_REPLY);
    return finish(CHAT_FIPE_REPLY, false, { cards: false, fipe: true });
  }

  const mayCreateLead = chatTurnMayCreateLead(visitorMessage, input.historico);
  if (
    !mayCreateLead &&
    /\b(?:onde (?:fica|esta|estao|posso ver).{0,24}(?:carro|moto|veiculo|unidade)|(?:cidade|localizacao) (?:do|da|desse|dessa|deste|desta) (?:carro|moto|veiculo|unidade))\b/i.test(
      visitorMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    )
  ) {
    const reply = `Para combinar onde ver esse veículo, fale com o consultor no WhatsApp: ${CHAT_WHATSAPP_URL}`;
    emit(reply);
    return finish(reply, false, { cards: false, policy: "vehicle-location-private" });
  }
  const humanAction =
    /\b(troca\w*|troco|financi\w*|parcela\w*|vender|anunciar|visita|video|consultor|whatsapp)\b/i.test(
      visitorMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    );
  const policy = mayCreateLead ? null : chatPolicyShortcut(scopedMessage);
  if (policy === "card") {
    emit(CHAT_CARD_REPLY);
    return finish(CHAT_CARD_REPLY, false, { policy });
  }
  if (policy === "finance") {
    emit(CHAT_FINANCE_REPLY);
    return finish(CHAT_FINANCE_REPLY, false, { policy });
  }
  if (policy === "troca") {
    emit(CHAT_TRADE_REPLY);
    return finish(CHAT_TRADE_REPLY, false, { policy });
  }
  if (policy === "warranty") {
    emit(CHAT_WARRANTY_REPLY);
    return finish(CHAT_WARRANTY_REPLY, false, { policy });
  }
  if (policy === "docs") {
    emit(CHAT_DOCS_REPLY);
    return finish(CHAT_DOCS_REPLY, false, { policy });
  }
  if (policy === "gear") {
    const reply = formatTransmissionCompareReply(input.stock, scopedMessage);
    emit(reply);
    return finish(reply, false, { policy });
  }

  const empty =
    mayCreateLead || humanAction
      ? null
      : emptyFilterReply(scopedMessage, input.stock);
  if (empty) {
    const similar = similarAfterEmptyFilter(scopedMessage, input.stock, 3);
    emit(empty);
    return finish(empty, false, {
      policy: "waitlist",
      forcedVehicles: similar,
      cards: similar.length > 0,
    });
  }

  if (
    !mayCreateLead &&
    !requestsTechnical &&
    !roadUse &&
    input.historico.some(
      (turn) => turn.role === "user" && turn.content.trim(),
    ) &&
    looksLikeShortlistFollowUp(visitorMessage)
  ) {
    const follow = formatShortlistFollowUp(scopedMessage, input.stock);
    if (follow) {
      emit(follow);
      return finish(follow, false, { policy: "shortlist" });
    }
  }
  if (
    !mayCreateLead &&
    looksLikeShortlistFollowUp(visitorMessage) &&
    !input.historico.some((turn) => turn.role === "user") &&
    !hasChatStockFilter(visitorMessage) &&
    !input.vehicleId
  ) {
    const reply =
      "De qual deles você quer saber? Me diga os modelos que quer comparar, ou comece pelo orçamento.";
    emit(reply);
    return finish(reply, false, { policy: "compare-ask", cards: false });
  }

  const mentionedPool = singleMentionedModelPool(input.stock, scopedMessage);
  const compared = pickComparedModelVehicles(input.stock, scopedMessage);
  const focusedVehicle =
    matchFocusedVehicle(scopedMessage, input.stock, activeVehicle?.id) ??
    (!mentionedPool &&
    (asksAboutConsumption(scopedMessage) ||
      asksAboutEquipment(scopedMessage) ||
      asksAboutKm(scopedMessage) ||
      asksAboutAvailability(scopedMessage))
      ? activeVehicle
      : undefined);
  const mixedPrice = asksAboutListedFacts(scopedMessage);
  const selection =
    isChatSelectionQuery(scopedMessage) ||
    (requestsTechnical && compared.length >= 2) ||
    roadUse ||
    Object.keys(parseChatSearchRanges(scopedMessage)).length > 0 ||
    (hasChatStockFilter(scopedMessage) &&
      !isFocusedVehicleFactQuestion(
        visitorMessage,
        input.stock,
        input.vehicleId,
      ));
  if (
    selection &&
    !mayCreateLead &&
    (!humanAction || requestsTechnical) &&
    !(
      asksAboutAvailability(visitorMessage) &&
      isAnaphoricVehicleFollowUp(visitorMessage)
    ) &&
    !asksAboutEquipment(visitorMessage) &&
    !seeksMissingNamedModel(scopedMessage, input.stock)
  ) {
    const found = searchChatInventory(scopedMessage, input.stock);
    if (found) {
      let inventoryReply = found.reply;
      if (roadUse || (requestsTechnical && chatResearchTopic(visitorMessage) === "consumo")) {
        const evidence = compareChatStockPicks(found.picks, {
          withLeadin: false,
          intent: "default",
        });
        const guidance = roadUse
          ? "Para estrada, você prioriza conforto, consumo ou desempenho? Posso conferir os dados técnicos das versões com fontes."
          : "Para comparar consumo, vou conferir a versão e o ano, com combustível e percurso informados na fonte. Motor menor, sozinho, não confirma qual gasta menos.";
        inventoryReply = `${found.reply.split("\n")[0]}\n${found.picks.map(formatVehicleLine).join("\n")}\n\n${evidence} ${guidance}`;
      }
      emit(inventoryReply);
      const result = finish(inventoryReply, false, {
        policy: "inventory-search",
        forcedVehicles: found.picks,
      });
      // Preserve exact inventory prose: enrichment must not turn a search into a gear fact.
      result.reply = inventoryReply;
      result.stockHref = chatStockExploreHref(
        scopedMessage,
        found.candidates,
        result.vehicles.length,
      );
      if (requestsTechnical) {
        const research = await (input.research ?? researchChatVehicles)(
          found.candidates,
          input.signal,
          chatResearchTopic(visitorMessage),
        );
        result.research = research;
        if (
          isPowerQuery(visitorMessage) &&
          !research.unavailable &&
          research.paragraphs.length > 0 &&
          research.powerOrder?.length === found.candidates.length
        ) {
          const byId = new Map(found.candidates.map((v) => [v.id, v]));
          const verified = research.powerOrder.flatMap((id) =>
            byId.get(id) ? [byId.get(id)!] : [],
          );
          if (
            verified.length === found.candidates.length &&
            new Set(research.powerOrder).size === verified.length
          ) {
            const picks = verified.slice(0, CHAT_CARD_LIMIT);
            result.vehicles = picks.map(toChatVehicleCard);
            result.reply = `${found.reply.split("\n")[0]}\n${picks.map(formatVehicleLine).join("\n")}\n\nA ordem considera a potência de catálogo confirmada nas fontes abaixo. Compare também combustível, preço e km; isso não mede o desempenho ou o estado de cada unidade.`;
          }
        }
      }
      return result;
    }
    const reply =
      "Não achei um anúncio que reúna esses critérios agora. Você pode mudar o recorte ou falar com um consultor no WhatsApp: " +
      CHAT_WHATSAPP_URL;
    emit(reply);
    return finish(reply, false, { policy: "inventory-empty", cards: false });
  }
  if (requestsTechnical && !mayCreateLead) {
    const named = singleMentionedModelPool(input.stock, visitorMessage);
    // A named model outside the stock must not silently become the open ficha.
    const explicitSubject =
      /\b(?:do|da|sobre(?: o| a)?|pesquis\w*)\s+(?!(?:motor|carro|veiculo|modelo|anuncio|consumo|cambio|torque|potencia|combustivel|porta|desempenho|ficha|esse|essa|este|esta)\b)[a-z0-9]/i.test(
        visitorMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      );
    const subject = named
      ? matchFocusedVehicle(visitorMessage, named, activeVehicle?.id)
      : explicitSubject || seeksMissingNamedModel(visitorMessage, input.stock)
        ? undefined
        : (activeVehicle ??
          (isAnaphoricVehicleFollowUp(visitorMessage)
            ? focusedVehicle
            : undefined));
    if (subject) {
      const reply = `${subject.brand} ${subject.model} ${subject.version ?? ""} ${subject.yearModel}: ${subject.km.toLocaleString("pt-BR")} km, ${subject.transmission}, R$ ${subject.price.toLocaleString("pt-BR")}. Vou separar os dados deste anúncio dos dados técnicos do modelo.`;
      emit(reply);
      const result = finish(reply, false, {
        policy: "technical-research",
        forcedVehicles: [subject],
      });
      result.reply = reply;
      result.research = await (input.research ?? researchChatVehicles)(
        [subject],
        input.signal,
        chatResearchTopic(visitorMessage),
      );
      return result;
    }
    const reply =
      "Qual modelo, versão e ano você quer pesquisar? Posso conferir os dados técnicos com fontes e comparar com os anúncios disponíveis.";
    emit(reply);
    return finish(reply, false, { policy: "technical-ask", cards: false });
  }
  if (
    !mayCreateLead &&
    compared.length >= 2 &&
    asksToCompareModels(scopedMessage) &&
    !asksAboutConsumption(scopedMessage) &&
    !asksAboutEquipment(scopedMessage)
  ) {
    const reply = compareChatStockPicks(compared, {
      withLeadin: true,
      power: isPowerQuery(scopedMessage),
      intent: chatRankMode(scopedMessage),
    });
    emit(reply);
    return finish(reply, false, {
      policy: "compare",
      forcedVehicles: compared.slice(0, 2),
    });
  }
  if (
    !mayCreateLead &&
    asksWhichTwoToCompare(scopedMessage) &&
    compared.length < 2 &&
    !mentionedPool &&
    !hasChatStockFilter(scopedMessage) &&
    parsePriceLimit(scopedMessage) == null
  ) {
    emit(CHAT_COMPARE_ASK_REPLY);
    return finish(CHAT_COMPARE_ASK_REPLY, false, {
      policy: "compare-ask",
      cards: false,
    });
  }
  if (
    !mayCreateLead &&
    asksToCompareModels(scopedMessage) &&
    compared.length < 2 &&
    !asksWhichTwoToCompare(scopedMessage) &&
    !asksAboutConsumption(scopedMessage) &&
    !asksAboutEquipment(scopedMessage)
  ) {
    const reply = missingModelReply(scopedMessage, input.stock);
    const similar = similarAfterEmptyFilter(scopedMessage, input.stock, 3);
    emit(reply);
    return finish(reply, false, {
      policy: "waitlist",
      forcedVehicles: similar,
      cards: similar.length > 0,
    });
  }
  if (!mayCreateLead && asksAboutAvailability(scopedMessage) && !mixedPrice) {
    if (
      isFocusedVehicleFactQuestion(
        scopedMessage,
        input.stock,
        input.vehicleId ?? activeVehicle?.id,
      )
    ) {
      const reply = formatAvailabilityReply(focusedVehicle, {
        sold: Boolean(input.vehicleId && !focusedVehicle),
      });
      emit(reply);
      return finish(reply, false, { policy: "availability" });
    }
    if (seeksMissingNamedModel(scopedMessage, input.stock)) {
      const reply = missingModelReply(scopedMessage, input.stock);
      const similar = similarAfterEmptyFilter(scopedMessage, input.stock, 3);
      emit(reply);
      return finish(reply, false, {
        policy: "waitlist",
        forcedVehicles: similar,
        cards: similar.length > 0,
      });
    }
    if (!mentionedPool && !focusedVehicle && !input.vehicleId) {
      emit(CHAT_AVAILABILITY_ASK_REPLY);
      return finish(CHAT_AVAILABILITY_ASK_REPLY, false, {
        policy: "availability-ask",
        cards: false,
      });
    }
  }
  if (!mayCreateLead && seeksMissingNamedModel(scopedMessage, input.stock)) {
    const reply = missingModelReply(scopedMessage, input.stock);
    const similar = similarAfterEmptyFilter(scopedMessage, input.stock, 3);
    emit(reply);
    return finish(reply, false, {
      policy: "waitlist",
      forcedVehicles: similar,
      cards: similar.length > 0,
    });
  }
  if (
    !mayCreateLead &&
    focusedVehicle &&
    !mixedPrice &&
    isFocusedVehicleFactQuestion(
      scopedMessage,
      input.stock,
      activeVehicle?.id,
    ) &&
    (asksAboutConsumption(scopedMessage) ||
      asksAboutEquipment(scopedMessage) ||
      asksAboutNamedGear(scopedMessage) ||
      asksAboutKm(scopedMessage))
  ) {
    const reply = asksAboutConsumption(scopedMessage)
      ? formatFocusedConsumptionReply(focusedVehicle)
      : asksAboutKm(scopedMessage)
        ? formatFocusedKmReply(focusedVehicle)
        : formatFocusedEquipmentReply(focusedVehicle, scopedMessage);
    emit(reply);
    return finish(reply, false, { policy: "stock-fact" });
  }
  if (
    !mayCreateLead &&
    focusedVehicle &&
    !mixedPrice &&
    !mentionedPool &&
    asksAboutConsumption(scopedMessage) &&
    activeVehicle &&
    focusedVehicle.id === activeVehicle.id
  ) {
    const reply = formatFocusedConsumptionReply(focusedVehicle);
    emit(reply);
    return finish(reply, false, { policy: "stock-fact" });
  }

  const fromStock = () => {
    if (isChatPing(scopedMessage)) return CHAT_PING_REPLY;
    if (requestsTechnical)
      return `Não consegui confirmar a pesquisa técnica agora. Os dados do anúncio continuam no site; o consultor pode ajudar no WhatsApp: ${CHAT_WHATSAPP_URL}`;
    return (
      localGarageReply(scopedMessage, input.stock, activeVehicle) ??
      CHAT_FALLBACK_REPLY
    );
  };

  // These questions need only current inventory, not an extra model request.
  const greeting =
    /^(oi+|ol[aá]|bom dia|boa tarde|boa noite|opa|tudo bem)[!.?\s]*$/i.test(
      visitorMessage.trim(),
    );
  if (
    !mayCreateLead &&
    ((greeting && input.historico.length === 0) ||
      (chatRankMode(scopedMessage) === "price" &&
        isBareBudgetQuery(scopedMessage)))
  ) {
    const local = greeting
      ? CHAT_PING_REPLY
      : localGarageReply(scopedMessage, input.stock, activeVehicle);
    if (local) {
      emit(local);
      return finish(local, false, {
        policy: greeting ? "greeting" : "stock-local",
      });
    }
  }

  let first: GeminiGenerateResult;
  try {
    if (input.onToken && !input.generate) {
      first = await generateStream(
        {
          systemPrompt: systemPromptFor(),
          history: input.historico,
          mensagem: visitorMessage,
          signal: input.signal,
        },
        { onToken: input.onToken },
      );
    } else {
      first = await generate({
        systemPrompt: systemPromptFor(),
        history: input.historico,
        mensagem: visitorMessage,
        signal: input.signal,
      });
      if (first.text && !first.functionCall) emit(first.text);
    }
  } catch {
    input.signal?.throwIfAborted();
    const fallback = fromStock();
    emit(fallback);
    return finish(fallback);
  }

  const generated = first.text?.trim() ?? "";
  if (
    !first.functionCall &&
    (!generated || generated === CHAT_FALLBACK_REPLY)
  ) {
    const fallback = fromStock();
    emit(fallback);
    return finish(fallback, false, {
      finishReason: first.finishReason,
      truncated: first.truncated,
      retried: first.retried,
      model: first.model,
    });
  }
  if (
    !first.functionCall &&
    isChatPing(scopedMessage) &&
    looksLikeOffScopeRedirect(generated)
  ) {
    emit(CHAT_PING_REPLY);
    return finish(CHAT_PING_REPLY);
  }
  if (
    !first.functionCall &&
    (isIncompleteStockReply(generated) || /R\$\s*\.?$/.test(generated)) &&
    (parsePriceLimit(scopedMessage) != null || /R\$\s*\.?$/.test(generated))
  ) {
    const fallback = fromStock();
    if (fallback && !/R\$\s*\.?$/.test(fallback.trim())) {
      if (!generated || fallback.startsWith(generated)) {
        emit(generated ? fallback.slice(generated.length) : fallback);
      }
      return finish(fallback, false, {
        finishReason: first.finishReason,
        truncated: false,
        retried: first.retried,
        model: first.model,
      });
    }
  }

  if (
    !first.functionCall &&
    !requestsTechnical &&
    asksAboutConsumption(scopedMessage) &&
    !hasConsumptionFigures(generated)
  ) {
    const local = localGarageReply(scopedMessage, input.stock, activeVehicle);
    const broken =
      consumptionReplyLooksBroken(generated) ||
      looksTruncated(generated, first.finishReason);
    const inferred =
      matchFocusedVehicle(scopedMessage, input.stock, activeVehicle?.id) ??
      (generated
        ? matchFocusedVehicle(generated, input.stock, activeVehicle?.id)
        : undefined) ??
      activeVehicle;
    const catalog =
      local && hasConsumptionFigures(local)
        ? local
        : inferred && !asksAboutListedFacts(scopedMessage)
          ? formatFocusedConsumptionReply(inferred)
          : local;
    if (catalog && (hasConsumptionFigures(catalog) || broken || !generated)) {
      if (!generated || catalog.startsWith(generated)) {
        emit(generated ? catalog.slice(generated.length) : catalog);
      }
      return finish(catalog, false, {
        finishReason: first.finishReason,
        truncated: false,
        retried: first.retried,
        policy: "stock-fact",
        model: first.model,
      });
    }
  }

  if (
    !first.functionCall &&
    (asksAboutEquipment(scopedMessage) ||
      asksAboutNamedGear(scopedMessage) ||
      asksAboutKm(scopedMessage))
  ) {
    const inferred =
      matchFocusedVehicle(scopedMessage, input.stock, activeVehicle?.id) ??
      activeVehicle;
    const broken =
      equipmentReplyLooksBroken(generated) ||
      looksTruncated(generated, first.finishReason);
    const kmOnly = asksAboutKm(scopedMessage) && !mixedPrice;
    if (inferred && (broken || kmOnly)) {
      const catalog = kmOnly
        ? formatFocusedKmReply(inferred)
        : formatFocusedEquipmentReply(inferred, scopedMessage);
      if (!generated || catalog.startsWith(generated)) {
        emit(generated ? catalog.slice(generated.length) : catalog);
      }
      return finish(catalog, false, {
        finishReason: first.finishReason,
        truncated: false,
        retried: first.retried,
        policy: "stock-fact",
        model: first.model,
      });
    }
  }

  if (first.functionCall?.name === "criar_lead") {
    const args = parseCriarLeadArgs(first.functionCall.args);
    if (leadArgsAreComplete(args) && args) {
      try {
        input.signal?.throwIfAborted();
        const created = await createLead(args, input.stock);
        let reply =
          "Pronto — registrei seu contato. A equipe continua com você no WhatsApp.";
        try {
          const confirmation = await confirm({
            systemPrompt: systemPromptFor(),
            history: input.historico,
            mensagem: visitorMessage,
            signal: input.signal,
            modelContent: first.raw,
            functionName: "criar_lead",
            functionResult: { ok: true, leadId: created.id },
          });
          if (confirmation) reply = confirmation;
        } catch {
          // confirmação é extra — o lead já foi gravado
        }
        emit(reply);
        return finish(reply, true, {
          finishReason: first.finishReason,
          model: first.model,
        });
      } catch {
        // segue para o texto do modelo ou fallback
      }
    }
  }

  return finish(first.text?.trim() || CHAT_FALLBACK_REPLY, false, {
    finishReason: first.finishReason,
    truncated: first.truncated,
    retried: first.retried,
    model: first.model,
  });
}
