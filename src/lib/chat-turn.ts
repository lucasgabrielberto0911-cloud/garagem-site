import {
  CHAT_CARD_LIMIT,
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
  isIncompleteStockReply,
  isFocusedVehicleFactQuestion,
  looksLikeMissingModelReply,
  localGarageReply,
  matchFocusedVehicle,
  pickComparedModelVehicles,
  scopeChatMessage,
  selectVehiclesForChatPrompt,
  seeksMissingNamedModel,
  similarAfterEmptyFilter,
  singleMentionedModelPool,
  toChatStockLine,
  consumptionReplyLooksBroken,
  emptyFilterReply,
  equipmentReplyLooksBroken,
  formatTransmissionCompareReply,
  hasChatStockFilter,
  hasConsumptionFigures,
  missingModelReply,
  type ChatVehicleRecord,
} from "@/lib/chat-stock";

export type ChatTurnResult = {
  reply: string;
  leadCreated: boolean;
  vehicles: ChatVehicleCard[];
  stockHref: string | null;
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
}): Promise<ChatTurnResult> {
  const activeVehicle = input.vehicleId
    ? input.stock.find((v) => v.id === input.vehicleId)
    : undefined;
  const generate = input.generate ?? generateChatReply;
  const generateStream = input.generateStream ?? generateChatReplyStream;
  const confirm = input.confirm ?? confirmAfterLead;
  const createLead = input.createLead ?? createChatLead;
  const visitorMessage = input.mensagem;
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
      chatPromptStockOpts(scopedMessage),
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
      picked.length > 0
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

  const policy = chatPolicyShortcut(scopedMessage);
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

  const empty = emptyFilterReply(scopedMessage, input.stock);
  if (empty) {
    const similar = similarAfterEmptyFilter(scopedMessage, input.stock, 3);
    emit(empty);
    return finish(empty, false, {
      policy: "waitlist",
      forcedVehicles: similar,
      cards: similar.length > 0,
    });
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
  if (
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
  if (asksAboutAvailability(scopedMessage) && !mixedPrice) {
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
  if (
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
    return (
      localGarageReply(scopedMessage, input.stock, activeVehicle) ??
      CHAT_FALLBACK_REPLY
    );
  };

  let first: GeminiGenerateResult;
  try {
    if (input.onToken && !input.generate) {
      first = await generateStream(
        {
          systemPrompt: systemPromptFor(),
          history: input.historico,
          mensagem: visitorMessage,
        },
        { onToken: input.onToken },
      );
    } else {
      first = await generate({
        systemPrompt: systemPromptFor(),
        history: input.historico,
        mensagem: visitorMessage,
      });
      if (first.text && !first.functionCall) emit(first.text);
    }
  } catch {
    const fallback = fromStock();
    emit(fallback);
    return finish(fallback);
  }

  const generated = first.text?.trim() ?? "";
  if (!first.functionCall && (!generated || generated === CHAT_FALLBACK_REPLY)) {
    const fallback = fromStock();
    emit(fallback);
    return finish(fallback, false, {
      finishReason: first.finishReason,
      truncated: first.truncated,
      retried: first.retried,
      model: first.model,
    });
  }
  if (!first.functionCall && isChatPing(scopedMessage) && looksLikeOffScopeRedirect(generated)) {
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
    asksAboutConsumption(scopedMessage) &&
    !hasConsumptionFigures(generated)
  ) {
    const local = localGarageReply(
      scopedMessage,
      input.stock,
      activeVehicle,
    );
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
        const created = await createLead(args, input.stock);
        let reply =
          "Pronto — registrei seu contato. A equipe continua com você no WhatsApp.";
        try {
          const confirmation = await confirm({
            systemPrompt: systemPromptFor(),
            history: input.historico,
            mensagem: visitorMessage,
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
