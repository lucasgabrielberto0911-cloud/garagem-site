import { isChatPing, isOffScopeMessage, offScopeReply } from "@/lib/chat-guard";
import {
  CHAT_FALLBACK_REPLY,
  CHAT_PING_REPLY,
  buildChatSystemPrompt,
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
  localGarageReply,
  toChatStockLine,
  type ChatVehicleRecord,
} from "@/lib/chat-stock";

export type ChatTurnResult = {
  reply: string;
  leadCreated: boolean;
};

export async function runChatTurn(input: {
  mensagem: string;
  historico: ChatTurn[];
  stock: ChatVehicleRecord[];
  generate?: typeof generateChatReply;
  confirm?: typeof confirmAfterLead;
  createLead?: typeof createChatLead;
}): Promise<ChatTurnResult> {
  const systemPrompt = buildChatSystemPrompt(input.stock.map(toChatStockLine));
  const generate = input.generate ?? generateChatReply;
  const confirm = input.confirm ?? confirmAfterLead;
  const createLead = input.createLead ?? createChatLead;

  if (isOffScopeMessage(input.mensagem)) {
    return { reply: offScopeReply(input.historico), leadCreated: false };
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
    return { reply: fromStock(), leadCreated: false };
  }

  if (!first.functionCall && (!first.text?.trim() || first.text === CHAT_FALLBACK_REPLY)) {
    return { reply: fromStock(), leadCreated: false };
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
        return { reply, leadCreated: true };
      } catch {
        // segue para o texto do modelo ou fallback
      }
    }
  }

  return {
    reply: first.text?.trim() || CHAT_FALLBACK_REPLY,
    leadCreated: false,
  };
}
