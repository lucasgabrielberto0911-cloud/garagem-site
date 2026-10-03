import { isLeadStatus, WANTED_LEAD_SOURCE } from "@/lib/leads";
export function leadSearchWhere(input: {
  status?: string | null;
  q?: string | null;
  origem?: string | null;
}) {
  const q = (input.q || "").trim();
  const digits = q.replace(/\D/g, "");
  const plate = q.replace(/[^a-zA-Z0-9]/g, "");
  return {
    ...(isLeadStatus(input.status || "") ? { status: input.status! } : {}),
    ...(input.origem === WANTED_LEAD_SOURCE ? { source: input.origem } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { vehicleInfo: { contains: q, mode: "insensitive" as const } },
            { notes: { contains: q, mode: "insensitive" as const } },
            ...(plate
              ? [{ plate: { contains: plate, mode: "insensitive" as const } }]
              : []),
            ...(digits ? [{ phone: { contains: digits } }] : []),
          ],
        }
      : {}),
  };
}
