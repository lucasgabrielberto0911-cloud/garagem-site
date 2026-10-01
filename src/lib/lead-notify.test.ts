import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildLeadNotifyEmail,
  buildLeadWebhookBody,
  leadNotifyEnabled,
} from "./lead-notify";

test("webhook e e-mail descrevem o lead sem inventar valor", () => {
  const payload = {
    id: "lead_1",
    name: "Maria Silva",
    phone: "(27) 99999-0000",
    vehicleInfo: "Fiat Palio 2016",
    plate: "ABC1D23",
    km: 89000,
    notes: "Quer trocar",
    source: "vender",
    interestVehicleId: "cmt0ewzpg0000lc0493fl02h7",
    photoCount: 2,
  };

  const body = buildLeadWebhookBody(payload);
  assert.equal(body.event, "lead.venda.created");
  assert.equal(body.lead.name, "Maria Silva");
  assert.equal(body.lead.interestVehicleId, payload.interestVehicleId);
  assert.equal(body.lead.photoCount, 2);

  const email = buildLeadNotifyEmail(payload);
  assert.match(email.subject, /Fiat Palio 2016/);
  assert.match(email.text, /ABC1D23/);
  assert.match(email.text, /Quer trocar/);
});

test("e-mail de modelo pedido não fala de venda/troca", () => {
  const email = buildLeadNotifyEmail({
    name: "Ana Paula",
    phone: "27988887766",
    vehicleInfo: "Corolla XEi",
    notes: "E-mail: ana@exemplo.com\nModelo pedido: Corolla XEi",
    source: "nao-encontrou",
  });
  assert.match(email.subject, /Modelo pedido: Corolla XEi — Ana Paula/);
  assert.match(email.text, /não encontrou o modelo/);
  assert.match(email.text, /ana@exemplo.com/);
  assert.doesNotMatch(email.text, /venda\/troca/);
});

test("alerta fica desligado sem webhook nem Resend", () => {
  const webhook = process.env.LEAD_WEBHOOK_URL;
  const key = process.env.RESEND_API_KEY;
  const email = process.env.LEAD_NOTIFY_EMAIL;
  delete process.env.LEAD_WEBHOOK_URL;
  delete process.env.RESEND_API_KEY;
  delete process.env.LEAD_NOTIFY_EMAIL;
  try {
    assert.equal(leadNotifyEnabled(), false);
  } finally {
    if (webhook) process.env.LEAD_WEBHOOK_URL = webhook;
    if (key) process.env.RESEND_API_KEY = key;
    if (email) process.env.LEAD_NOTIFY_EMAIL = email;
  }
});
