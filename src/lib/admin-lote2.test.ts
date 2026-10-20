import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adminActionDate,
  businessDay,
  hasExplicitActionTime,
  localDateInput,
  localTimeInput,
} from "./admin-date";
import {
  LEAD_LOSS_REASONS,
  extractLossReasonFromNote,
  isLeadLossReason,
  lossReasonActivity,
  summarizeLeadLosses,
} from "./leads";
import {
  businessMinutesElapsed,
  leadResponseUrgency,
  summarizeUnansweredLeads,
} from "./lead-response-alert";
import { buildLeadTimeline, classifyLeadActivity } from "./lead-timeline";

test("retorno com hora opcional preserva dia local, ordena no mesmo dia e distingue sem hora de 12:00", () => {
  const onlyDay = businessDay("2026-10-19");
  assert.equal(onlyDay.toISOString(), "2026-10-19T15:00:00.000Z");
  assert.equal(localDateInput(onlyDay), "2026-10-19");
  assert.equal(localTimeInput(onlyDay), "");
  assert.equal(hasExplicitActionTime(onlyDay), false);
  assert.equal(adminActionDate(onlyDay), "19/10/2026");

  const morning = businessDay("2026-10-19", "09:30");
  const noonExplicit = businessDay("2026-10-19", "12:00");
  const afternoon = businessDay("2026-10-19", "16:15");

  assert.equal(localTimeInput(morning), "09:30");
  assert.equal(localTimeInput(noonExplicit), "12:00");
  assert.equal(localTimeInput(afternoon), "16:15");
  assert.equal(adminActionDate(morning), "19/10/2026 às 09:30");
  assert.equal(adminActionDate(noonExplicit), "19/10/2026 às 12:00");

  assert.ok(morning.getTime() < noonExplicit.getTime());
  assert.ok(noonExplicit.getTime() < afternoon.getTime());

  for (const invalid of ["25:00", "9:30", "12:60", "abc"]) {
    assert.ok(Number.isNaN(businessDay("2026-10-19", invalid).getTime()));
  }
});

test("motivos de perda e objeções validam códigos, geram nota estruturada e agregam resumo", () => {
  for (const reason of LEAD_LOSS_REASONS) {
    assert.equal(isLeadLossReason(reason), true);
  }
  assert.equal(isLeadLossReason("invalido"), false);

  const note = lossReasonActivity("preco", "Achou R$ 4 mil acima da FIPE");
  assert.equal(extractLossReasonFromNote(note), "preco");
  assert.match(note, /Preço acima do orçamento — Achou R\$ 4 mil acima da FIPE/);

  const summary = summarizeLeadLosses([
    { status: "perdido", lostReason: "preco" },
    { status: "perdido", lostReason: "financiamento" },
    { status: "perdido", lostReason: "preco" },
    { status: "fechado", lostReason: null },
  ]);
  assert.deepEqual(
    summary.map((item) => [item.reason, item.count]),
    [
      ["preco", 2],
      ["financiamento", 1],
    ],
  );
});

