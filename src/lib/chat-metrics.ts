/** Telemetria do turno — sem texto do visitante nem dado de lead. */

export type ChatTurnMetric = {
  ms: number;
  finishReason?: string | null;
  truncated?: boolean;
  retried?: boolean;
  offScope?: boolean;
  fipe?: boolean;
  policy?: string | null;
  streamed?: boolean;
  leadCreated?: boolean;
  cards?: number;
  model?: string;
};

export function logChatTurn(event: ChatTurnMetric) {
  console.info("[chat] turn", {
    ms: event.ms,
    finishReason: event.finishReason ?? null,
    truncated: Boolean(event.truncated),
    retried: Boolean(event.retried),
    offScope: Boolean(event.offScope),
    fipe: Boolean(event.fipe),
    policy: event.policy ?? null,
    streamed: Boolean(event.streamed),
    leadCreated: Boolean(event.leadCreated),
    cards: event.cards ?? 0,
    model: event.model ?? null,
  });
}
