import {
  chatStockExploreHref,
  selectChatVehicles,
  toChatVehicleCard,
  type ChatVehicleCard,
} from "@/lib/chat-cards";
import {
  isChatPing,
  isOffScopeMessage,
  looksLikeOffScopeRedirect,
  offScopeReply,
} from "@/lib/chat-guard";
import {
  CHAT_FALLBACK_REPLY,
  CHAT_PING_REPLY,
  buildChatSystemPrompt,
  parsePriceLimit,
} from "@/lib/chat-prompt";
import {
  confirmAfterLead,
  generateChatReply,
  type ChatTurn,
} from "@/lib/chat-gemini";
import {
  createChatLead,
  leadArgsAreComplete,
  parseCriarLeadArgs,
} from "@/lib/chat-lead";
import {
  CHAT_FINANCE_REPLY,
  CHAT_TRADE_REPLY,
  chatPolicyShortcut,
  enrichChatStockReply,
  isIncompleteStockReply,
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
};

export async function runChatTurn(input: {
  mensagem: string;
  historico: ChatTurn[];
  stock: ChatVehicleRecord[];
  generate?: typeof generateChatReply;
  confirm?: typeof confirmAfterLead;
  createLead?: typeof createChatLead;
}): Promise<ChatTurnResult> {
  const systemPrompt = buildChatSystemPrompt(
    applyChatStockFilters(input.stock, input.mensagem).map(toChatStockLine),
    input.mensagem,
  );
  const generate = input.generate ?? generateChatReply;
  const confirm = input.confirm ?? confirmAfterLead;
  const createLead = input.createLead ?? createChatLead;

  const finish = (reply: string, leadCreated = false): ChatTurnResult => {
    const picked = selectChatVehicles(reply, input.mensagem, input.stock);
    const enriched = enrichChatStockReply(reply, picked, input.mensagem);
    const vehicles = picked.map(toChatVehicleCard);
    return {
      reply: enriched,
      leadCreated,
      vehicles,
      stockHref: chatStockExploreHref(
        input.mensagem,
        input.stock,
        vehicles.length,
      ),
    };
  };

  if (isOffScopeMessage(input.mensagem)) {
    return finish(offScopeReply(input.historico));
  }

  const policy = chatPolicyShortcut(input.mensagem);
  if (policy === "finance") return finish(CHAT_FINANCE_REPLY);
  if (policy === "troca") return finish(CHAT_TRADE_REPLY);

  const fromStock = () => {
    if (isChatPing(input.mensagem)) return CHAT_PING_REPLY;
    return localGarageReply(input.mensagem, input.stock) ?? CHAT_FALLBACK_REPLY;
  };

  let first;
  try {
    first = await generate({
      systemPrompt,
      history: input.historico,
      mensagem: input.mensagem,
    });
  } catch {
    return finish(fromStock());
  }

  const generated = first.text?.trim() ?? "";
  if (!first.functionCall && (!generated || generated === CHAT_FALLBACK_REPLY)) {
    return finish(fromStock());
  }
  if (!first.functionCall && isChatPing(input.mensagem) && looksLikeOffScopeRedirect(generated)) {
    return finish(CHAT_PING_REPLY);
  }
  if (
    !first.functionCall &&
    parsePriceLimit(input.mensagem) != null &&
    isIncompleteStockReply(generated)
  ) {
    return finish(fromStock());
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
        return finish(reply, true);
      } catch {
        // segue para o texto do modelo ou fallback
      }
    }
  }

  return finish(first.text?.trim() || CHAT_FALLBACK_REPLY);
}