test("alerta de lead sem resposta conta minutos comerciais e classifica 30 min e 2 h", () => {
  // Segunda-feira 19/10/2026 às 10:00 BRT (13:00 UTC)
  const created = new Date("2026-10-19T10:00:00-03:00");

  // 20 min depois -> ok
  const at20m = new Date("2026-10-19T10:20:00-03:00");
  assert.equal(businessMinutesElapsed(created, at20m), 20);
  assert.equal(
    leadResponseUrgency({ status: "novo", createdAt: created }, at20m).level,
    "ok",
  );

  // 35 min depois -> alerta (+30 min)
  const at35m = new Date("2026-10-19T10:35:00-03:00");
  assert.equal(businessMinutesElapsed(created, at35m), 35);
  assert.equal(
    leadResponseUrgency({ status: "novo", createdAt: created }, at35m).level,
    "alerta",
  );

  // 2h10 depois -> atrasado (+2h)
  const at130m = new Date("2026-10-19T12:10:00-03:00");
  assert.equal(businessMinutesElapsed(created, at130m), 130);
  assert.equal(
    leadResponseUrgency({ status: "novo", createdAt: created }, at130m).level,
    "atrasado",
  );

  // Lead já contatado nunca gera alerta
  assert.equal(
    leadResponseUrgency({ status: "contatado", createdAt: created }, at130m)
      .level,
    "ok",
  );

  // Lead criado às 22h de domingo só conta a partir das 08h de segunda
  const sundayNight = new Date("2026-10-18T22:00:00-03:00");
  const monday825 = new Date("2026-10-19T08:25:00-03:00");
  const monday840 = new Date("2026-10-19T08:40:00-03:00");
  assert.equal(businessMinutesElapsed(sundayNight, monday825), 25);
  assert.equal(businessMinutesElapsed(sundayNight, monday840), 40);

  const summary = summarizeUnansweredLeads(
    [
      { id: "1", status: "novo", createdAt: new Date("2026-10-19T09:00:00-03:00") },
      { id: "2", status: "novo", createdAt: new Date("2026-10-19T11:15:00-03:00") },
      { id: "3", status: "novo", createdAt: new Date("2026-10-19T11:50:00-03:00") },
      { id: "4", status: "contatado", createdAt: new Date("2026-10-19T08:00:00-03:00") },
    ],
    new Date("2026-10-19T12:00:00-03:00"),
  );
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.alertCount, 1);
  assert.deepEqual(
    summary.urgent.map((item) => [item.id, item.urgency]),
    [
      ["1", "atrasado"],
      ["2", "alerta"],
    ],
  );
});

test("linha do tempo unifica entrada, WhatsApp, status, retorno, objeção, cliente, venda e contato anterior", () => {
  assert.equal(classifyLeadActivity("[funil:contatado] Abriu WhatsApp").kind, "whatsapp");
  assert.equal(classifyLeadActivity("[funil:visitou] Situação atualizada para Visitou.").kind, "status");
  assert.equal(classifyLeadActivity("[perda:preco] Motivo da perda: Preço").kind, "objecao");
  assert.equal(classifyLeadActivity("[retorno:2026-10-20T13:00:00.000Z] Retorno agendado").kind, "retorno");
  assert.equal(classifyLeadActivity("Cliente pediu fotos internas").kind, "contato");

  const timeline = buildLeadTimeline({
    lead: {
      id: "lead-atual",
      createdAt: "2026-10-19T12:00:00.000Z",
      source: "whatsapp:instagram",
      vehicleInfo: "Honda Civic 2021",
      status: "negociando",
      nextAction: "Confirmar proposta",
      nextActionAt: "2026-10-20T13:30:00.000Z",
    },
    activities: [
      {
        id: "act-1",
        note: "[funil:contatado] Abriu WhatsApp",
        createdAt: "2026-10-19T12:05:00.000Z",
      },
      {
        id: "act-2",
        note: "[perda:avaliacao-troca] Motivo da perda / objeção: Valor do usado na troca",
        createdAt: "2026-10-19T14:00:00.000Z",
      },
    ],
    previousLeads: [
      {
        id: "lead-antigo",
        createdAt: "2026-06-10T15:00:00.000Z",
        vehicleInfo: "Toyota Corolla 2019",
        status: "perdido",
        source: "chatbot-site",
        lostReason: "preco",
      },
    ],
    customer: {
      id: "cust-1",
      name: "Carlos Silva",
      createdAt: "2026-10-19T15:00:00.000Z",
      sales: [
        {
          id: "sale-1",
          salePrice: 118000,
          paymentMethod: "Financiamento",
          saleDate: "2026-10-19T18:00:00.000Z",
          vehicle: { brand: "Honda", model: "Civic", yearModel: 2021 },
        },
      ],
    },
  });

  const kinds = timeline.map((item) => item.kind);
  assert.ok(kinds.includes("criado"));
  assert.ok(kinds.includes("whatsapp"));
  assert.ok(kinds.includes("objecao"));
  assert.ok(kinds.includes("retorno"));
  assert.ok(kinds.includes("cliente"));
  assert.ok(kinds.includes("venda"));
  assert.ok(kinds.includes("anterior"));
  // Mais recente primeiro (o retorno agendado para 20/10 vem no topo)
  assert.equal(timeline[0].kind, "retorno");
});
