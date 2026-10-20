import { localDateInput } from "./admin-date";

/** Limite em minutos comerciais para alerta amarelo/vermelho de primeiro contato. */
export const LEAD_RESPONSE_ALERT_MINUTES = 30;

/** Limite em minutos comerciais para considerar o lead atrasado (2 horas). */
export const LEAD_RESPONSE_OVERDUE_MINUTES = 120;

/** Janela comercial da loja (08h às 18h, segunda a sábado, fuso de São Paulo -03:00). */
export const BUSINESS_HOUR_START = 8;
export const BUSINESS_HOUR_END = 18;

export type LeadResponseUrgency = "ok" | "alerta" | "atrasado";

/**
 * Calcula quantos minutos dentro do horário comercial (seg–sáb, 08h–18h BRT)
 * se passaram entre `createdAt` e `now`.
 */
export function businessMinutesElapsed(
  createdAt: Date | string,
  now: Date = new Date(),
): number {
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(now.getTime())) return 0;
  if (now.getTime() <= start.getTime()) return 0;

  // Se o intervalo for maior que 14 dias, já passou muito de 2h comerciais.
  const totalDiffMinutes = Math.floor((now.getTime() - start.getTime()) / 60_000);
  if (totalDiffMinutes > 14 * 24 * 60) return totalDiffMinutes;

  let totalBusinessMs = 0;
  let dayStr = localDateInput(start);
  const endDayStr = localDateInput(now);

  for (let guard = 0; guard < 20; guard++) {
    const dayMiddayUtc = new Date(`${dayStr}T12:00:00Z`);
    const weekday = dayMiddayUtc.getUTCDay(); // 0 = domingo

    if (weekday !== 0) {
      const windowStart = new Date(
        `${dayStr}T${String(BUSINESS_HOUR_START).padStart(2, "0")}:00:00-03:00`,
      );
      const windowEnd = new Date(
        `${dayStr}T${String(BUSINESS_HOUR_END).padStart(2, "0")}:00:00-03:00`,
      );
      const overlapStart = Math.max(start.getTime(), windowStart.getTime());
      const overlapEnd = Math.min(now.getTime(), windowEnd.getTime());
      if (overlapEnd > overlapStart) {
        totalBusinessMs += overlapEnd - overlapStart;
      }
    }

    if (dayStr >= endDayStr) break;
    const nextDay = new Date(`${dayStr}T12:00:00-03:00`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    dayStr = localDateInput(nextDay);
  }

  return Math.floor(totalBusinessMs / 60_000);
}

export function leadResponseUrgency(
  lead: { status: string; createdAt: Date | string },
  now: Date = new Date(),
): {
  level: LeadResponseUrgency;
  businessMinutes: number;
  label: string;
} {
  if (lead.status !== "novo") {
    return { level: "ok", businessMinutes: 0, label: "" };
  }
  const businessMinutes = businessMinutesElapsed(lead.createdAt, now);
  if (businessMinutes >= LEAD_RESPONSE_OVERDUE_MINUTES) {
    return {
      level: "atrasado",
      businessMinutes,
      label: `Sem resposta há ${formatElapsedMinutes(businessMinutes)} (atrasado)`,
    };
  }
  if (businessMinutes >= LEAD_RESPONSE_ALERT_MINUTES) {
    return {
      level: "alerta",
      businessMinutes,
      label: `Sem resposta há ${formatElapsedMinutes(businessMinutes)}`,
    };
  }
  return { level: "ok", businessMinutes, label: "" };
}

export function formatElapsedMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) {
    return rem > 0 ? `${hours}h ${rem}min` : `${hours}h`;
  }
  const days = Math.floor(hours / 10); // dias úteis aproximados (10h/dia)
  return days > 1 ? `${days} dias úteis` : `${hours}h`;
}

export function summarizeUnansweredLeads<
  T extends { id: string; status: string; createdAt: Date | string },
>(leads: T[], now: Date = new Date()) {
  let alertCount = 0;
  let overdueCount = 0;
  const urgent: Array<
    T & {
      urgency: "alerta" | "atrasado";
      businessMinutes: number;
      urgencyLabel: string;
    }
  > = [];

  for (const lead of leads) {
    const info = leadResponseUrgency(lead, now);
    if (info.level === "atrasado") {
      overdueCount++;
      urgent.push({
        ...lead,
        urgency: "atrasado",
        businessMinutes: info.businessMinutes,
        urgencyLabel: info.label,
      });
    } else if (info.level === "alerta") {
      alertCount++;
      urgent.push({
        ...lead,
        urgency: "alerta",
        businessMinutes: info.businessMinutes,
        urgencyLabel: info.label,
      });
    }
  }

  urgent.sort((a, b) => b.businessMinutes - a.businessMinutes);

  return {
    alertCount,
    overdueCount,
    totalUrgent: alertCount + overdueCount,
    urgent,
  };
}
