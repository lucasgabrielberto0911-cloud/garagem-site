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
export function businessDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(NaN);
  const result = new Date(`${value}T12:00:00-03:00`);
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
