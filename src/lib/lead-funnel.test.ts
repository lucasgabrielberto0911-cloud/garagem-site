import assert from "node:assert/strict";
import { test } from "node:test";
import { funnelActivity, leadWeekStart, weeklyLeadSummary } from "./lead-funnel";
import { leadSearchWhere } from "./admin-lead-search";
import { isLeadStatus, buildLeadWhatsAppUrl } from "./leads";
import { agendaWhere } from "./admin-agenda";
const now = new Date("2026-10-10T15:00:00Z");
const lead = { createdAt: new Date("2026-10-05T03:00:00Z"), status: "perdido", source: "whatsapp:instagram", interestVehicleId: "carro-1", vehicleInfo: "Civic 2020", activities: [
  { note: funnelActivity("visita-marcada") }, { note: funnelActivity("visita-marcada") }, { note: funnelActivity("visitou") },
] };
test("semana usa segunda-feira e horário da loja, inclusive domingo UTC", () => {
  assert.equal(leadWeekStart(now).toISOString(), "2026-10-05T03:00:00.000Z");
  assert.equal(leadWeekStart(new Date("2026-10-12T02:59:59Z")).toISOString(), "2026-10-05T03:00:00.000Z");
  assert.equal(leadWeekStart(new Date("2026-10-12T03:00:00Z")).toISOString(), "2026-10-12T03:00:00.000Z");
});
test("resumo preserva visitas de perdas, deduplica etapas e não presume visita para vendas", () => {
  const result = weeklyLeadSummary([lead, { ...lead, status: "fechado", activities: [] },
    { ...lead, source: "vender" }, { ...lead, source: "chatbot-site" }, { ...lead, source: "nao-encontrou" },
    { ...lead, createdAt: new Date("2026-10-05T02:59:59Z") }, { ...lead, createdAt: new Date("2026-10-11T00:00:00Z") },
  ], now);
  assert.deepEqual(result.cars, [{ label: "Civic 2020", conversas: 2, marcadas: 1, visitas: 1, vendas: 1 }]);
  assert.deepEqual(result.sources, [{ label: "Instagram", conversas: 2, marcadas: 1, visitas: 1, vendas: 1 }]);
  assert.equal(weeklyLeadSummary([{ ...lead, status: "perdido", activities: [{ note: funnelActivity("fechado") }] }], now).cars[0].vendas, 1);
});
test("status, filtro e agenda convivem com os cadastros antigos", () => {
  for (const status of ["novo", "contatado", "avaliado", "negociando", "fechado", "perdido", "conversa", "visita-marcada", "visitou"]) assert.equal(isLeadStatus(status), true);
  assert.deepEqual(leadSearchWhere({ origem: "whatsapp:google", status: "visitou" }), { source: "whatsapp:google", status: "visitou" });
  assert.deepEqual(leadSearchWhere({ origem: "vender" }), { source: "vender" });
  assert.deepEqual(leadSearchWhere({ origem: "inventada" }), {});
  assert.deepEqual(agendaWhere("hoje", now).status, { notIn: ["fechado", "perdido"] });
  assert.doesNotMatch(decodeURIComponent(buildLeadWhatsAppUrl({ name: "Ana", phone: "27999999999", source: "whatsapp:google", vehicleInfo: "Civic" })), /avaliação/);
});
