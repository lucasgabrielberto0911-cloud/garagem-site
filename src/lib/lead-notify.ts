/**
 * Alerta opcional quando chega um lead de venda/troca.
 * Webhook e/ou Resend — se falhar, o lead já foi gravado.
 */

export type LeadNotifyPayload = {
  id?: string;
  name: string;
  phone: string;
  vehicleInfo: string;
  plate?: string;
  km?: number | null;
  notes?: string | null;
  source?: string | null;
  interestVehicleId?: string | null;
  photoCount?: number;
};

export function leadNotifyEnabled() {
  return Boolean(
    process.env.LEAD_WEBHOOK_URL?.trim() ||
      (process.env.RESEND_API_KEY?.trim() &&
        (process.env.LEAD_NOTIFY_EMAIL?.trim() || process.env.LEAD_NOTIFY_TO?.trim())),
  );
}

export function buildLeadWebhookBody(payload: LeadNotifyPayload) {
  return {
    event: "lead.venda.created",
    createdAt: new Date().toISOString(),
    lead: {
      id: payload.id ?? null,
      name: payload.name,
      phone: payload.phone,
      vehicleInfo: payload.vehicleInfo,
      plate: payload.plate ?? "",
      km: payload.km ?? null,
      notes: payload.notes ?? null,
      source: payload.source ?? "vender",
      interestVehicleId: payload.interestVehicleId ?? null,
      photoCount: payload.photoCount ?? 0,
    },
  };
}

export function buildLeadNotifyEmail(payload: LeadNotifyPayload) {
  const lines = [
    "Novo lead de venda/troca no site da Garagem.",
    "",
    `Nome: ${payload.name}`,
    `Telefone: ${payload.phone}`,
    `Veículo: ${payload.vehicleInfo}`,
    payload.plate ? `Placa: ${payload.plate}` : null,
    payload.km != null ? `KM: ${payload.km}` : null,
    payload.source ? `Origem: ${payload.source}` : null,
    payload.interestVehicleId
      ? `Interesse (id): ${payload.interestVehicleId}`
      : null,
    payload.photoCount ? `Fotos: ${payload.photoCount}` : null,
    payload.notes ? `Observações: ${payload.notes}` : null,
  ].filter((line): line is string => line != null);

  return {
    subject: `Lead: ${payload.vehicleInfo} — ${payload.name}`,
    text: lines.join("\n"),
  };
}

async function postWebhook(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`webhook ${response.status}`);
  }
}

async function sendResendEmail(payload: LeadNotifyPayload) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to =
    process.env.LEAD_NOTIFY_EMAIL?.trim() ||
    process.env.LEAD_NOTIFY_TO?.trim();
  if (!apiKey || !to) return;

  const from =
    process.env.LEAD_NOTIFY_FROM?.trim() ||
    "Garagem <onboarding@resend.dev>";
  const email = buildLeadNotifyEmail(payload);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: email.subject,
      text: email.text,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`resend ${response.status}`);
  }
}

/** Dispara e esquece. Nunca rejeita — o formulário não depende disso. */
export function notifyNewLead(payload: LeadNotifyPayload) {
  if (!leadNotifyEnabled()) return;

  void (async () => {
    const webhook = process.env.LEAD_WEBHOOK_URL?.trim();
    if (webhook) {
      try {
        await postWebhook(webhook, buildLeadWebhookBody(payload));
      } catch (error) {
        console.error("[lead-notify] webhook:", error);
      }
    }

    try {
      await sendResendEmail(payload);
    } catch (error) {
      console.error("[lead-notify] email:", error);
    }
  })();
}
