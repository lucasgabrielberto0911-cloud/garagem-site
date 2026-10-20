export const ADMIN_TIME_ZONE = "America/Sao_Paulo";
export function localDateInput(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ADMIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function localTimeInput(date: Date) {
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ADMIN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (key: string) => parts.find((p) => p.type === key)?.value;
  const hhmm = `${get("hour")}:${get("minute")}`;
  // Retornos salvos apenas com data usam 12:00:00.000-03:00; 12:00 explícito grava .001.
  if (
    hhmm === "12:00" &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    return "";
  }
  return hhmm;
}
export function hasExplicitActionTime(date: Date) {
  return localTimeInput(date) !== "";
}
export function businessDay(value: string, time?: string | null): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(NaN);
  const cleanTime = (time ?? "").trim();
  if (cleanTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(cleanTime)) {
    return new Date(NaN);
  }
  const isoTime = cleanTime
    ? cleanTime === "12:00"
      ? "12:00:00.001"
      : `${cleanTime}:00`
    : "12:00:00";
  const result = new Date(`${value}T${isoTime}-03:00`);
  if (Number.isNaN(result.getTime())) return result;
  return localDateInput(result) === value ? result : new Date(NaN);
}
export function businessPeriodStart(
  period: "month" | "year",
  now = new Date(),
) {
  const day = localDateInput(now);
  return new Date(
    `${period === "month" ? day.slice(0, 7) : `${day.slice(0, 4)}-01`}-01T00:00:00-03:00`,
  );
}
export function adminDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short" },
) {
  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone: ADMIN_TIME_ZONE,
  }).format(date);
}
export function adminActionDate(date: Date) {
  const time = localTimeInput(date);
  return time ? `${adminDate(date)} às ${time}` : adminDate(date);
}
