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
  isIncompleteStockReply,
  localGarageReply,
  toChatStockLine,
  filterStockByCategory,
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
    filterStockByCategory(input.stock, input.mensagem).map(toChatStockLine),
    input.mensagem,
  );
  const generate = input.generate ?? generateChatReply;
  const confirm = input.confirm ?? confirmAfterLead;
  const createLead = input.createLead ?? createChatLead;

  const finish = (reply: string, leadCreated = false): ChatTurnResult => {
    const vehicles = selectChatVehicles(reply, input.mensagem, input.stock).map(
      toChatVehicleCard,
    );
    return {
      reply,
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
          "Pronto, registrei seu contato. Um consultor da Garagem te chama no WhatsApp.";
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
