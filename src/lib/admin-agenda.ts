import type { Prisma } from "@prisma/client";
import { localDateInput } from "@/lib/admin-date";

export const AGENDA_PERIODS = [
  { value: "hoje", label: "Hoje" },
  { value: "atrasados", label: "Atrasados" },
  { value: "proximos", label: "Próximos" },
] as const;
export type AgendaPeriod = (typeof AGENDA_PERIODS)[number]["value"];

export function parseAgendaPeriod(value?: string): AgendaPeriod {
  return value === "atrasados" || value === "proximos" ? value : "hoje";
}

/** Datas do atendimento são dias locais, inclusive antes das 03h UTC. */
export function agendaWhere(period: AgendaPeriod, now = new Date()): Prisma.LeadVendaWhereInput {
  const start = new Date(`${localDateInput(now)}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    status: { notIn: ["fechado", "perdido"] },
    nextActionAt: period === "atrasados"
      ? { lt: start }
      : period === "proximos"
        ? { gte: end }
        : { gte: start, lt: end },
  };
}
