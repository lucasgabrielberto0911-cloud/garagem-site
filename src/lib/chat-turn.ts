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
  parsePriceLimit,
} from "@/lib/chat-prompt";
import { applyChatReplyGuards } from "@/lib/chat-polish";
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
  chatPolicyShortcut,
  enrichChatStockReply,
  enrichMissingModelReply,
  isIncompleteStockReply,
  looksLikeMissingModelReply,
  localGarageReply,
  toChatStockLine,
  applyChatStockFilters,
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
  const systemPrompt = buildChatSystemPrompt(
    applyChatStockFilters(input.stock, input.mensagem).map(toChatStockLine),
    input.mensagem,
    activeVehicle ? toChatStockLine(activeVehicle) : undefined,
  );
  const generate = input.generate ?? generateChatReply;
  const generateStream = input.generateStream ?? generateChatReplyStream;
  const confirm = input.confirm ?? confirmAfterLead;
  const createLead = input.createLead ?? createChatLead;
  const emit = (text: string) => {
    if (text) input.onToken?.(text);
  };

  const finish = (
    reply: string,
    leadCreated = false,
    opts: {
      cards?: boolean;
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
          input.mensagem,
          input.stock,
          CHAT_CARD_LIMIT,
          activeVehicle?.id,
        )
      : [];
    let text = applyChatReplyGuards(
      reply,
      picked.length ? picked : activeVehicle ? [activeVehicle] : [],
      { truncated: opts.truncated },
    );
    if (allowCards && picked.length === 0) {
      const missing = enrichMissingModelReply(text, input.mensagem, input.stock);
      text = missing.reply;
      if (missing.vehicles.length > 0) {
        picked = missing.vehicles.slice(0, CHAT_CARD_LIMIT);
      }
    }
    const enriched =
      picked.length > 0
        ? enrichChatStockReply(text, picked, input.mensagem)
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
        ? chatStockExploreHref(input.mensagem, input.stock, vehicles.length)
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

  if (isOffScopeMessage(input.mensagem)) {
    const reply = offScopeReply(input.historico);
    emit(reply);
    return finish(reply, false, { cards: false, offScope: true });
  }
  if (isFipeQuestion(input.mensagem)) {
    emit(CHAT_FIPE_REPLY);
    return finish(CHAT_FIPE_REPLY, false, { cards: false, fipe: true });
  }

  const policy = chatPolicyShortcut(input.mensagem);
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

  const fromStock = () => {
    if (isChatPing(input.mensagem)) return CHAT_PING_REPLY;
    return (
      localGarageReply(input.mensagem, input.stock, activeVehicle) ??
      CHAT_FALLBACK_REPLY
    );
  };

  let first: GeminiGenerateResult;
  try {
    if (input.onToken && !input.generate) {
      first = await generateStream(
        {
          systemPrompt,
          history: input.historico,
          mensagem: input.mensagem,
        },
        { onToken: input.onToken },
      );
    } else {
      first = await generate({
        systemPrompt,
        history: input.historico,
        mensagem: input.mensagem,
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
  if (!first.functionCall && isChatPing(input.mensagem) && looksLikeOffScopeRedirect(generated)) {
    emit(CHAT_PING_REPLY);
    return finish(CHAT_PING_REPLY);
  }
  if (
    !first.functionCall &&
    parsePriceLimit(input.mensagem) != null &&
    isIncompleteStockReply(generated)
  ) {
    const fallback = fromStock();
    emit(fallback);
    return finish(fallback);
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
            systemPrompt,
            history: input.historico,
            mensagem: input.mensagem,
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
